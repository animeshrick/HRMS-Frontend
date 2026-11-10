import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../app/App";
import { formatFullTime, formatShortTime } from "../lib/time";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "./renderWithProviders";

function savedMessage(id: number, sender: "user" | "assistant", message: string, createdAt: string) {
  return { id, sender, message, sources: [], created_at: createdAt };
}

describe("time labels", () => {
  it("shows Indian time, today or with the date, and the full time with seconds", () => {
    const now = new Date("2026-11-09T18:00:00Z"); // 11:30 PM on 9 Nov in India
    expect(formatShortTime("2026-11-09T17:11:35Z", now)).toBe("Today, 10:41 PM");
    expect(formatShortTime("2026-11-08T17:11:35Z", now)).toBe("08 Nov 2026, 10:41 PM");
    expect(formatFullTime("2026-11-09T17:11:35Z")).toBe("MONDAY, 09 NOVEMBER 2026 at 10:41:35 PM IST");
    expect(formatShortTime("not a time", now)).toBe("");
  });
});

describe("chat history", () => {
  beforeEach(() => {
    sessionStorage.clear();
    storeSession();
  });

  it("shows the saved messages with a time under each one and the full time on hover", async () => {
    mockRoutes({
      "GET /chat/history": {
        body: [
          savedMessage(1, "user", "How many casual leaves do I have?", "2026-11-08T17:11:35Z"),
          savedMessage(2, "assistant", "You have 8 casual leaves.", "2026-11-08T17:11:38Z"),
        ],
      },
    });
    renderWithProviders(<App />, "/chat");
    expect(await screen.findByText("You have 8 casual leaves.")).toBeInTheDocument();
    expect(screen.getByText("How many casual leaves do I have?")).toBeInTheDocument();
    const times = screen.getAllByText("08 Nov 2026, 10:41 PM");
    expect(times).toHaveLength(2);
    expect(times[1]).toHaveAttribute("title", "SUNDAY, 08 NOVEMBER 2026 at 10:41:38 PM IST");
    expect(screen.queryByRole("button", { name: /load older/i })).not.toBeInTheDocument();
  });

  it("shows the whole saved history in one request and never asks for an older page", async () => {
    const wholeHistory = Array.from({ length: 10 }, (_, index) => savedMessage(101 + index, "user", `message ${101 + index}`, "2026-11-08T17:11:35Z"));
    const fetchMock = mockRoutes({ "GET /chat/history": { body: wholeHistory } });
    renderWithProviders(<App />, "/chat");
    expect(await screen.findByText("message 110")).toBeInTheDocument();
    expect(screen.getByText("message 101")).toBeInTheDocument();
    expect(callsTo(fetchMock, "GET /chat/history")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("before_id"))).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /load older/i })).not.toBeInTheDocument();
  });

  it("still works when the history cannot be loaded, and gives new messages a time", async () => {
    mockRoutes({
      "GET /chat/history": { status: 500, body: { detail: "down" } },
      "POST /chat": {
        body: {
          question: "hi", rewritten_question: "hi", answer: "Hello there.", answerable: true, sources: [], pending_action: null,
          asked_at: "2026-11-09T17:11:35Z", answered_at: "2026-11-09T17:11:38Z",
        },
      },
    });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "hi{Enter}");
    const answer = await screen.findByText("Hello there.");
    expect(answer).toBeInTheDocument();
    const times = screen.getAllByText(/10:41 PM/);
    expect(times).toHaveLength(2);
    expect(times.at(-1)).toHaveAttribute("title", expect.stringContaining("10:41:38 PM IST"));
  });
});

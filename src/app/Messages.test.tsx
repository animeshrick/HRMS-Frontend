import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const PEOPLE = [
  { emp_id: "EMP001", full_name: "Hana Reyes", dept: "HR", role: "hr" },
  { emp_id: "EMP010", full_name: "CEO Carl", dept: "Executive", role: "superadmin" },
];

const CONVERSATIONS = [
  {
    person: { emp_id: "EMP001", full_name: "Hana Reyes", dept: "HR", role: "hr" },
    last_message: "See you at 3pm",
    last_message_at: "2026-11-16T09:00:00Z",
    unread_count: 2,
  },
];

const THREAD = {
  person: { emp_id: "EMP001", full_name: "Hana Reyes", dept: "HR", role: "hr" },
  messages: [
    { id: 1, mine: false, body: "Hi there", attachment_path: null, attachment_filename: null, attachment_content_type: null, created_at: "2026-11-16T08:00:00Z" },
    { id: 2, mine: true, body: "See you at 3pm", attachment_path: null, attachment_filename: null, attachment_content_type: null, created_at: "2026-11-16T09:00:00Z" },
  ],
};

describe("messages page", () => {
  it("lists conversations with their unread count and last message", async () => {
    storeSession();
    mockRoutes({ "GET /messages/conversations": { body: CONVERSATIONS } });
    renderWithProviders(<App />, "/messages");
    const row = (await screen.findByText("Hana Reyes")).closest("button")!;
    expect(within(row).getByText("See you at 3pm")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
  });

  it("shows the empty state when there are no conversations in the last 24 hours", async () => {
    storeSession();
    mockRoutes({ "GET /messages/conversations": { body: [] } });
    renderWithProviders(<App />, "/messages");
    expect(await screen.findByText(/No conversations in the last 24 hours/)).toBeInTheDocument();
  });

  it("opens a conversation and shows its thread", async () => {
    storeSession();
    mockRoutes({
      "GET /messages/conversations": { body: CONVERSATIONS },
      "GET /messages/thread/EMP001": { body: THREAD },
    });
    renderWithProviders(<App />, "/messages");
    await userEvent.click(await screen.findByText("Hana Reyes"));
    expect(await screen.findByText("Hi there")).toBeInTheDocument();
    expect(screen.getAllByText("See you at 3pm").length).toBeGreaterThan(0);
  });

  it("sends a text message and clears the draft", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "GET /messages/conversations": { body: CONVERSATIONS },
      "GET /messages/thread/EMP001": { body: THREAD },
      "POST /messages/send": {
        body: { id: 3, mine: true, body: "On my way", attachment_path: null, attachment_filename: null, attachment_content_type: null, created_at: "2026-11-16T09:05:00Z" },
      },
    });
    renderWithProviders(<App />, "/messages");
    await userEvent.click(await screen.findByText("Hana Reyes"));
    await screen.findByText("Hi there");
    const textbox = screen.getByLabelText("Your message");
    await userEvent.type(textbox, "On my way");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(callsTo(fetchMock, "POST /messages/send")).toHaveLength(1));
    const sentBody = JSON.parse(callsTo(fetchMock, "POST /messages/send")[0]![1].body as string);
    expect(sentBody).toEqual({ to_emp_id: "EMP001", body: "On my way", attachment_path: null, attachment_filename: null, attachment_content_type: null });
    expect(textbox).toHaveValue("");
  });

  it("uploads an attachment before sending the message", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "GET /messages/conversations": { body: CONVERSATIONS },
      "GET /messages/thread/EMP001": { body: THREAD },
      "POST /messages/attachments?filename=plan.pdf": { body: { attachment_path: "EMP003/abc-plan.pdf", attachment_filename: "plan.pdf", attachment_content_type: "application/pdf" } },
      "POST /messages/send": {
        body: { id: 4, mine: true, body: null, attachment_path: "EMP003/abc-plan.pdf", attachment_filename: "plan.pdf", attachment_content_type: "application/pdf", created_at: "2026-11-16T09:06:00Z" },
      },
    });
    renderWithProviders(<App />, "/messages");
    await userEvent.click(await screen.findByText("Hana Reyes"));
    await screen.findByText("Hi there");
    await userEvent.upload(screen.getByLabelText("Attach"), new File(["%PDF"], "plan.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(callsTo(fetchMock, "POST /messages/attachments?filename=plan.pdf")).toHaveLength(1));
    await waitFor(() => expect(callsTo(fetchMock, "POST /messages/send")).toHaveLength(1));
    const sentBody = JSON.parse(callsTo(fetchMock, "POST /messages/send")[0]![1].body as string);
    expect(sentBody).toEqual({ to_emp_id: "EMP001", body: null, attachment_path: "EMP003/abc-plan.pdf", attachment_filename: "plan.pdf", attachment_content_type: "application/pdf" });
  });

  it("opens the new-message picker, searches, and starts a conversation", async () => {
    storeSession();
    mockRoutes({
      "GET /messages/conversations": { body: [] },
      "GET /messages/people": { body: PEOPLE },
      "GET /messages/thread/EMP010": { body: { person: PEOPLE[1], messages: [] } },
    });
    renderWithProviders(<App />, "/messages");
    await screen.findByText(/No conversations in the last 24 hours/);
    await userEvent.click(screen.getByRole("button", { name: "New message" }));
    expect(await screen.findByText("Hana Reyes")).toBeInTheDocument();
    expect(screen.getByText("CEO Carl")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Search people"), "ceo");
    expect(screen.queryByText("Hana Reyes")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("CEO Carl"));
    expect(await screen.findByText("Nothing in the last 24 hours. Say hello.")).toBeInTheDocument();
  });

  it("shows the unread badge in the sidebar", async () => {
    storeSession();
    mockRoutes({ "GET /messages/conversations": { body: CONVERSATIONS } });
    renderWithProviders(<App />, "/home");
    const messagesLink = await screen.findByRole("link", { name: /Messages/ });
    await waitFor(() => expect(within(messagesLink).getByText("2")).toBeInTheDocument());
  });

  it("the Messages route is gated by the downtime system like any other page", async () => {
    storeSession();
    mockRoutes({ "GET /system/downtime": { body: { down_pages: ["messages"] } } });
    renderWithProviders(<App />, "/messages");
    expect(await screen.findByText("This page is down for maintenance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New message" })).not.toBeInTheDocument();
  });
});

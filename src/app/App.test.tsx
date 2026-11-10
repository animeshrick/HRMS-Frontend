import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, vi } from "vitest";
import { App } from "./App";
import { renderWithProviders, storeSession } from "../test/renderWithProviders";

// Requests the layout makes by itself on every page (the notification bell). They are answered
// separately so they never consume a reply the test queued for its own calls.
const BACKGROUND_PATHS = ["/leave/mine"];

function isBackground(url: unknown) {
  return BACKGROUND_PATHS.some((path) => String(url).replace(/^\/api/, "").startsWith(path));
}

/** The calls the test is about, with the layout's own background requests left out. */
function serverCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([url]) => !isBackground(url));
}

function mockFetchSequence(...responses: Array<{ status: number; body: unknown }>) {
  const queued = [...responses];
  const fetchMock = vi.fn(async (url: string) => {
    if (isBackground(url)) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    const next = queued.shift();
    return next
      ? new Response(JSON.stringify(next.body), { status: next.status })
      : new Response(JSON.stringify({ detail: `No fake left for ${url}` }), { status: 500 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("route guards", () => {
  it("sends a logged-out visitor to the login page", () => {
    renderWithProviders(<App />, "/chat");
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("forces a temporary-password user to the change-password page", () => {
    storeSession({ mustChangePassword: true });
    renderWithProviders(<App />, "/chat");
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });

  it("keeps non-HR users out of the admin page", () => {
    storeSession({ role: "employee" });
    renderWithProviders(<App />, "/admin");
    expect(screen.getByRole("heading", { name: /Ask about company HR policies/ })).toBeInTheDocument();
  });

  it("shows the admin page and link to HR", () => {
    storeSession({ role: "hr" });
    renderWithProviders(<App />, "/admin");
    expect(screen.getByRole("heading", { name: "HR admin" })).toBeInTheDocument();
  });
});

describe("login", () => {
  it("shows field errors without calling the server", async () => {
    const fetchMock = mockFetchSequence();
    renderWithProviders(<App />, "/login");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(screen.getByText("Enter the employee ID.")).toBeInTheDocument();
    expect(serverCalls(fetchMock)).toHaveLength(0);
  });

  it("shows the server message for wrong credentials", async () => {
    mockFetchSequence({ status: 401, body: { detail: "Invalid employee ID or password." } });
    renderWithProviders(<App />, "/login");
    await userEvent.type(screen.getByLabelText("Employee ID"), "EMP001");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid employee ID or password.");
  });

  it("goes to the chat after a successful login", async () => {
    mockFetchSequence({
      status: 200,
      body: { access_token: "t", token_type: "bearer", must_change_password: false, role: "employee", full_name: "Ananya Das", emp_id: "EMP003" },
    });
    renderWithProviders(<App />, "/login");
    await userEvent.type(screen.getByLabelText("Employee ID"), "EMP003");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("heading", { name: /Ask about company HR policies/ })).toBeInTheDocument();
  });
});

describe("change password", () => {
  it("catches a short new password before calling the server", async () => {
    storeSession({ mustChangePassword: true });
    const fetchMock = mockFetchSequence();
    renderWithProviders(<App />, "/change-password");
    await userEvent.type(screen.getByLabelText("Current password"), "temporary");
    await userEvent.type(screen.getByLabelText("New password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(screen.getByText(/at least 10 characters/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs out with a notice after a successful change", async () => {
    storeSession({ mustChangePassword: true });
    mockFetchSequence({ status: 200, body: { message: "Password changed." } });
    renderWithProviders(<App />, "/change-password");
    await userEvent.type(screen.getByLabelText("Current password"), "temporary");
    await userEvent.type(screen.getByLabelText("New password"), "A-brand-new-pass1");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "A-brand-new-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByText(/Password changed. Please log in/)).toBeInTheDocument();
  });
});

describe("chat", () => {
  it("shows the answer and its sources", async () => {
    storeSession();
    mockFetchSequence({ status: 200, body: [] }, {   // the first call is the (empty) chat history
      status: 200,
      body: {
        question: "q", rewritten_question: "q", answer: "You get 8 casual leaves.", answerable: true,
        sources: [{ number: 1, chunk_id: "c1", doc_id: "HR-LEAVE-001", title: "Leave Policy", section: "2.1", version: "1.2" }],
      },
    });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "How many casual leaves?{Enter}");
    expect(await screen.findByText("You get 8 casual leaves.")).toBeInTheDocument();
    expect(screen.getByText(/Sources \(1\)/)).toBeInTheDocument();
  });

  it("shows an error with Retry, and Retry works", async () => {
    storeSession();
    const fetchMock = mockFetchSequence(
      { status: 200, body: [] },    // the empty chat history
      { status: 502, body: { detail: "The assistant could not answer right now. Please try again in a moment." } },
      { status: 200, body: { question: "q", rewritten_question: "q", answer: "Second try worked.", answerable: true, sources: [] } },
    );
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "hello{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("could not answer right now");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Second try worked.")).toBeInTheDocument();
    expect(serverCalls(fetchMock)).toHaveLength(3);
  });

  it("logs out when the server says the session is not valid", async () => {
    storeSession();
    mockFetchSequence({ status: 200, body: [] }, { status: 401, body: { detail: "Your session has expired or is not valid. Please log in again." } });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "hello{Enter}");
    await waitFor(() => expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument());
    expect(screen.getByText(/Your session has ended/)).toBeInTheDocument();
  });
});

describe("admin", () => {
  it("shows the temporary password once and can hide it", async () => {
    storeSession({ role: "hr" });
    mockFetchSequence({
      status: 200,
      body: { emp_id: "EMP010", full_name: "New Person", role: "employee", temporary_password: "20000101EMP010xyz" },
    });
    renderWithProviders(<App />, "/admin");
    await userEvent.type(screen.getByLabelText("Employee ID to create"), "EMP010");
    await userEvent.click(screen.getByRole("button", { name: "Create login" }));
    expect(await screen.findByText("20000101EMP010xyz")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /hide it/ }));
    expect(screen.queryByText("20000101EMP010xyz")).not.toBeInTheDocument();
  });
});

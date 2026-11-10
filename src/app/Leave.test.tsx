import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const BALANCES = [
  { type_code: "casual", type_name: "Casual Leave", limit_type: "per_year", days_allowed: 8, used_days: 4, pending_days: 1, remaining_days: 3, max_days_per_request: 7, can_apply_by_chat: true },
  { type_code: "maternity", type_name: "Maternity Leave", limit_type: "per_request", days_allowed: 90, used_days: 0, pending_days: 0, remaining_days: null, max_days_per_request: null, can_apply_by_chat: false },
];

const CONFIRM_REPLY = {
  question: "apply", rewritten_question: "apply", answerable: true, sources: [],
  answer: "Casual Leave on Tue, 10 Nov 2026 (full day).\nPlease upload related document(Optional).\nReply yes to confirm, or no to cancel.",
  pending_action: { id: 7, action_type: "apply_leave", summary: "Casual Leave on Tue, 10 Nov 2026 (full day)", allows_document: true, expires_at: "2026-11-09T10:00:00Z" },
};

describe("chat with a leave waiting for confirmation", () => {
  it("shows Yes and No, and Yes sends the confirmation", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "POST /chat": ({ body }) =>
        (body as { question: string }).question === "Yes"
          ? { body: { ...CONFIRM_REPLY, answer: "Done. Your request #12 was sent to Rahul Verma for approval.", pending_action: null } }
          : { body: CONFIRM_REPLY },
    });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "Apply leave for 10th Nov, 2026 for full day{Enter}");
    expect(await screen.findByText(/Please upload related document\(Optional\)\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, confirm" }));
    expect(await screen.findByText(/sent to Rahul Verma for approval/)).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /chat")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Yes, confirm" })).not.toBeInTheDocument();     // buttons go away once answered
  });

  it("uploads the optional document and attaches it to the waiting leave", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "POST /chat": { body: CONFIRM_REPLY },
      "POST /leave/documents?filename=note.pdf": { body: { document_path: "3/abc-note.pdf" } },
      "POST /pending-actions/7/document": { body: { message: "Document added." } },
    });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "apply{Enter}");
    await screen.findByRole("button", { name: "Yes, confirm" });
    await userEvent.upload(screen.getByLabelText(/Related document/), new File(["pdf"], "note.pdf", { type: "application/pdf" }));
    expect(await screen.findByText("Document added: note.pdf")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /pending-actions/7/document")).toHaveLength(1);
    const attachBody = JSON.parse(callsTo(fetchMock, "POST /pending-actions/7/document")[0]![1].body as string);
    expect(attachBody).toEqual({ document_path: "3/abc-note.pdf" });
  });

  it("refuses a wrong file type without calling the server", async () => {
    storeSession();
    const fetchMock = mockRoutes({ "POST /chat": { body: CONFIRM_REPLY } });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "apply{Enter}");
    await screen.findByRole("button", { name: "Yes, confirm" });
    await userEvent.upload(screen.getByLabelText(/Related document/), new File(["x"], "virus.exe", { type: "application/x-msdownload" }), { applyAccept: false });
    expect(await screen.findByText("Only PDF, PNG or JPG files can be uploaded.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);      // the chat history and the chat message, nothing for the wrong file
  });
});

describe("leave page", () => {
  const ROUTES = { "GET /leave/balances": { body: BALANCES }, "GET /leave/mine": { body: [] } };

  it("shows the balances", async () => {
    storeSession();
    mockRoutes(ROUTES);
    renderWithProviders(<App />, "/leave");
    expect(await screen.findByText("3 left")).toBeInTheDocument();
    expect(screen.getByText(/Used 4, waiting 1/)).toBeInTheDocument();
    expect(screen.getByText(/Up to 90 days per request/)).toBeInTheDocument();
  });

  it("applies for casual leave", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      ...ROUTES,
      "POST /leave/apply": { body: { leave_id: 12, approver: "Rahul Verma", message: "Your request was sent to Rahul Verma for approval." } },
    });
    renderWithProviders(<App />, "/leave");
    await screen.findByText("3 left");
    await userEvent.selectOptions(screen.getByLabelText("Leave type"), "casual");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-11-10");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("status")).toHaveTextContent("sent to Rahul Verma");
    const sent = JSON.parse(callsTo(fetchMock, "POST /leave/apply")[0]![1].body as string);
    expect(sent).toMatchObject({ leave_type: "casual", start_date: "2026-11-10", end_date: "2026-11-10", day_type: "full" });
  });

  it("makes maternity leave require a document before anything is sent", async () => {
    storeSession();
    const fetchMock = mockRoutes(ROUTES);
    renderWithProviders(<App />, "/leave");
    await screen.findByText("3 left");
    await userEvent.selectOptions(screen.getByLabelText("Leave type"), "maternity");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-11-10");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByText("Maternity Leave needs a supporting document.")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /leave/apply")).toHaveLength(0);
  });

  it("uploads the document first, then applies with its path", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      ...ROUTES,
      "POST /leave/documents?filename=letter.pdf": { body: { document_path: "3/x-letter.pdf" } },
      "POST /leave/apply": { body: { leave_id: 1, approver: "HR", message: "Your request was sent to HR for approval." } },
    });
    renderWithProviders(<App />, "/leave");
    await screen.findByText("3 left");
    await userEvent.selectOptions(screen.getByLabelText("Leave type"), "maternity");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-11-10");
    await userEvent.upload(screen.getByLabelText(/Supporting document/), new File(["pdf"], "letter.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await screen.findByText(/sent to HR for approval/);
    const sent = JSON.parse(callsTo(fetchMock, "POST /leave/apply")[0]![1].body as string);
    expect(sent.document_path).toBe("3/x-letter.pdf");
  });

  it("shows the rule message from the server", async () => {
    storeSession();
    mockRoutes({ ...ROUTES, "POST /leave/apply": { status: 400, body: { detail: "You have only 1 day of Casual Leave left for that year, and this request needs 2 days.", code: "leave_rule" } } });
    renderWithProviders(<App />, "/leave");
    await screen.findByText("3 left");
    await userEvent.selectOptions(screen.getByLabelText("Leave type"), "casual");
    await userEvent.type(screen.getByLabelText("Start date"), "2026-11-10");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("only 1 day of Casual Leave left");
  });

  it("lists my requests and cancels one", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "GET /leave/balances": { body: BALANCES },
      "GET /leave/mine": { body: [{ id: 12, leave_type: "casual", start_date: "2026-11-20", end_date: "2026-11-20", day_type: "full", days: 1, status: "pending", reason: null, document_path: null, description: "Casual Leave on Fri, 20 Nov 2026 (full day)" }] },
      "POST /leave/12/cancel": { body: { message: "The leave was cancelled." } },
    });
    renderWithProviders(<App />, "/leave");
    const row = (await screen.findByText(/#12 Casual Leave on Fri, 20 Nov 2026/)).closest("li")!;
    await userEvent.click(within(row).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(callsTo(fetchMock, "POST /leave/12/cancel")).toHaveLength(1));
  });
});

describe("approvals page", () => {
  const APPROVAL = { id: 12, emp_id: "EMP003", full_name: "Ananya Das", leave_type: "casual", description: "Casual Leave on Tue, 10 Nov 2026 (full day)", reason: "family", has_document: true, requested_at: "2026-11-07T10:00:00Z" };

  it("approves a request and refreshes the list", async () => {
    storeSession({ employeeId: "EMP002" });
    let approvals = [APPROVAL];
    const fetchMock = mockRoutes({
      "GET /leave/approvals": () => ({ body: approvals }),
      "POST /leave/12/decision": () => { approvals = []; return { body: { leave_id: 12, status: "approved" } }; },
    });
    renderWithProviders(<App />, "/approvals");
    expect(await screen.findByText("Ananya Das (EMP003)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Nothing is waiting for you.")).toBeInTheDocument();
    expect(JSON.parse(callsTo(fetchMock, "POST /leave/12/decision")[0]![1].body as string)).toMatchObject({ decision: "approved" });
  });

  it("shows the server message when someone else decided first", async () => {
    storeSession({ employeeId: "EMP002" });
    mockRoutes({
      "GET /leave/approvals": { body: [APPROVAL] },
      "POST /leave/12/decision": { status: 409, body: { detail: "This leave is already approved.", code: "leave_rule" } },
    });
    renderWithProviders(<App />, "/approvals");
    await screen.findByText("Ananya Das (EMP003)");
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already approved");
  });

  it("opens the signed document link in a new tab", async () => {
    storeSession({ employeeId: "EMP002" });
    mockRoutes({ "GET /leave/approvals": { body: [APPROVAL] }, "GET /leave/12/document-url": { body: { url: "https://signed.example/doc?token=1" } } });
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
    renderWithProviders(<App />, "/approvals");
    await screen.findByText("Ananya Das (EMP003)");
    await userEvent.click(screen.getByRole("button", { name: "View document" }));
    await waitFor(() => expect(openMock).toHaveBeenCalledWith("https://signed.example/doc?token=1", "_blank", "noopener"));
  });
});

describe("wrong current password", () => {
  it("keeps the user logged in and shows the message", async () => {
    storeSession();
    mockRoutes({ "POST /change-password": { status: 401, body: { detail: "Your current password is not correct.", code: "wrong_current_password" } } });
    renderWithProviders(<App />, "/change-password");
    await userEvent.type(screen.getByLabelText("Current password"), "wrong");
    await userEvent.type(screen.getByLabelText("New password"), "A-brand-new-pass1");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "A-brand-new-pass1");
    await userEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("current password is not correct");
    expect(screen.getByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });
});

describe("payslip link in the chat", () => {
  it("turns the temporary https link into a link that opens safely in a new tab", async () => {
    storeSession();
    mockRoutes({
      "POST /chat": {
        body: { question: "q", rewritten_question: "q", answerable: true, sources: [], pending_action: null,
          answer: "Here is your payslip for October 2026: https://signed.example/payslips/3/a.pdf?token=1\nThe link works for 5 minutes." },
      },
    });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "my payslip{Enter}");
    const link = await screen.findByRole("link", { name: /signed\.example/ });
    expect(link).toHaveAttribute("href", "https://signed.example/payslips/3/a.pdf?token=1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("does not make non-https text clickable", async () => {
    storeSession();
    mockRoutes({ "POST /chat": { body: { question: "q", rewritten_question: "q", answerable: true, sources: [], pending_action: null, answer: "Visit javascript:alert(1) or http://plain.example" } } });
    renderWithProviders(<App />, "/chat");
    await userEvent.type(screen.getByLabelText("Your question"), "hello{Enter}");
    const message = (await screen.findByText(/javascript:alert/)).closest("p")!;
    expect(within(message).queryByRole("link")).not.toBeInTheDocument();       // the menu links are outside this message
  });
});

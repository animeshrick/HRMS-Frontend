import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { App } from "./App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "../test/renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const DOCUMENTS = [
  {
    id: 1, original_filename: "handbook.pdf", content_type: "application/pdf", size_bytes: 20_000, created_at: "2026-11-01T00:00:00Z",
    owner: { emp_id: "EMP001", full_name: "Owner One" }, is_owner: false, my_access: { state: "none" },
  },
  {
    id: 2, original_filename: "my-notes.docx", content_type: "application/msword", size_bytes: 5_000, created_at: "2026-11-05T00:00:00Z",
    owner: { emp_id: "EMP003", full_name: "Test User" }, is_owner: true, my_access: { state: "owner" },
  },
];

const BASE_ROUTES = { "GET /documents/requests/inbox": { body: [] }, "GET /documents/requests/mine": { body: [] } };

describe("documents page", () => {
  it("lists every document's name with the owner and my own access state", async () => {
    storeSession();
    mockRoutes({ ...BASE_ROUTES, "GET /documents": { body: DOCUMENTS } });
    renderWithProviders(<App />, "/documents");
    expect(await screen.findByText("handbook.pdf")).toBeInTheDocument();
    expect(screen.getByText("my-notes.docx")).toBeInTheDocument();
    expect(screen.getByText("Owner One")).toBeInTheDocument();
    expect(screen.getByText("Yours")).toBeInTheDocument();
  });

  it("uploads a document", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      ...BASE_ROUTES,
      "GET /documents": { body: [] },
      "POST /documents?filename=plan.pdf": { body: { id: 9, original_filename: "plan.pdf", message: "Document uploaded." } },
    });
    renderWithProviders(<App />, "/documents");
    await screen.findByText("No documents have been uploaded yet.");
    await userEvent.upload(screen.getByLabelText("Choose a file to upload"), new File(["x"], "plan.pdf", { type: "application/pdf" }));
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("plan.pdf uploaded.")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /documents?filename=plan.pdf")).toHaveLength(1);
  });

  it("refuses a disallowed file type without calling the server", async () => {
    storeSession();
    const fetchMock = mockRoutes({ ...BASE_ROUTES, "GET /documents": { body: [] } });
    renderWithProviders(<App />, "/documents");
    await screen.findByText("No documents have been uploaded yet.");
    await userEvent.upload(screen.getByLabelText("Choose a file to upload"), new File(["x"], "virus.exe", { type: "application/x-msdownload" }), { applyAccept: false });
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText(/That file type is not allowed/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/documents?filename"))).toHaveLength(0);
  });

  it("opens a document's detail and requests access", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      ...BASE_ROUTES,
      "GET /documents": { body: DOCUMENTS },
      "GET /documents/1": {
        body: { id: 1, original_filename: "handbook.pdf", content_type: "application/pdf", size_bytes: 20_000, created_at: "2026-11-01T00:00:00Z", owner: { emp_id: "EMP001", full_name: "Owner One" }, is_owner: false, my_access: { state: "none" } },
      },
      "POST /documents/1/request": { body: { message: "Your request was sent to the owner." } },
    });
    renderWithProviders(<App />, "/documents");
    await userEvent.click(await screen.findByText("handbook.pdf"));
    expect(await screen.findByText(/Owner: Owner One/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Request access" }));
    expect(await screen.findByText("Your request was sent to the owner.")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /documents/1/request")).toHaveLength(1);
  });

  it("shows requests waiting for me and approves one", async () => {
    storeSession();
    const fetchMock = mockRoutes({
      "GET /documents": { body: DOCUMENTS },
      "GET /documents/requests/mine": { body: [] },
      "GET /documents/requests/inbox": {
        body: [{ id: 5, document: { id: 2, original_filename: "my-notes.docx" }, requester: { emp_id: "EMP002", full_name: "Ann Employee" }, requested_at: "2026-11-10T00:00:00Z" }],
      },
      "POST /documents/requests/5/decision": { body: { id: 5, status: "approved", expires_at: "2026-11-20T00:00:00Z" } },
    });
    renderWithProviders(<App />, "/documents");
    expect(await screen.findByText(/Ann Employee \(EMP002\) wants/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Access approved.")).toBeInTheDocument();
    const decisionBody = JSON.parse(callsTo(fetchMock, "POST /documents/requests/5/decision")[0]![1].body as string);
    expect(decisionBody).toEqual({ decision: "approved" });
  });

  it("is reachable from the sidebar, even for the super admin", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes({ ...BASE_ROUTES, "GET /documents": { body: [] }, "GET /superadmin/employees": { body: [] }, "GET /superadmin/leave-types": { body: [] } });
    renderWithProviders(<App />, "/home");
    expect(await screen.findByRole("link", { name: "Documents" })).toBeInTheDocument();
  });
});

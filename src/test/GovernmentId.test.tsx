import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { callsTo, mockRoutes, renderWithProviders, storeSession } from "./renderWithProviders";

afterEach(() => vi.unstubAllGlobals());

const VALID_AADHAAR = "234567890124";
const VALID_PAN = "ABCDE1234F";

const NOT_SUBMITTED = { submitted: false, required: true, id_type: null, masked_number: null, submitted_at: null };

/** A PNG the file picker will accept (the bytes do not matter, only the type and size). */
function makeImageFile(name: string) {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

const UPLOAD_ROUTES = {
  "GET /government-id": { body: NOT_SUBMITTED },
  "POST /government-id/images?side=front": { body: { side: "front", image_path: "3/aaa-front.png", content_type: "image/png" } },
  "POST /government-id/images?side=back": { body: { side: "back", image_path: "3/bbb-back.png", content_type: "image/png" } },
  "POST /government-id": { body: { submitted: true, id_type: "aadhaar", masked_number: "Aadhaar ending 0124", message: "Your government ID is saved. Thank you." } },
};

describe("the government ID step", () => {
  beforeEach(() => sessionStorage.clear());

  it("keeps an employee without an ID on the Govt ID page", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    mockRoutes(UPLOAD_ROUTES);
    renderWithProviders(<App />, "/home");
    expect(await screen.findByRole("heading", { name: "Government ID" })).toBeInTheDocument();
  });

  it("lets a change of password come first when both steps are pending", async () => {
    storeSession({ mustChangePassword: true, mustSubmitGovernmentId: true });
    mockRoutes(UPLOAD_ROUTES);
    renderWithProviders(<App />, "/home");
    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();
  });

  it("shows only the Govt ID link in the menu while the ID is missing", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    mockRoutes(UPLOAD_ROUTES);
    renderWithProviders(<App />, "/government-id");
    expect(await screen.findAllByRole("link", { name: "Govt ID" })).not.toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leave" })).not.toBeInTheDocument();
  });

  it("asks for both sides of an Aadhaar and only the front of a PAN", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    mockRoutes(UPLOAD_ROUTES);
    renderWithProviders(<App />, "/government-id");

    expect(await screen.findByLabelText("Aadhaar front image")).toBeInTheDocument();
    expect(screen.getByLabelText("Aadhaar back image")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: /PAN/ }));
    expect(screen.getByLabelText("PAN front image")).toBeInTheDocument();
    expect(screen.queryByLabelText("Aadhaar back image")).not.toBeInTheDocument();
  });

  it("refuses a mistyped Aadhaar number without sending anything", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    const fetchMock = mockRoutes(UPLOAD_ROUTES);
    renderWithProviders(<App />, "/government-id");

    await userEvent.type(await screen.findByLabelText("Aadhaar number"), "234567890123");
    await userEvent.upload(screen.getByLabelText("Aadhaar front image"), makeImageFile("front.png"));
    await userEvent.upload(screen.getByLabelText("Aadhaar back image"), makeImageFile("back.png"));
    await userEvent.click(screen.getByRole("button", { name: "Submit and continue" }));

    expect(await screen.findByText("That Aadhaar number is not valid. Please check the digits and try again.")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /government-id")).toHaveLength(0);
    expect(callsTo(fetchMock, "POST /government-id/images?side=front")).toHaveLength(0);
  });

  it("asks for the back image when an Aadhaar is submitted without one", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    const fetchMock = mockRoutes(UPLOAD_ROUTES);
    renderWithProviders(<App />, "/government-id");

    await userEvent.type(await screen.findByLabelText("Aadhaar number"), VALID_AADHAAR);
    await userEvent.upload(screen.getByLabelText("Aadhaar front image"), makeImageFile("front.png"));
    await userEvent.click(screen.getByRole("button", { name: "Submit and continue" }));

    expect(await screen.findByText("Upload the back image of your Aadhaar.")).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST /government-id")).toHaveLength(0);
  });

  it("uploads both sides, saves the Aadhaar and opens the app in the same session", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    const fetchMock = mockRoutes({ ...UPLOAD_ROUTES, "GET /celebrations": { body: [] } });
    renderWithProviders(<App />, "/government-id");

    await userEvent.type(await screen.findByLabelText("Aadhaar number"), "2345 6789 0124");
    await userEvent.upload(screen.getByLabelText("Aadhaar front image"), makeImageFile("front.png"));
    await userEvent.upload(screen.getByLabelText("Aadhaar back image"), makeImageFile("back.png"));
    await userEvent.click(screen.getByRole("button", { name: "Submit and continue" }));

    await waitFor(() => expect(callsTo(fetchMock, "POST /government-id")).toHaveLength(1));
    expect(callsTo(fetchMock, "POST /government-id/images?side=front")).toHaveLength(1);
    expect(callsTo(fetchMock, "POST /government-id/images?side=back")).toHaveLength(1);

    const sent = JSON.parse(String(callsTo(fetchMock, "POST /government-id")[0]![1]!.body));
    expect(sent).toEqual({
      id_type: "aadhaar",
      id_number: VALID_AADHAAR, // the spaces the person typed are removed
      front_image_path: "3/aaa-front.png",
      back_image_path: "3/bbb-back.png",
    });
    // No second login: the menu is back, so the gate is open.
    expect(await screen.findByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("sends a PAN with the front image only, and no back path", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    const fetchMock = mockRoutes({
      ...UPLOAD_ROUTES,
      "GET /celebrations": { body: [] },
      "POST /government-id": { body: { submitted: true, id_type: "pan", masked_number: "PAN ending 234F", message: "saved" } },
    });
    renderWithProviders(<App />, "/government-id");

    await userEvent.click(await screen.findByRole("radio", { name: /PAN/ }));
    await userEvent.type(screen.getByLabelText("PAN number"), "abcde1234f");
    await userEvent.upload(screen.getByLabelText("PAN front image"), makeImageFile("front.png"));
    await userEvent.click(screen.getByRole("button", { name: "Submit and continue" }));

    await waitFor(() => expect(callsTo(fetchMock, "POST /government-id")).toHaveLength(1));
    expect(callsTo(fetchMock, "POST /government-id/images?side=back")).toHaveLength(0);
    const sent = JSON.parse(String(callsTo(fetchMock, "POST /government-id")[0]![1]!.body));
    expect(sent).toMatchObject({ id_type: "pan", id_number: VALID_PAN, back_image_path: null });
  });

  it("shows the error from the server when it refuses the ID", async () => {
    storeSession({ mustSubmitGovernmentId: true });
    mockRoutes({
      ...UPLOAD_ROUTES,
      "POST /government-id": { status: 409, body: { detail: "Your government ID is already on file.", code: "government_id" } },
    });
    renderWithProviders(<App />, "/government-id");

    await userEvent.type(await screen.findByLabelText("Aadhaar number"), VALID_AADHAAR);
    await userEvent.upload(screen.getByLabelText("Aadhaar front image"), makeImageFile("front.png"));
    await userEvent.upload(screen.getByLabelText("Aadhaar back image"), makeImageFile("back.png"));
    await userEvent.click(screen.getByRole("button", { name: "Submit and continue" }));

    expect(await screen.findByText(/already on file/)).toBeInTheDocument();
  });

  it("tells someone who already submitted that the ID cannot be changed here", async () => {
    storeSession();
    mockRoutes({});      // the default fake says an Aadhaar is on file
    renderWithProviders(<App />, "/government-id");
    expect(await screen.findByText("On file")).toBeInTheDocument();
    expect(screen.getByText("Aadhaar ending 0124")).toBeInTheDocument();
    expect(screen.getByText(/ask the super admin to clear it/)).toBeInTheDocument();
  });

  it("shows the masked number on my profile", async () => {
    storeSession();
    mockRoutes({
      "GET /me/profile": {
        body: {
          emp_id: "EMP003", full_name: "Test User", role: "employee", dept: "IT", email: null, phone: null, gender: null,
          date_of_joining: null, date_of_birth: null, address: null, emergency_contact: null, manager_name: null, is_active: true,
        },
      },
    });
    renderWithProviders(<App />, "/me");
    expect(await screen.findByText("Government ID")).toBeInTheDocument();
    expect(screen.getByText("Aadhaar ending 0124")).toBeInTheDocument();
  });
});

describe("the super admin's government ID card", () => {
  const PEOPLE = [
    { emp_id: "EMP-3", full_name: "Ann Employee", dept: "IT", role: "employee", submitted: true, id_type: "aadhaar", masked_number: "Aadhaar ending 0124", submitted_at: "2026-11-23T10:00:00+00:00" },
    { emp_id: "EMP-5", full_name: "Cleo CEO", dept: "Management", role: "ceo", submitted: false, id_type: null, masked_number: null, submitted_at: null },
  ];
  const FULL_ID = {
    emp_id: "EMP-3", full_name: "Ann Employee", id_type: "aadhaar", id_number: VALID_AADHAAR, masked_number: "Aadhaar ending 0124",
    submitted_at: "2026-11-23T10:00:00+00:00", front_image_path: "3/aaa-front.png", back_image_path: "3/bbb-back.png",
  };
  const SUPERADMIN_ROUTES = {
    "GET /superadmin/employees": { body: [] },
    "GET /superadmin/leave-types": { body: [] },
    "GET /superadmin/audit-log": { body: [] },
    "GET /superadmin/whatsapp-numbers": { body: [] },
    "GET /superadmin/government-ids": { body: PEOPLE },
  };

  beforeEach(() => sessionStorage.clear());

  it("lists who has submitted and who has not", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes(SUPERADMIN_ROUTES);
    renderWithProviders(<App />, "/superadmin");

    expect(await screen.findByText(/Aadhaar ending 0124, submitted 23 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText("Not submitted yet")).toBeInTheDocument();
    expect(screen.getByText("1 not submitted")).toBeInTheDocument();
  });

  it("shows the full number only after View is clicked", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    const fetchMock = mockRoutes({ ...SUPERADMIN_ROUTES, "GET /superadmin/government-ids/EMP-3": { body: FULL_ID } });
    renderWithProviders(<App />, "/superadmin");

    await screen.findByText(/Aadhaar ending 0124, submitted/);
    expect(screen.queryByText(VALID_AADHAAR)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "View" }));
    expect(await screen.findByText(VALID_AADHAAR)).toBeInTheDocument();
    expect(callsTo(fetchMock, "GET /superadmin/government-ids/EMP-3")).toHaveLength(1);
  });

  it("offers a back image for an Aadhaar but not for a PAN", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    mockRoutes({
      ...SUPERADMIN_ROUTES,
      "GET /superadmin/government-ids/EMP-3": { body: { ...FULL_ID, id_type: "pan", id_number: VALID_PAN, back_image_path: null } },
    });
    renderWithProviders(<App />, "/superadmin");

    await userEvent.click(await screen.findByRole("button", { name: "View" }));
    expect(await screen.findByRole("button", { name: "Open front image" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open back image" })).not.toBeInTheDocument();
  });

  it("asks for a confirmation before clearing an ID", async () => {
    storeSession({ role: "superadmin", attendanceAccess: "superadmin" });
    const fetchMock = mockRoutes({
      ...SUPERADMIN_ROUTES,
      "GET /superadmin/government-ids/EMP-3": { body: FULL_ID },
      "DELETE /superadmin/government-ids/EMP-3": { body: { emp_id: "EMP-3", full_name: "Ann Employee", message: "Ann Employee will be asked for a new government ID at their next login." } },
    });
    renderWithProviders(<App />, "/superadmin");

    await userEvent.click(await screen.findByRole("button", { name: "View" }));
    await userEvent.click(await screen.findByRole("button", { name: "Clear this ID" }));
    expect(callsTo(fetchMock, "DELETE /superadmin/government-ids/EMP-3")).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Yes, clear it" }));
    await waitFor(() => expect(callsTo(fetchMock, "DELETE /superadmin/government-ids/EMP-3")).toHaveLength(1));
    expect(await screen.findByText(/asked for a new government ID/)).toBeInTheDocument();
  });
});

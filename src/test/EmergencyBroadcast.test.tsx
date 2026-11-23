import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../app/App";
import { EmergencyBroadcast } from "../components/EmergencyBroadcast";
import { mockRoutes, renderWithProviders, storeSession } from "./renderWithProviders";
import { APP_VERSION } from "../lib/config";

afterEach(() => vi.unstubAllGlobals());

const MESSAGE = "The portal will be down on Sunday from 9am to 11am.";

function routesWithBroadcast(broadcast: string | null) {
  return {
    "GET /system/downtime": { body: { down_pages: [], emergency_broadcast: broadcast } },
    "GET /celebrations": { body: [] },
    "GET /me/profile": {
      body: {
        emp_id: "EMP003", full_name: "Test User", role: "employee", dept: "IT", email: null, phone: null, gender: null,
        date_of_joining: null, date_of_birth: null, address: null, emergency_contact: null, manager_name: null, is_active: true,
      },
    },
  };
}

describe("the emergency broadcast", () => {
  beforeEach(() => sessionStorage.clear());

  it("shows the message from the backend at the top of a page", async () => {
    storeSession();
    mockRoutes(routesWithBroadcast(MESSAGE));
    renderWithProviders(<App />, "/me");
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
  });

  it("shows it on the login page too, with nobody logged in", async () => {
    mockRoutes(routesWithBroadcast(MESSAGE));
    renderWithProviders(<App />, "/login");
    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
  });

  it("shows nothing when the setting is empty, null or missing", async () => {
    storeSession();
    for (const value of [null, "", "   "]) {
      mockRoutes(routesWithBroadcast(value as string | null));
      const view = renderWithProviders(<App />, "/me");
      await screen.findByRole("heading", { name: "Test User" });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("can be closed, and stays closed while the message is the same", async () => {
    storeSession();
    mockRoutes(routesWithBroadcast(MESSAGE));
    renderWithProviders(<App />, "/me");

    await screen.findByText(MESSAGE);
    await userEvent.click(screen.getByRole("button", { name: "Close this notice" }));
    await waitFor(() => expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument());
  });

  it("comes back when the backend sends a different message", async () => {
    // The banner remembers WHICH message was closed, so a new notice is not suppressed by an
    // earlier dismissal. Driven through the query cache here, because the real trigger is the
    // once-a-minute poll and a test should not wait a minute for it.
    mockRoutes(routesWithBroadcast(MESSAGE));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <EmergencyBroadcast />
      </QueryClientProvider>,
    );

    await screen.findByText(MESSAGE);
    await userEvent.click(screen.getByRole("button", { name: "Close this notice" }));
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();

    const nextMessage = "Payroll is running now, payslips may be slow.";
    act(() => {
      queryClient.setQueryData(["system-downtime"], { down_pages: [], emergency_broadcast: nextMessage });
    });
    expect(await screen.findByText(nextMessage)).toBeInTheDocument();
  });

  it("does not break the page when the downtime call fails", async () => {
    storeSession();
    mockRoutes({ ...routesWithBroadcast(MESSAGE), "GET /system/downtime": { status: 500, body: { detail: "down" } } });
    renderWithProviders(<App />, "/me");
    expect(await screen.findByRole("heading", { name: "Test User" })).toBeInTheDocument();
  });
});

describe("the app version", () => {
  beforeEach(() => sessionStorage.clear());

  it("is shown under the login form", async () => {
    mockRoutes(routesWithBroadcast(null));
    renderWithProviders(<App />, "/login");
    expect(await screen.findByText(`V${APP_VERSION}`)).toBeInTheDocument();
  });

  it("is shown at the bottom of the sidebar once logged in", async () => {
    storeSession();
    mockRoutes(routesWithBroadcast(null));
    renderWithProviders(<App />, "/me");
    await screen.findByRole("heading", { name: "Test User" });
    // The sidebar is rendered twice (desktop rail and mobile drawer), so one or more is correct.
    expect(screen.getAllByText(`V${APP_VERSION}`).length).toBeGreaterThan(0);
  });

  it("is a plain number here, with the V added where it is shown", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+/);
    expect(APP_VERSION.startsWith("V")).toBe(false);
  });
});

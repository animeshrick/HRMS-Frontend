import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { AuthProvider } from "../app/AuthContext";

export function renderWithProviders(element: ReactNode, startPath = "/") {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[startPath]}>
        <AuthProvider>{element}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export function storeSession(overrides: Partial<Record<string, unknown>> = {}) {
  sessionStorage.setItem(
    "hr-assistant-session",
    JSON.stringify({
      accessToken: "token",
      role: "employee",
      fullName: "Test User",
      employeeId: "EMP003",
      mustChangePassword: false,
      attendanceAccess: "employee",
      ...overrides,
    }),
  );
}

type RouteReply = { status?: number; body: unknown };

/** Replaces fetch with a fake that answers by "METHOD /path". Returns the fake so a test can look at the calls. */
export function mockRoutes(routes: Record<string, RouteReply | ((request: { body: unknown; init: RequestInit }) => RouteReply)>) {
  // The layout loads these on its own on every page: an empty answer unless the test gives one.
  routes = {
    "GET /chat/history": { body: [] },
    "GET /leave/mine": { body: [] },
    "GET /attendance/corrections/mine": { body: [] },
    "GET /system/downtime": { body: { down_pages: [] } },
    "GET /messages/conversations": { body: [] },
    // The profile page and the super admin page each read one of these on their own.
    "GET /government-id": { body: { submitted: true, required: true, id_type: "aadhaar", masked_number: "Aadhaar ending 0124", submitted_at: "2026-11-23T10:00:00+00:00" } },
    "GET /superadmin/government-ids": { body: [] },
    ...routes,
  };
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = String(url).replace(/^\/api/, "");
    const key = `${init.method ?? "GET"} ${path}`;
    const route = routes[key];
    if (!route) {
      return new Response(JSON.stringify({ detail: `No fake for ${key}` }), { status: 500 });
    }
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    const reply = typeof route === "function" ? route({ body, init }) : route;
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// The AI assistant now lives in the floating widget (see AiChatWidget.tsx) instead of its own
// "/chat" route, so a test that needs the chat panel open must click its FAB first.
export async function openChatWidget() {
  await userEvent.click(await screen.findByRole("button", { name: "Open chat" }));
}

export function callsTo(fetchMock: ReturnType<typeof vi.fn>, key: string) {
  return fetchMock.mock.calls.filter(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url).replace(/^\/api/, "")}` === key);
}

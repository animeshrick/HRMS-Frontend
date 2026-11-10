import { afterEach, vi } from "vitest";
import { apiRequest, setUnauthorizedHandler } from "./client";
import { ApiError } from "../lib/errors";

function mockFetchOnce(status: number, body: unknown, isJson = true) {
  const text = isJson ? JSON.stringify(body) : String(body);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(text, { status })));
}

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe("apiRequest", () => {
  it("returns the JSON body and sends the token", async () => {
    mockFetchOnce(200, { status: "ok" });
    const result = await apiRequest<{ status: string }>("/health", { token: "abc" });
    expect(result.status).toBe("ok");
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/health");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc");
  });

  it("turns a detail string into an ApiError with the status", async () => {
    mockFetchOnce(403, { detail: "Only HR can do this." });
    await expect(apiRequest("/register", { method: "POST", body: {}, token: "t" })).rejects.toMatchObject({
      status: 403,
      message: "Only HR can do this.",
    });
  });

  it("maps 422 validation details to field errors", async () => {
    mockFetchOnce(422, { detail: [{ loc: ["body", "question"], msg: "String should have at most 1000 characters" }] });
    const caughtError: unknown = await apiRequest("/chat", { method: "POST", body: {} }).catch((caught: unknown) => caught);
    expect((caughtError as ApiError).fieldErrors.question).toMatch(/at most 1000/);
  });

  it("calls the unauthorized handler on 401 with a token", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { detail: "Your session has expired" });
    await expect(apiRequest("/chat", { token: "old" })).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not log out on a 401 that is about a typed password", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { detail: "Your current password is not correct.", code: "wrong_current_password" });
    await expect(apiRequest("/change-password", { token: "t" })).rejects.toMatchObject({ code: "wrong_current_password" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("logs out on a 401 with the session_expired code", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetchOnce(401, { detail: "expired", code: "session_expired" });
    await expect(apiRequest("/chat", { token: "t" })).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
  });

  it("reads the Retry-After header of a 429", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: "Too many failed attempts.", code: "too_many_attempts" }), { status: 429, headers: { "Retry-After": "900" } })));
    await expect(apiRequest("/login", { method: "POST", body: {} })).rejects.toMatchObject({ status: 429, retryAfterSeconds: 900 });
  });

  it("sends a file as the raw body with its own content type", async () => {
    mockFetchOnce(200, { document_path: "3/a.pdf" });
    const file = new File(["pdf"], "a.pdf", { type: "application/pdf" });
    await apiRequest("/leave/documents?filename=a.pdf", { method: "POST", token: "t", rawBody: file, contentType: file.type });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/pdf");
    expect(init.body).toBe(file);
  });

  it("does not crash on a non-JSON error page", async () => {
    mockFetchOnce(502, "<html>Bad Gateway</html>", false);
    await expect(apiRequest("/chat")).rejects.toMatchObject({ status: 502 });
  });

  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(apiRequest("/health")).rejects.toMatchObject({ kind: "network" });
  });

  it("reports a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      ),
    );
    await expect(apiRequest("/health", { timeoutMilliseconds: 10 })).rejects.toMatchObject({ kind: "timeout" });
  });

  it("reports a user cancel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      ),
    );
    const controller = new AbortController();
    const pending = apiRequest("/chat", { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });
});

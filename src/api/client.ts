// The only place that calls fetch. It adds the base URL, the login token, a timeout and
// turns every failure into an ApiError, so pages never deal with raw fetch problems.
import { API_BASE_URL, REQUEST_TIMEOUT_MILLISECONDS } from "../lib/config";
import { ApiError } from "../lib/errors";

// AuthContext registers a function here that logs the user out when the server says the token is no longer valid.
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export interface RequestOptions {
  method?: "GET" | "POST";
  rawBody?: BodyInit; // a file to send as is (uploads); then contentType is required
  contentType?: string;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal; // lets a Cancel button stop the request
  timeoutMilliseconds?: number;
}

// A 401 with one of these codes is about the typed password, not about the session, so the user stays logged in.
const CODES_THAT_KEEP_THE_SESSION = ["wrong_current_password", "invalid_credentials"];

function buildHttpError(status: number, payload: unknown, retryAfterHeader: string | null): ApiError {
  const detail = (payload as { detail?: unknown } | null)?.detail;
  const rawCode = (payload as { code?: unknown } | null)?.code;
  const code = typeof rawCode === "string" ? rawCode : null;
  const retryAfterSeconds = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : null;

  // Our own errors look like {"detail": "message"}.
  if (typeof detail === "string") {
    return new ApiError("http", detail, status, {}, code, retryAfterSeconds);
  }

  // Validation errors (422) look like {"detail": [{"loc": ["body", "question"], "msg": "..."}]}.
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail) {
      const location: unknown[] = Array.isArray(item?.loc) ? item.loc : [];
      const fieldName = String(location[location.length - 1] ?? "request");
      fieldErrors[fieldName] = String(item?.msg ?? "Invalid value.");
    }
    return new ApiError("http", "Please check what you entered.", status, fieldErrors, code, retryAfterSeconds);
  }

  return new ApiError("http", `The server returned an error (${status}).`, status, {}, code, retryAfterSeconds);
}

export async function apiRequest<ResponseType>(path: string, options: RequestOptions = {}): Promise<ResponseType> {
  const timeoutMilliseconds = options.timeoutMilliseconds ?? REQUEST_TIMEOUT_MILLISECONDS;

  // One controller handles both the timeout and the caller's Cancel button.
  const controller = new AbortController();
  let hasTimedOut = false;
  const timerId = setTimeout(() => {
    hasTimedOut = true;
    controller.abort();
  }, timeoutMilliseconds);
  options.signal?.addEventListener("abort", () => controller.abort());

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.rawBody !== undefined && options.contentType) {
    headers["Content-Type"] = options.contentType;
  }
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.rawBody !== undefined ? options.rawBody : options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    if (hasTimedOut) {
      throw new ApiError("timeout", "The request timed out.");
    }
    if (options.signal?.aborted) {
      throw new ApiError("aborted", "The request was cancelled.");
    }
    throw new ApiError("network", "The server could not be reached.");
  } finally {
    clearTimeout(timerId);
  }

  // Read the body as text first: an error page from a proxy may not be JSON.
  const rawText = await response.text();
  let payload: unknown = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const httpError = buildHttpError(response.status, payload, response.headers.get("Retry-After"));
    if (response.status === 401 && options.token && !CODES_THAT_KEEP_THE_SESSION.includes(httpError.code ?? "")) {
      unauthorizedHandler?.();
    }
    throw httpError;
  }

  return payload as ResponseType;
}

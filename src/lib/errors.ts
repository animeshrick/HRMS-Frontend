// One error type for every failed API call, and one place that turns it into a friendly message.

export type ApiErrorKind = "network" | "timeout" | "aborted" | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null; // HTTP status code, or null when no answer came back
  readonly fieldErrors: Record<string, string>; // for 422: which input has which problem
  readonly code: string | null; // short reason from the backend, for example "session_expired"
  readonly retryAfterSeconds: number | null; // from the Retry-After header of a 429

  constructor(
    kind: ApiErrorKind,
    message: string,
    status: number | null = null,
    fieldErrors: Record<string, string> = {},
    code: string | null = null,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** The sentence shown to the user. Raw technical text from the server is never shown for server crashes. */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return GENERIC_MESSAGE;
  }

  switch (error.kind) {
    case "network":
      return "Cannot reach the server. Check your internet connection and try again.";
    case "timeout":
      return "The server took too long to answer. Please try again.";
    case "aborted":
      return "The request was cancelled.";
  }

  const status = error.status ?? 0;
  if (status === 502) {
    // Our backend sends a friendly message for 502 ("The assistant could not answer right now...").
    return error.message;
  }
  if (status >= 500) {
    return "The server had a problem. Please try again in a moment.";
  }
  if (status === 429 && error.retryAfterSeconds) {
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    return `Too many failed attempts. Please wait about ${minutes} minute${minutes === 1 ? "" : "s"} and try again.`;
  }
  if (status === 422) {
    const firstFieldMessage = Object.values(error.fieldErrors)[0];
    return firstFieldMessage ?? "Please check what you entered.";
  }
  return error.message || GENERIC_MESSAGE;
}

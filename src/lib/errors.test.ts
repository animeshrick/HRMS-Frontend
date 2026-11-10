import { ApiError, describeError } from "./errors";

describe("describeError", () => {
  it("explains network and timeout problems", () => {
    expect(describeError(new ApiError("network", "x"))).toMatch(/Cannot reach/);
    expect(describeError(new ApiError("timeout", "x"))).toMatch(/too long/);
  });
  it("hides raw text for server crashes but keeps the friendly 502 message", () => {
    expect(describeError(new ApiError("http", "Traceback...", 500))).toMatch(/server had a problem/);
    expect(describeError(new ApiError("http", "The assistant could not answer right now.", 502))).toBe(
      "The assistant could not answer right now.",
    );
  });
  it("shows the first field message for 422", () => {
    expect(describeError(new ApiError("http", "x", 422, { question: "Too long." }))).toBe("Too long.");
  });
  it("shows the server message for 400, 401, 403 and 429", () => {
    expect(describeError(new ApiError("http", "Only HR can do this.", 403))).toBe("Only HR can do this.");
  });
  it("turns a 429 with Retry-After into minutes", () => {
    expect(describeError(new ApiError("http", "x", 429, {}, "too_many_attempts", 900))).toMatch(/wait about 15 minutes/);
  });
  it("uses a generic message for unknown errors", () => {
    expect(describeError(new Error("boom"))).toMatch(/Something went wrong/);
  });
});

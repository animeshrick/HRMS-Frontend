import { validateEmployeeId, validateNewPassword, validateQuestion } from "./validation";

describe("validateEmployeeId", () => {
  it("rejects empty and blank ids", () => {
    expect(validateEmployeeId("")).not.toBeNull();
    expect(validateEmployeeId("   ")).not.toBeNull();
  });
  it("accepts a normal id", () => {
    expect(validateEmployeeId("EMP001")).toBeNull();
  });
  it("rejects an id that is too long", () => {
    expect(validateEmployeeId("E".repeat(51))).not.toBeNull();
  });
});

describe("validateNewPassword", () => {
  it("rejects fewer than 10 characters", () => {
    expect(validateNewPassword("short", "old")).toMatch(/at least 10/);
  });
  it("rejects more than 72 bytes", () => {
    expect(validateNewPassword("a".repeat(73), "old")).toMatch(/too long/);
  });
  it("rejects the same password as the current one", () => {
    expect(validateNewPassword("SamePassword1", "SamePassword1")).toMatch(/different/);
  });
  it("accepts a good password", () => {
    expect(validateNewPassword("A-good-password-1", "old")).toBeNull();
  });
});

describe("validateQuestion", () => {
  it("rejects blank and too long questions", () => {
    expect(validateQuestion("   ")).not.toBeNull();
    expect(validateQuestion("q".repeat(1001))).not.toBeNull();
  });
  it("accepts a normal question", () => {
    expect(validateQuestion("How many leaves?")).toBeNull();
  });
});

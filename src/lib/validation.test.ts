import {
  cleanGovernmentIdNumber,
  validateEmployeeId,
  validateGovernmentIdImage,
  validateGovernmentIdNumber,
  validateNewPassword,
  validateQuestion,
} from "./validation";

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


describe("government ID numbers", () => {
  it("accepts a valid Aadhaar number, with or without the gaps people type", () => {
    expect(validateGovernmentIdNumber("aadhaar", "234567890124")).toBeNull();
    expect(validateGovernmentIdNumber("aadhaar", "2345 6789 0124")).toBeNull();
    expect(validateGovernmentIdNumber("aadhaar", "2345-6789-0124")).toBeNull();
  });

  it("refuses an Aadhaar number of the wrong length, or one that fails its check digit", () => {
    expect(validateGovernmentIdNumber("aadhaar", "23456789012")).toMatch("12 digits");
    expect(validateGovernmentIdNumber("aadhaar", "234567890123")).toMatch("not valid");
    expect(validateGovernmentIdNumber("aadhaar", "123456789012")).toMatch("0 or 1");
    expect(validateGovernmentIdNumber("aadhaar", "")).toMatch("Enter your Aadhaar number.");
  });

  it("accepts a PAN number in any case and refuses a wrong shape", () => {
    expect(validateGovernmentIdNumber("pan", "abcde1234f")).toBeNull();
    expect(validateGovernmentIdNumber("pan", "ABCDE1234F")).toBeNull();
    expect(validateGovernmentIdNumber("pan", "ABCD12345F")).toMatch("ABCDE1234F");
    expect(validateGovernmentIdNumber("pan", "")).toMatch("Enter your PAN number.");
  });

  it("cleans a number the same way the backend does", () => {
    expect(cleanGovernmentIdNumber("aadhaar", " 2345 6789 0124 ")).toBe("234567890124");
    expect(cleanGovernmentIdNumber("pan", "abcde1234f")).toBe("ABCDE1234F");
  });

  it("allows a PNG, JPG or PDF of at most 5 MB", () => {
    const png = new File([new Uint8Array([1, 2, 3])], "front.png", { type: "image/png" });
    expect(validateGovernmentIdImage(png)).toBeNull();

    const wrongType = new File([new Uint8Array([1])], "front.txt", { type: "text/plain" });
    expect(validateGovernmentIdImage(wrongType)).toMatch("PNG, JPG or PDF");

    const empty = new File([], "front.png", { type: "image/png" });
    expect(validateGovernmentIdImage(empty)).toMatch("empty");

    const tooBig = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "front.png", { type: "image/png" });
    expect(validateGovernmentIdImage(tooBig)).toMatch("5 MB");
  });
});

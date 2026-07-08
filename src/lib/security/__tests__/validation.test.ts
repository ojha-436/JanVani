import {
  sanitizeText,
  sanitizeLine,
  withinUploadLimit,
  isValidEmail,
  MAX_TEXT_LEN,
  MAX_UPLOAD_BYTES,
} from "@/lib/security/validation";

describe("security/validation", () => {
  it("sanitizeText strips control chars but keeps tab/newline", () => {
    // NUL (0) and BEL (7) are dropped; tab (9) and newline (10) survive.
    const dirty = "a" + String.fromCharCode(0) + "b" + String.fromCharCode(7) + "c\td\ne";
    expect(sanitizeText(dirty)).toBe("abc\td\ne");
  });

  it("sanitizeText trims and caps length", () => {
    expect(sanitizeText("   hi   ")).toBe("hi");
    expect(sanitizeText("x".repeat(MAX_TEXT_LEN + 100)).length).toBe(MAX_TEXT_LEN);
  });

  it("sanitizeText coerces non-strings safely", () => {
    expect(sanitizeText(null)).toBe("");
    expect(sanitizeText(undefined)).toBe("");
    expect(sanitizeText(42)).toBe("42");
  });

  it("sanitizeLine removes line breaks and collapses whitespace", () => {
    expect(sanitizeLine("a\n\n  b\tc")).toBe("a b c");
  });

  it("withinUploadLimit enforces the cap and rejects bad values", () => {
    expect(withinUploadLimit(0)).toBe(true);
    expect(withinUploadLimit(MAX_UPLOAD_BYTES)).toBe(true);
    expect(withinUploadLimit(MAX_UPLOAD_BYTES + 1)).toBe(false);
    expect(withinUploadLimit(-1)).toBe(false);
    expect(withinUploadLimit(Number.NaN)).toBe(false);
  });

  it("isValidEmail accepts real addresses and rejects malformed/oversized", () => {
    expect(isValidEmail("mp@example.gov.in")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("x".repeat(300) + "@a.com")).toBe(false);
  });
});

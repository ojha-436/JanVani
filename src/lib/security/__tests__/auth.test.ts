import {
  getAdminKey,
  constantTimeEqual,
  extractAdminKey,
  isAdmin,
  requireAdmin,
} from "@/lib/security/auth";

const KEY = "super-secret-admin-key-123"; // >= 12 chars

describe("security/auth", () => {
  const orig = process.env.MP_ADMIN_KEY;
  afterEach(() => {
    if (orig === undefined) delete process.env.MP_ADMIN_KEY;
    else process.env.MP_ADMIN_KEY = orig;
  });

  it("getAdminKey returns null when unset (fail closed)", () => {
    delete process.env.MP_ADMIN_KEY;
    expect(getAdminKey()).toBeNull();
  });

  it("getAdminKey rejects a too-short key", () => {
    process.env.MP_ADMIN_KEY = "short";
    expect(getAdminKey()).toBeNull();
  });

  it("getAdminKey returns a valid configured key", () => {
    process.env.MP_ADMIN_KEY = KEY;
    expect(getAdminKey()).toBe(KEY);
  });

  it("constantTimeEqual matches equal strings, rejects different ones", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false); // unequal length is safe
  });

  it("isAdmin fails closed when no key is configured", () => {
    delete process.env.MP_ADMIN_KEY;
    expect(isAdmin(KEY)).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("isAdmin accepts the correct key and rejects wrong/empty", () => {
    process.env.MP_ADMIN_KEY = KEY;
    expect(isAdmin(KEY)).toBe(true);
    expect(isAdmin("wrong-but-long-enough")).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });

  it("extractAdminKey prefers the x-admin-key header", () => {
    const req = new Request("https://x/api?adminKey=fromquery", {
      headers: { "x-admin-key": "fromheader" },
    });
    expect(extractAdminKey(req)).toBe("fromheader");
  });

  it("extractAdminKey falls back to body value, then query", () => {
    expect(extractAdminKey(new Request("https://x/api"), "frombody")).toBe("frombody");
    expect(extractAdminKey(new Request("https://x/api?adminKey=fromquery"))).toBe("fromquery");
    expect(extractAdminKey(new Request("https://x/api"))).toBeNull();
  });

  it("requireAdmin authorises a correct header key and blocks a wrong one", () => {
    process.env.MP_ADMIN_KEY = KEY;
    const ok = new Request("https://x/api", { headers: { "x-admin-key": KEY } });
    const bad = new Request("https://x/api", { headers: { "x-admin-key": "nope-nope-nope" } });
    expect(requireAdmin(ok)).toBe(true);
    expect(requireAdmin(bad)).toBe(false);
  });
});

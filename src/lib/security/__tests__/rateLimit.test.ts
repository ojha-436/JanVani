import { rateLimit, clientKey, __resetRateLimits } from "@/lib/security/rateLimit";

describe("security/rateLimit", () => {
  beforeEach(() => __resetRateLimits());

  it("allows up to the limit within a window, then blocks", () => {
    const t = 1000;
    expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t).ok).toBe(true);
    expect(rateLimit("k", 3, 1000, t).ok).toBe(false);
  });

  it("resets after the window elapses", () => {
    expect(rateLimit("k", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("k", 1, 1000, 500).ok).toBe(false);
    expect(rateLimit("k", 1, 1000, 1000).ok).toBe(true);
  });

  it("tracks distinct keys independently", () => {
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("b", 1, 1000, 0).ok).toBe(true);
    expect(rateLimit("a", 1, 1000, 0).ok).toBe(false);
  });

  it("reports remaining budget", () => {
    expect(rateLimit("r", 5, 1000, 0).remaining).toBe(4);
  });

  it("clientKey derives from the first x-forwarded-for IP", () => {
    const req = new Request("https://x/api", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientKey(req, "submit")).toBe("submit:1.2.3.4");
  });

  it("clientKey falls back to unknown when no proxy header", () => {
    expect(clientKey(new Request("https://x/api"), "s")).toBe("s:unknown");
  });
});

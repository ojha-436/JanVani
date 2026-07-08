import { categoryBand, fallbackEstimate, formatINR } from "@/lib/estimate";

describe("estimate", () => {
  it("categoryBand returns a known band and falls back to Other", () => {
    expect(categoryBand("Roads & transport").low).toBe(800_000);
    expect(categoryBand("Nonexistent Category")).toEqual(categoryBand("Other"));
  });

  it("fallbackEstimate produces a well-formed, category-level estimate", () => {
    const est = fallbackEstimate({ category: "Water & sanitation", area: "Meskaur" }, "2026-07-08T00:00:00Z");
    expect(est.source).toBe("fallback");
    expect(est.confidence).toBe("low");
    expect(est.costLow).toBeLessThanOrEqual(est.costHigh);
    expect(est.timelineWeeks.low).toBeLessThanOrEqual(est.timelineWeeks.high);
    expect(est.boq.length).toBeGreaterThan(0);
    expect(est.eligibility.mplads).toBe(true);
    expect(est.generatedAt).toBe("2026-07-08T00:00:00Z");
    expect(est.scope).toContain("Meskaur");
  });

  it("flags 'Other' as needing an MPLADS eligibility check", () => {
    expect(fallbackEstimate({ category: "Other" }, "t").eligibility.mplads).toBe(false);
  });

  it("formatINR renders crore / lakh / plain and handles NaN", () => {
    expect(formatINR(12_000_000)).toBe("₹1.20 Cr");
    expect(formatINR(480_000)).toBe("₹4.8 L");
    expect(formatINR(12_000)).toContain("12,000");
    expect(formatINR(Number.NaN)).toBe("—");
  });
});

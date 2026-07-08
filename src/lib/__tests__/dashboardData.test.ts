import {
  DEFAULT_WEIGHTS,
  FACTOR_ORDER,
  WORK_STATUSES,
  STATUS_META,
  scoreWork,
  confidence,
  type Factors,
} from "@/lib/dashboardData";

const ALL = (v: number): Factors => ({ D: v, G: v, P: v, E: v, C: v, F: v, M: v });

describe("dashboardData scoring", () => {
  it("has 7 factors whose default weights sum to 100", () => {
    expect(FACTOR_ORDER.length).toBe(7);
    expect(FACTOR_ORDER.reduce((n, k) => n + DEFAULT_WEIGHTS[k], 0)).toBe(100);
  });

  it("STATUS_META covers every work status with a citizen label", () => {
    for (const s of WORK_STATUSES) {
      expect(STATUS_META[s]).toBeDefined();
      expect(typeof STATUS_META[s].citizenLabel).toBe("string");
    }
  });

  it("scoreWork maps all-1 to 100 and all-0 to 0", () => {
    expect(scoreWork(ALL(1), DEFAULT_WEIGHTS)).toBe(100);
    expect(scoreWork(ALL(0), DEFAULT_WEIGHTS)).toBe(0);
  });

  it("scoreWork stays within 0..100 when a factor is missing (older snapshot)", () => {
    const partial = { D: 1, G: 1, P: 1, E: 1, C: 1, F: 1 } as unknown as Factors; // no M
    const s = scoreWork(partial, DEFAULT_WEIGHTS);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it("confidence buckets on corroboration + demand", () => {
    expect(confidence({ D: 1, G: 0, P: 0, E: 0, C: 1, F: 0, M: 0 })).toBe("high");
    expect(confidence(ALL(0))).toBe("low");
  });
});

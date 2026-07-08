import {
  CONSTITUENCIES,
  CONSTITUENCIES_BY_STATE,
  isKnownConstituency,
  resolveConstituency,
  constituencyLabel,
} from "@/lib/constituencies";

describe("constituencies", () => {
  it("holds the full official Lok Sabha set (543)", () => {
    expect(CONSTITUENCIES.length).toBe(543);
  });

  it("every constituency has a positive number, name and state", () => {
    for (const c of CONSTITUENCIES) {
      expect(c.no).toBeGreaterThan(0);
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.state.length).toBeGreaterThan(0);
    }
  });

  it("grouping by state preserves the total and covers many states", () => {
    const total = CONSTITUENCIES_BY_STATE.reduce((n, g) => n + g.items.length, 0);
    expect(total).toBe(543);
    expect(CONSTITUENCIES_BY_STATE.length).toBeGreaterThan(20);
  });

  it("resolveConstituency is case/whitespace tolerant and canonicalises", () => {
    expect(resolveConstituency("  nawada ")?.name).toBe("Nawada");
    expect(resolveConstituency("Not A Real PC")).toBeNull();
  });

  it("isKnownConstituency reflects membership", () => {
    expect(isKnownConstituency("Nawada")).toBe(true);
    expect(isKnownConstituency("Definitely Not A PC")).toBe(false);
  });

  it("constituencyLabel shows the number and name", () => {
    const nawada = resolveConstituency("Nawada")!;
    const label = constituencyLabel(nawada);
    expect(label).toContain("Nawada");
    expect(label).toContain(String(nawada.no));
  });
});

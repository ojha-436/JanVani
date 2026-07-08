import { deriveWorkId } from "@/lib/queries";
import { computeRanking, type SubmissionRow } from "@/lib/ranking";

/* Guards the (previously fragile) coupling between the citizen "Your
   queries" work-id derivation and the id scheme the ranking engine
   actually assigns. If either drifts, a citizen would stop seeing the
   MP's action status on the need they raised — so pin it with a test. */
describe("deriveWorkId <-> ranking id coupling", () => {
  it("derives the theme-<category>-<area> scheme", () => {
    expect(deriveWorkId("Roads & transport", "Rajauli")).toBe("theme-roads-transport-rajauli");
    expect(deriveWorkId("Health", "Hisua")).toBe("theme-health-hisua");
  });

  it("matches the id the ranking engine assigns a citizen submission", () => {
    const subs: SubmissionRow[] = [
      {
        id: "1",
        citizenKey: "c1",
        category: "Water & sanitation",
        need_en: "Piped water",
        urgency: 1,
        area: "Meskaur",
        locale: "en",
        anonymous: true,
        createdAt: "2026-07-01T00:00:00Z",
      },
    ];
    const res = computeRanking(subs, "2026-07-06T00:00:00Z");
    const derived = deriveWorkId("Water & sanitation", "Meskaur");
    expect(res.works.some((w) => w.id === derived)).toBe(true);
  });
});

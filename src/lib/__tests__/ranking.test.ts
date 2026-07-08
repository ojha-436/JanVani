import { computeRanking, type SubmissionRow } from '../ranking';

describe('Ranking Engine', () => {
  it('should cluster multiple submissions in the same area and category', () => {
    const subs: SubmissionRow[] = [
      { id: '1', citizenKey: 'c1', category: 'Health', need_en: 'Need doctor', urgency: 1.0, area: 'Hisua', locale: 'en', anonymous: false, createdAt: '2026-07-01T00:00:00Z' },
      { id: '2', citizenKey: 'c2', category: 'Health', need_en: 'Need hospital', urgency: 0.8, area: 'Hisua', locale: 'en', anonymous: true, createdAt: '2026-07-02T00:00:00Z' },
    ];
    
    const result = computeRanking(subs, '2026-07-06T00:00:00Z');
    
    // Should have 1 theme for these two submissions
    const healthTheme = result.works.find(w => w.id === 'theme-health-hisua');
    expect(healthTheme).toBeDefined();
    expect(healthTheme?.demand).toBe(2);
    expect(healthTheme?.source).toBe('citizen');
  });

  it('should deduplicate submissions from the same citizen keeping highest urgency', () => {
    const subs: SubmissionRow[] = [
      { id: '1', citizenKey: 'c1', category: 'Education', need_en: 'School', urgency: 0.5, area: 'Nawada town', locale: 'en', anonymous: false, createdAt: '2026-07-01T00:00:00Z' },
      { id: '2', citizenKey: 'c1', category: 'Education', need_en: 'School please', urgency: 1.0, area: 'Nawada town', locale: 'en', anonymous: false, createdAt: '2026-07-02T00:00:00Z' },
    ];

    const result = computeRanking(subs, '2026-07-06T00:00:00Z');
    
    const eduTheme = result.works.find(w => w.id === 'theme-education-nawada-town');
    expect(eduTheme).toBeDefined();
    // Deduped to 1 unique citizen
    expect(eduTheme?.demand).toBe(1); 
  });

  it('should include predefined plan candidates even without citizen demand', () => {
    const result = computeRanking([], '2026-07-06T00:00:00Z');
    
    // There are PLAN_CANDIDATES in ranking.ts, such as 'plan-anganwadi-hisua'
    const planWork = result.works.find(w => w.id === 'plan-anganwadi-hisua');
    expect(planWork).toBeDefined();
    expect(planWork?.source).toBe('plan');
    expect(planWork?.demand).toBe(0);
  });

  it('keeps the same need in different areas as separate works', () => {
    const subs: SubmissionRow[] = [
      { id: '1', citizenKey: 'c1', category: 'Roads & transport', need_en: 'Road', urgency: 1, area: 'Rajauli', locale: 'en', anonymous: true, createdAt: '2026-07-01T00:00:00Z' },
      { id: '2', citizenKey: 'c2', category: 'Roads & transport', need_en: 'Road', urgency: 1, area: 'Hisua', locale: 'en', anonymous: true, createdAt: '2026-07-01T00:00:00Z' },
    ];
    const result = computeRanking(subs, '2026-07-06T00:00:00Z');
    expect(result.works.find(w => w.id === 'theme-roads-transport-rajauli')).toBeDefined();
    expect(result.works.find(w => w.id === 'theme-roads-transport-hisua')).toBeDefined();
  });

  it('assigns every work a unique id and 0..1 factor values', () => {
    const result = computeRanking([], '2026-07-06T00:00:00Z');
    const ids = result.works.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length); // unique
    for (const w of result.works) {
      for (const v of Object.values(w.factors)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

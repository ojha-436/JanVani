import {
  nearestArea,
  maxDeficitArea,
  resolveAreaName,
  areaCentroid,
  AREA_NAMES,
  CONSTITUENCY_META,
} from "@/lib/publicData";

describe("publicData area resolution", () => {
  it("nearestArea returns the same area for a GPS fix right next to its centroid", () => {
    const target = "Nawada town";
    const c = areaCentroid(target);
    expect(nearestArea({ lat: c.lat + 0.001, lng: c.lng + 0.001 })).toBe(target);
  });

  it("nearestArea always returns a known area, even for far-away coords", () => {
    const near = nearestArea({ lat: 28.6, lng: 77.2 }); // Delhi, far outside the constituency
    expect(AREA_NAMES).toContain(near);
  });

  it("resolveAreaName keeps known names and defaults unknown ones to the centre", () => {
    expect(resolveAreaName(AREA_NAMES[0])).toBe(AREA_NAMES[0]);
    expect(resolveAreaName("Nowhere-ville")).toBe("Nawada town");
  });

  it("maxDeficitArea returns a known area for each category", () => {
    expect(AREA_NAMES).toContain(maxDeficitArea("Water & sanitation"));
    expect(AREA_NAMES).toContain(maxDeficitArea("Health"));
    expect(AREA_NAMES).toContain(maxDeficitArea("Roads & transport"));
  });

  it("exposes the constituency metadata", () => {
    expect(CONSTITUENCY_META.name).toBe("Nawada");
    expect(CONSTITUENCY_META.state).toBe("Bihar");
  });
});

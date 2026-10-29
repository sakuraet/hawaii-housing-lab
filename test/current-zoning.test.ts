// The "current" pathway: current zoning in any county. In Honolulu it is the
// bill6 pathway under another name; elsewhere it reads each zone's `current`
// rules, which can limit density by FAR, by lot area per unit, by both, or by
// neither (height and coverage alone).

import { describe, expect, it } from "vitest";

import { calcParcel, pathwayEnvelope, type Parcel } from "../src";
import { checkLocality } from "../src/core/check";
import type { Locality, ZoneRules } from "../src/core/locality";
import { flat } from "../src/core/schedule";
import { currentLimits } from "../src/core/zoning";
import { registerLocality } from "../src/localities";
import { maui } from "../src/localities/hi/maui";

describe("Honolulu: current is bill6", () => {
  const parcels: Parcel[] = [
    { lot_sqft: 20000, zone_class: "A-2", height: 60 },
    { lot_sqft: 10000, zone_class: "BMX-3", height: 60 },
    { lot_sqft: 10000, zone_class: "BMX-4", height: 350 },
    { lot_sqft: 7500, zone_class: "AMX-2", height: 40, parking_exempt: true },
  ];

  it.each(parcels)("$zone_class: same envelope and results", (p) => {
    expect(pathwayEnvelope("current", p)).toEqual(pathwayEnvelope("bill6", p));
    expect(calcParcel("current", p)).toEqual(calcParcel("bill6", p));
  });
});

// a test county: Maui's rules, with districts that limit density each way
const district = (current: ZoneRules["current"]): ZoneRules => ({
  current,
  commercial_coverage: 0,
  bicycle_required: false,
  residential_permitted: true,
  source: "test",
});

const testCounty: Locality = {
  ...(JSON.parse(JSON.stringify(maui)) as Locality),
  id: "zz-generic",
  name: "Test County (generic current zoning)",
};
testCounty.rules.zones = {
  ...testCounty.rules.zones,
  // 1 unit per 3,000 sqft of lot, no FAR (like a county's RM-3)
  "RM-3": district({ lot_area_per_unit: flat(3000, "test"), lot_coverage: flat(0.4, "test") }),
  // FAR 0.5 and 1 unit per 1,000 or 2,000 sqft: the stricter limit governs
  "FAR-D1": district({
    far: flat(0.5, "test"),
    lot_area_per_unit: flat(1000, "test"),
    lot_coverage: flat(0.5, "test"),
  }),
  "FAR-D2": district({
    far: flat(0.5, "test"),
    lot_area_per_unit: flat(2000, "test"),
    lot_coverage: flat(0.5, "test"),
  }),
  // no FAR or density limit: height, coverage and setbacks only
  ENV: district({ lot_coverage: flat(0.5, "test") }),
  "ENV-FAR": district({ far: flat(0.25, "test"), lot_coverage: flat(0.5, "test") }),
};
registerLocality(testCounty);

const run = (zone_class: string, lot_sqft: number, height: number) =>
  calcParcel("current", { locality: testCounty.id, zone_class, lot_sqft, height });

describe("density by lot area per unit", () => {
  it("units are the lot area over the area per unit, rounded down", () => {
    expect(currentLimits(testCounty, "RM-3", 20000)).toEqual({
      far: Infinity,
      max_units: 6,
      lot_coverage: 0.4,
    });
    expect(currentLimits(testCounty, "RM-3", 18000).max_units).toBe(6);
    expect(currentLimits(testCounty, "RM-3", 2999).max_units).toBe(0);
  });

  it("the envelope carries the unit cap and no FAR", () => {
    const e = pathwayEnvelope("current", { locality: testCounty.id, zone_class: "RM-3", lot_sqft: 20000, height: 45 });
    expect(e.max_far).toBe(Infinity);
    expect(e.max_units).toBe(6);
  });

  it("a parcel builds only the units the density allows", () => {
    const r = run("RM-3", 20000, 45);
    expect(r.max_units).toBe(6);
    // 6 one-bedrooms of 500 sqft at 80% efficiency
    expect(r.buildable_sqft).toBeCloseTo((6 * 500) / 0.8, 3);
    expect(r.parking_stalls).toBe(12);
  });

  it("a lot too small for one unit builds nothing", () => {
    expect(run("RM-3", 2500, 45).max_units).toBe(0);
  });
});

describe("FAR and lot area per unit together", () => {
  it("FAR governs when it allows fewer units", () => {
    // FAR 0.5 x 20,000 = 10,000 sqft, 16 units; density allows 20
    const r = run("FAR-D1", 20000, 45);
    expect(r.max_units).toBe(16);
    expect(r.buildable_sqft).toBe(10000);
  });

  it("density governs when it allows fewer units", () => {
    // density allows 10; FAR would allow 16
    expect(run("FAR-D2", 20000, 45).max_units).toBe(10);
  });
});

describe("no FAR or density limit", () => {
  it("has no FAR and no unit cap", () => {
    expect(currentLimits(testCounty, "ENV", 10000)).toEqual({ far: Infinity, lot_coverage: 0.5 });
  });

  it("builds out the height and coverage envelope, more than with an FAR", () => {
    const open = run("ENV", 10000, 30);
    const capped = run("ENV-FAR", 10000, 30);
    expect(open.buildable_sqft).toBeGreaterThan(capped.buildable_sqft);
    expect(open.max_units).toBeGreaterThan(capped.max_units);
    for (const [k, v] of Object.entries(open)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });
});

describe("the check reads current zoning", () => {
  it("the test county is complete", () => {
    expect(checkLocality(testCounty)).toEqual([]);
  });

  it("a strict county's zone needs current rules", () => {
    const loc: Locality = JSON.parse(JSON.stringify(testCounty));
    loc.rules.zones["RM-3"] = { ...loc.rules.zones["RM-3"], current: undefined };
    expect(checkLocality(loc)).toContain("zz-generic rules.zones.RM-3.current: missing");
  });

  it("lot area per unit must be more than 0, and coverage a share", () => {
    const loc: Locality = JSON.parse(JSON.stringify(testCounty));
    loc.rules.zones["RM-3"].current = {
      lot_area_per_unit: flat(0, "test"),
      lot_coverage: flat(1.4, "test"),
    };
    const problems = checkLocality(loc);
    expect(problems).toContain(
      "zz-generic rules.zones.RM-3.current.lot_area_per_unit.bands[0].base: must be more than 0"
    );
    expect(problems).toContain(
      "zz-generic rules.zones.RM-3.current.lot_coverage.bands[0].base: 1.4 is a share, so it must be 0 to 1"
    );
  });

  it("every county needs the current pathway", () => {
    expect(checkLocality({ ...testCounty, pathways: ["bill6"] })).toContain(
      "zz-generic pathways: every locality needs current (current zoning)"
    );
  });
});

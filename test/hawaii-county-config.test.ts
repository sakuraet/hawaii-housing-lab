// Hawaiʻi County's config (src/localities/hi/hawaii) against the code it
// comes from: zoning, parking and loading (HCC Chapter 25, Supp. 20), fees
// (HCC Chapters 5, 8, 10 and 21), water (DWS rates, eff. July 1, 2025),
// property tax (Res. 574-26) and the 2025 HHFDC income limits, then parcels
// run end to end.

import { describe, expect, it } from "vitest";

import {
  buildingPermitFee,
  calcParkArea,
  gradingPermit,
  grubbingPermit,
  loadingSpaces,
  legalParkingRatio,
  mixFixtureUnits,
  mixRentByAmi,
  planReviewFee,
  requiredAffordableUnits,
  wastewaterFee,
} from "../src/calculations/calc-shared";
import { checkLocality } from "../src/core/check";
import { currentLimits, zoneRules } from "../src/core/zoning";
import { hawaiiCounty } from "../src/localities/hi/hawaii";
import { calcParcel, pathwayEnvelope } from "../src/parcels";

const loc = hawaiiCounty;
const limits = (zone: string, lot: number) => currentLimits(loc, zone, lot);

describe("Hawaiʻi County zoning: density by land area per unit", () => {
  it.each([
    // zone, lot sqft, units
    ["RM-.75", 15000, 20],
    ["RM-1", 15000, 15],
    ["RM-1.5", 15000, 10],
    ["RM-2", 15000, 7],
    ["RM-3", 15000, 5],
    ["RCX-2", 15000, 7],
    ["V-1.25", 15000, 12],
    ["CG-10", 15000, 12],
    ["CN-7.5", 15000, 12],
    ["CDH", 15000, 30],
  ])("%s on %i sqft: %i units", (zone, lot, units) => {
    expect(limits(zone, lot).max_units).toBe(units);
    // no district has an FAR
    expect(limits(zone, lot).far).toBe(Infinity);
  });

  it("RM, RCX and V: 80% coverage (20% landscaped); commercial districts: 100%", () => {
    expect(limits("RM-2", 15000).lot_coverage).toBe(0.8);
    expect(limits("V-1.25", 15000).lot_coverage).toBe(0.8);
    expect(limits("CG-10", 15000).lot_coverage).toBe(1);
    expect(limits("CDH", 15000).lot_coverage).toBe(1);
  });

  it("yards: residential 20 / 20 / 8 + 2 per story; commercial 15 / 15 / 0; CDH none", () => {
    expect(limits("RM-2", 15000).yards).toEqual({
      front_ft: 20,
      rear_ft: 20,
      side_ft: 8,
      side_ft_per_added_story: 2,
    });
    expect(limits("CV-10", 15000).yards).toEqual({ front_ft: 15, rear_ft: 15, side_ft: 0 });
    expect(limits("CDH", 15000).yards).toEqual({ front_ft: 0, rear_ft: 0, side_ft: 0 });
  });

  it("zone codes are written as on the County GIS list", () => {
    expect(zoneRules(loc, "RM-.75")).toBeDefined();
    expect(zoneRules(loc, "V-1.0")).toBeDefined();
    expect(zoneRules(loc, "V-2.0")).toBeDefined();
    expect(() => zoneRules(loc, "RM-0.75")).toThrow();
  });

  it("MCX needs a use permit for apartments, so it stops the run", () => {
    expect(() => zoneRules(loc, "MCX-20")).toThrow(/no zoning rules for zone "MCX-20"/);
  });
});

describe("Hawaiʻi County parking and loading", () => {
  it("1.25 stalls per unit; 1 in CDH", () => {
    expect(legalParkingRatio("one_bb_100", loc)).toBe(1.25);
    expect(limits("CDH", 15000).residential_stalls_per_unit).toBe(1);
  });

  it("multifamily loading: none under 20 units, 1 to 150, 2 to 300, +1 per 200 or major fraction", () => {
    expect(loadingSpaces(19, 0, 1, loc)).toBe(0);
    expect(loadingSpaces(20, 0, 1, loc)).toBe(1);
    expect(loadingSpaces(150, 0, 1, loc)).toBe(1);
    expect(loadingSpaces(151, 0, 1, loc)).toBe(2);
    expect(loadingSpaces(300, 0, 1, loc)).toBe(2);
    expect(loadingSpaces(399, 0, 1, loc)).toBe(2);
    expect(loadingSpaces(400, 0, 1, loc)).toBe(3);
  });

  it("commercial loading by floor area, from 5,000 sqft", () => {
    expect(loadingSpaces(0, 4999, 1, loc)).toBe(0);
    expect(loadingSpaces(0, 5000, 1, loc)).toBe(1);
    expect(loadingSpaces(0, 10001, 1, loc)).toBe(2);
    expect(loadingSpaces(0, 60000, 1, loc)).toBe(5);
    expect(loadingSpaces(0, 85000, 1, loc)).toBe(6);
  });
});

describe("Hawaiʻi County fees (HCC Ch. 5, 8, 10, 21)", () => {
  it("building permit fee by valuation, each step rounding up (5-7-3(b))", () => {
    expect(buildingPermitFee(500, loc)).toBe(10);
    expect(buildingPermitFee(2000, loc)).toBe(32.5);
    expect(buildingPermitFee(2001, loc)).toBe(40);
    expect(buildingPermitFee(25000, loc)).toBe(205);
    expect(buildingPermitFee(50000, loc)).toBe(355);
    // $350,000 unit: $355 + 300 x $3
    expect(buildingPermitFee(350000, loc)).toBe(1255);
  });

  it("plan review is 20% of the permit fee, at least $50 (5-7-1(a))", () => {
    expect(planReviewFee(1255, loc)).toBeCloseTo(251, 9);
    expect(planReviewFee(100, loc)).toBe(50);
  });

  it("grading by cubic yards, with the bases as written (10-11(a))", () => {
    expect(gradingPermit(100, loc)).toBe(5);
    expect(gradingPermit(250, loc)).toBe(9);
    expect(gradingPermit(1000, loc)).toBe(23);
    expect(gradingPermit(1001, loc)).toBe(27);
    expect(gradingPermit(10150, loc)).toBe(43);
  });

  it("grubbing: nothing to 1 acre, $5 to 6 acres, +$2 per 5 acres (10-11(b))", () => {
    expect(grubbingPermit(20000, loc)).toBe(0);
    expect(grubbingPermit(2 * 43560, loc)).toBe(5);
    expect(grubbingPermit(7 * 43560, loc)).toBe(7);
  });

  it("park land: 2.1 persons x 218 sqft per unit (8-6, 8-7)", () => {
    expect(calcParkArea(10, 100000, loc)).toBeCloseTo(10 * 457.8, 9);
  });

  it("no sewer connection charge (21-25(c))", () => {
    expect(wastewaterFee(20, 20, loc)).toBe(0);
  });

  it("$200 temporary certificate of occupancy (5-7-6)", () => {
    expect(loc.rules.fees.temp_occupancy_cert).toBe(200);
  });
});

describe("Hawaiʻi County water, tax and income limits", () => {
  it("$6,095 facilities charge per dwelling unit", () => {
    expect(mixFixtureUnits("one_bb_100", loc)).toBe(1);
    expect(loc.rules.water.wsfc_per_fu.low_rise).toBe(6095);
  });

  it("Apartment class, $11.70 per $1,000", () => {
    expect(loc.rules.property_tax_rate).toBe(0.0117);
  });

  it("2025 HHFDC table reproduces HHFDC's rents", () => {
    expect(loc.rules.income_limits[100][3]).toBe(120900);
    // one-bedroom at 80% AMI: $1,815; studio at 60%: $1,270
    expect(mixRentByAmi(80, "one_bb_100", loc)).toBe(1815);
    expect(mixRentByAmi(60, "studio_100", loc)).toBe(1270);
  });

  it("no required set-aside for by-right projects", () => {
    expect(requiredAffordableUnits(100, loc)).toBe(0);
  });
});

describe("a Hawaiʻi County parcel runs end to end", () => {
  // an RM-2 lot of 20,000 sqft at 45 ft (made up, not a real parcel)
  const parcel = { locality: "hi-hawaii", lot_sqft: 20000, zone_class: "RM-2", height: 45 };
  const r = calcParcel("current", parcel);

  it("the envelope has no FAR and a 10-unit cap", () => {
    const e = pathwayEnvelope("current", parcel);
    expect(e.max_far).toBe(Infinity);
    expect(e.max_units).toBe(10);
  });

  it("10 one-bedrooms (20,000 / 2,000), only the floor area they need", () => {
    expect(r.max_units).toBe(10);
    // 10 x 500 sqft at 80% efficiency
    expect(r.buildable_sqft).toBeCloseTo(6250, 3);
  });

  it("13 stalls: 1.25 x 10 = 12.5, rounded up", () => {
    expect(r.parking_stalls).toBe(13);
  });

  it("every result is a number", () => {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });

  it("the zone's yards bind where density doesn't", () => {
    // RM-.75 on 10,000 sqft: density allows 13 units. At 25 ft (2 stories)
    // the yards are 20 ft front and rear and 8 + 2 = 10 ft at the sides,
    // which fit fewer units than a uniform 8 ft setback would
    const dense = { locality: "hi-hawaii", lot_sqft: 10000, zone_class: "RM-.75", height: 25 };
    expect(calcParcel("current", dense).max_units).toBe(9);
    expect(calcParcel("current", dense, { setback: 8 }).max_units).toBe(12);
    // at 45 ft the density cap binds either way
    expect(calcParcel("current", { ...dense, height: 45 }).max_units).toBe(13);
  });

  it("the setback lever still overrides the zone's yards", () => {
    const loose = calcParcel("current", parcel, { setback: 0 });
    expect(loose.max_units).toBe(10);
  });

  it("Hawaiʻi County has current zoning only", () => {
    expect(() => calcParcel("bill6", parcel)).toThrow(/no "bill6" pathway/);
  });
});

describe("the config is complete", () => {
  it("nothing left to fill in", () => {
    expect(checkLocality(loc)).toEqual([]);
  });
});

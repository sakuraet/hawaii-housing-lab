// Kauaʻi's config (src/localities/hi/kauai) against the code it comes from:
// zoning and parking (Kauaʻi County Code Chapter 8, the CZO), fees (Chapters
// 9, 12, 22 and 25), water (DOW Rules Part 5), property tax (FY 2026–27
// rates, Res. 2026-11) and the 2025 HHFDC income limits, then parcels run end
// to end.

import { describe, expect, it } from "vitest";

import {
  buildingPermitFee,
  calcParkArea,
  gradingPermit,
  grubbingPermit,
  legalParkingRatio,
  loadingSpaces,
  mixFixtureUnits,
  mixRentByAmi,
  planReviewFee,
  requiredAffordableUnits,
  wastewaterFee,
} from "../src/calculations/calc-shared";
import { checkLocality } from "../src/core/check";
import { currentLimits, zoneRules } from "../src/core/zoning";
import { kauai } from "../src/localities/hi/kauai";
import { calcParcel, pathwayEnvelope } from "../src/parcels";

const loc = kauai;
const limits = (zone: string, lot: number) => currentLimits(loc, zone, lot);

describe("Kauaʻi zoning: density by units per acre", () => {
  it.each([
    // zone, lot sqft, units
    // 10,000 / 2,178 = 4.59: the fraction is under 65%, so 4
    ["R-20", 10000, 4],
    // 15,000 / 2,178 = 6.89: 65% or more, so 7
    ["R-20", 15000, 7],
    ["R-20", 20000, 9],
    // 15,000 / 4,356 = 3.44
    ["R-10", 15000, 3],
    // 1 acre: 6 units in R-6, 1 in R-1
    ["R-6", 43560, 6],
    ["R-1", 43560, 1],
    // commercial districts take R-10's and R-20's density
    ["CN", 20000, 4],
    ["CG", 15000, 7],
  ])("%s on %i sqft: %i units", (zone, lot, units) => {
    expect(limits(zone, lot).max_units).toBe(units);
    // no district has an FAR
    expect(limits(zone, lot).far).toBe(Infinity);
  });

  it("a fractional unit of exactly 65% counts (8-4.6)", () => {
    // 4.65 units of 2,178 sqft
    expect(limits("R-20", 4.65 * 2178).max_units).toBe(5);
  });

  it("coverage of buildings and pavement: R-1 to R-6 60%, R-10 and CN 80%, R-20 and CG 90%", () => {
    expect(limits("R-4", 15000).lot_coverage).toBe(0.6);
    expect(limits("R-10", 15000).lot_coverage).toBe(0.8);
    expect(limits("R-20", 15000).lot_coverage).toBe(0.9);
    expect(limits("CN", 15000).lot_coverage).toBe(0.8);
    expect(limits("CG", 15000).lot_coverage).toBe(0.9);
  });

  it("yards: residential 10 ft front, side and rear 5 ft or half the wall height; commercial 5 / 0 / 0", () => {
    expect(limits("R-20", 15000).yards).toEqual({
      front_ft: 10,
      rear_ft: 5,
      side_ft: 5,
      side_rear_height_fraction: 0.5,
    });
    expect(limits("CG", 15000).yards).toEqual({ front_ft: 5, rear_ft: 0, side_ft: 0 });
  });

  it("districts without multiple-family by right stop the run", () => {
    for (const zone of ["R-40", "RR-10", "RR-20", "IL"]) {
      expect(() => zoneRules(loc, zone)).toThrow(/no zoning rules/);
    }
  });
});

describe("Kauaʻi parking and loading", () => {
  it("2 stalls per unit (8-4.5(a)(5))", () => {
    expect(legalParkingRatio("one_bb_100", loc)).toBe(2);
  });

  it("no loading requirement", () => {
    expect(loadingSpaces(300, 60000, 1, loc)).toBe(0);
  });
});

describe("Kauaʻi fees (KCC Ch. 9, 12, 22, 25)", () => {
  it("building permit fee by valuation, Table 1-A", () => {
    expect(buildingPermitFee(500, loc)).toBe(15);
    expect(buildingPermitFee(2000, loc)).toBe(45);
    expect(buildingPermitFee(25000, loc)).toBe(229);
    expect(buildingPermitFee(50000, loc)).toBe(404);
    expect(buildingPermitFee(100000, loc)).toBe(704);
    expect(buildingPermitFee(1000000, loc)).toBe(5204);
    // "or fraction thereof": $100,001 is one more $1,000 step
    expect(buildingPermitFee(100001, loc)).toBe(709);
    // $350,000 unit: $704 + 250 x $5
    expect(buildingPermitFee(350000, loc)).toBe(1954);
  });

  it("plan review is 15% of the permit fee (109.5)", () => {
    expect(planReviewFee(1954, loc)).toBeCloseTo(293.1, 9);
  });

  it("grading is 0.5% of the work, at an assumed $30 per cubic yard (22-7.12)", () => {
    expect(gradingPermit(1000, loc)).toBeCloseTo(150, 9);
    expect(grubbingPermit(2 * 43560, loc)).toBe(0);
  });

  it("sewer: $593 connection + $1,930 capacity per multi-family unit (25-11.1, 25-12.1)", () => {
    expect(wastewaterFee(10, 10, loc)).toBe(25230);
  });

  it("park land: 1.75 acres per 1,000 at 2.1 people per unit, all but one unit (9-2.8)", () => {
    expect(calcParkArea(10, 100000, loc)).toBeCloseTo(9 * 160.083, 3);
  });
});

describe("Kauaʻi water, tax and income limits", () => {
  it("$9,880 facilities reserve charge per multi-family unit (Part 5, III.3(b))", () => {
    expect(mixFixtureUnits("one_bb_100", loc)).toBe(1);
    expect(loc.rules.water.wsfc_per_fu.low_rise).toBe(9880);
  });

  it("Non-Owner-Occupied Residential, top tier: $9.40 per $1,000", () => {
    expect(loc.rules.property_tax_rate).toBe(0.0094);
  });

  it("2025 HHFDC table reproduces HHFDC's rents", () => {
    expect(loc.rules.income_limits[100][3]).toBe(132900);
    // one-bedroom at 80% AMI: $1,995; studio at 60%: $1,396
    expect(mixRentByAmi(80, "one_bb_100", loc)).toBe(1995);
    expect(mixRentByAmi(60, "studio_100", loc)).toBe(1396);
  });

  it("no set-aside: multiple-family at full density is exempt from 7A (7A-1.4.2)", () => {
    expect(requiredAffordableUnits(100, loc)).toBe(0);
  });
});

describe("a Kauaʻi parcel runs end to end", () => {
  // an R-20 lot of 20,000 sqft at 40 ft (made up, not a real parcel)
  const parcel = { locality: "hi-kauai", lot_sqft: 20000, zone_class: "R-20", height: 40 };
  const r = calcParcel("current", parcel);

  it("the envelope has no FAR and a 9-unit cap", () => {
    const e = pathwayEnvelope("current", parcel);
    expect(e.max_far).toBe(Infinity);
    expect(e.max_units).toBe(9);
  });

  it("9 one-bedrooms, only the floor area they need", () => {
    expect(r.max_units).toBe(9);
    // 9 x 500 sqft at 80% efficiency
    expect(r.buildable_sqft).toBeCloseTo(5625, 3);
  });

  it("18 stalls: 2 x 9", () => {
    expect(r.parking_stalls).toBe(18);
  });

  it("every result is a number", () => {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });

  it("Kauaʻi has current zoning only", () => {
    expect(() => calcParcel("bill6", parcel)).toThrow(/no "bill6" pathway/);
  });
});

describe("the config is complete", () => {
  it("nothing left to fill in", () => {
    expect(checkLocality(loc)).toEqual([]);
  });
});

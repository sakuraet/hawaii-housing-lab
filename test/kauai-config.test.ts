// Kauaʻi's config (src/localities/hi/kauai) against the code it comes from:
// zoning and parking (Kauaʻi County Code Chapter 8, the CZO), property tax
// (FY 2026–27 rates, Res. 2026-11) and the 2025 HHFDC income limits, then
// parcels run end to end. Loading, fees and water are Maui's for now.

import { describe, expect, it } from "vitest";

import { legalParkingRatio, mixRentByAmi, requiredAffordableUnits } from "../src/calculations/calc-shared";
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

  it("coverage of buildings and pavement: R-10 and CN 80%, R-20 and CG 90%", () => {
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

  it("districts not yet configured stop the run", () => {
    for (const zone of ["R-4", "R-40", "RR-20", "IL"]) {
      expect(() => zoneRules(loc, zone)).toThrow(/no zoning rules/);
    }
  });
});

describe("Kauaʻi parking, tax and income limits", () => {
  it("2 stalls per unit (8-4.5)", () => {
    expect(legalParkingRatio("one_bb_100", loc)).toBe(2);
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

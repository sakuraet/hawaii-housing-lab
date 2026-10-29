// Maui's config (src/localities/hi/maui) against the code it comes from:
// zoning (MCC 19.12, 19.14, 19.18, 19.20), parking and loading (MCC 19.36B),
// park dedication (MCC 18.16.320), fees (FY 2027 Appendix B), water (DWS
// FY 2027 Appendix B), workforce housing (MCC 2.96) and the 2025 HHFDC
// income limits, then a parcel run end to end.

import { describe, expect, it } from "vitest";

import {
  buildingPermitFee,
  calcFarBill6,
  calcParkArea,
  calcWaterFees,
  gradingPermit,
  grubbingPermit,
  inclusionaryRent,
  legalParkingRatio,
  loadingSpaces,
  lotCoverageBill6,
  mixFixtureUnits,
  mixRentByAmi,
  planReviewFee,
  requiredAffordableUnits,
  wastewaterFee,
} from "../src/calculations/calc-shared";
import { checkLocality } from "../src/core/check";
import { calcParcel } from "../src/parcels";
import { zoneRules } from "../src/core/zoning";
import { maui } from "../src/localities/hi/maui";

const ACRE = 43560;

describe("Maui zoning (current zoning, bill6)", () => {
  it.each([
    // zone, FAR, lot coverage
    ["A-2", 0.9, 0.35],
    ["H-1", 0.5, 0.25],
    ["H-M", 1.0, 0.3],
    ["H-2", 1.5, 0.35],
    ["Hotel", 1.5, 0.35],
    ["B-2", 2.0, 1.0],
    ["B-3", 4.0, 1.0],
  ])("%s: FAR %s, coverage %s", (zone, far, coverage) => {
    expect(calcFarBill6(zone, maui, 20000)).toBe(far);
    expect(lotCoverageBill6(zone, maui, 20000)).toBe(coverage);
  });

  it("A-1: FAR 50% under 3 acres, 40% at 3 acres or more; coverage 25%", () => {
    expect(calcFarBill6("A-1", maui, 10000)).toBe(0.5);
    expect(calcFarBill6("A-1", maui, 3 * ACRE - 1)).toBe(0.5);
    expect(calcFarBill6("A-1", maui, 3 * ACRE)).toBe(0.4);
    expect(lotCoverageBill6("A-1", maui, 10000)).toBe(0.25);
  });

  it("a district with no FAR is not listed, so it stops the run", () => {
    expect(() => zoneRules(maui, "B-1")).toThrow(/no zoning rules for zone "B-1"/);
    expect(() => zoneRules(maui, "B-CT")).toThrow(/B-CT/);
  });

  it("no zone requires bicycle parking", () => {
    for (const z of Object.values(maui.rules.zones)) expect(z.bicycle_required).toBe(false);
  });
});

describe("Maui parking, loading and parks", () => {
  it("2 stalls per unit, whatever the unit mix", () => {
    expect(legalParkingRatio("one_bb_100", maui)).toBe(2);
    expect(legalParkingRatio("studio_100", maui)).toBe(2);
  });

  it("loading by non-dwelling floor area only", () => {
    expect(loadingSpaces(200, 0, 1, maui)).toBe(0);
    expect(loadingSpaces(200, 1999, 1, maui)).toBe(0);
    expect(loadingSpaces(200, 2000, 1, maui)).toBe(1);
    expect(loadingSpaces(200, 10000, 1, maui)).toBe(1);
    expect(loadingSpaces(200, 10001, 1, maui)).toBe(2);
  });

  it("park land: 500 sqft per unit in excess of 3", () => {
    expect(calcParkArea(3, 10000, maui)).toBe(0);
    expect(calcParkArea(10, 10000, maui)).toBe(7 * 500);
  });
});

describe("Maui income limits", () => {
  it("2025 HHFDC Maui County table: 100% AMI for 4 is 50% of 2 x VLIL", () => {
    expect(maui.rules.income_limits[100][3]).toBe(134600);
    expect(maui.rules.income_limits[50][3] * 2).toBe(134600);
    expect(maui.rules.income_limits[80]).toEqual([
      75440, 86160, 96960, 107680, 116320, 124960, 133600, 142160,
    ]);
  });
});

describe("Maui fees (FY 2027 Appendix B)", () => {
  it("building permit fee by valuation, each step rounding up", () => {
    expect(buildingPermitFee(500, maui)).toBe(30);
    expect(buildingPermitFee(2000, maui)).toBe(75);
    expect(buildingPermitFee(2001, maui)).toBe(85);
    expect(buildingPermitFee(25000, maui)).toBe(305);
    expect(buildingPermitFee(100000, maui)).toBe(880);
    expect(buildingPermitFee(500000, maui)).toBe(2880);
    expect(buildingPermitFee(1000000, maui)).toBe(5880);
    // $350,000 unit: $880 + 250 x $5
    expect(buildingPermitFee(350000, maui)).toBe(2130);
  });

  it("plan review is 35% of the building permit fee", () => {
    expect(planReviewFee(2130, maui)).toBeCloseTo(745.5, 9);
  });

  it("grading by cubic yards, per 100 or fraction", () => {
    expect(gradingPermit(250, maui)).toBe(180);
    expect(gradingPermit(500, maui)).toBe(300);
    expect(gradingPermit(10000, maui)).toBe(2675);
    expect(gradingPermit(10150, maui)).toBe(2675 + 2 * 8);
  });

  it("grubbing by acre", () => {
    expect(grubbingPermit(20000, maui)).toBe(100);
    expect(grubbingPermit(43561, maui)).toBe(150);
  });

  it("Apartment class property tax, $3.50 per $1,000", () => {
    expect(maui.rules.property_tax_rate).toBe(0.0035);
  });
});

describe("Maui water and wastewater", () => {
  it("ESDs per dwelling from beds and baths", () => {
    expect(mixFixtureUnits("one_bb_100", maui)).toBe(0.5);
    expect(mixFixtureUnits("two_bb_100", maui)).toBe(0.7);
    // Honolulu still counts fixture units
    expect(mixFixtureUnits("one_bb_100")).toBe(7.5);
  });

  it("$5,491 per ESD, no waiver, plus the $1,250 review fee", () => {
    const w = calcWaterFees({
      max_units: 20,
      water_chargeable_units: 20,
      living_stories: 4,
      fu_per_unit: 0.5,
      loc: maui,
    });
    expect(w.wsfc).toBeCloseTo(20 * 0.5 * 5491, 9);
    expect(w.water_meter).toBe(1250);
  });

  it("wastewater assessment: 255 gpd per unit at $4.57", () => {
    expect(wastewaterFee(20, 20, maui)).toBeCloseTo(20 * 255 * 4.57, 9);
  });
});

describe("Maui workforce housing (MCC 2.96)", () => {
  it.each([
    // total units, workforce units: 25% of the market units, rounded up
    [9, 0],
    [10, 2],
    [25, 5],
    [26, 6],
    [28, 6],
    [100, 20],
  ])("%i units: %i workforce", (units, workforce) => {
    expect(requiredAffordableUnits(units, maui)).toBe(workforce);
    // at or above the 10-unit threshold, it meets 25% of the market units
    if (units >= 10) {
      expect(workforce).toBeGreaterThanOrEqual(Math.ceil(0.25 * (units - workforce)));
    }
  });

  it("Honolulu requires none", () => {
    expect(requiredAffordableUnits(100)).toBe(0);
  });

  it("rents at the average of the 80, 100 and 120% AMI caps", () => {
    const at = (ami: number) => mixRentByAmi(ami, "one_bb_100", maui);
    expect(inclusionaryRent("one_bb_100", maui)).toBeCloseTo((at(80) + at(100) + at(120)) / 3, 9);
  });
});

describe("a Maui parcel runs end to end", () => {
  // an A-2 lot of 20,000 sqft with the district's 60 ft height (made up,
  // not a real parcel): FAR 0.9 caps floor area at 18,000 sqft, under the
  // 35% coverage x 6 floors envelope (42,000 sqft)
  const parcel = { locality: "hi-maui", lot_sqft: 20000, zone_class: "A-2", height: 60 };
  const r = calcParcel("bill6", parcel);

  it("floor area at FAR 0.9", () => {
    expect(r.buildable_sqft).toBe(18000);
  });

  it("units from 80% efficiency over 500 sqft one-bedrooms, 2 stalls each", () => {
    // 18,000 x 0.8 / 500 = 28.8
    expect(r.max_units).toBe(28);
    expect(r.parking_stalls).toBe(56);
  });

  it("no bicycle parking", () => {
    expect(r.bicycle_spaces ?? 0).toBe(0);
  });

  it("6 of the 28 units are workforce housing (25% of the 22 market units)", () => {
    expect(r.affordable_units).toBe(6);
    expect(r.afd_rent_units).toBe(6);
    expect(r.mkt_rent_units).toBe(22);
  });

  it("every result is a number", () => {
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });

  it("Maui has current zoning only", () => {
    expect(() => calcParcel("tod", parcel)).toThrow(/no "tod" pathway/);
  });
});

describe("the config is complete", () => {
  it("nothing left to fill in", () => {
    expect(checkLocality(maui)).toEqual([]);
  });
});

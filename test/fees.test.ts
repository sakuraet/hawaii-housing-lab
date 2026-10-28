// Tests that the fee and water charge functions read the locality they are
// given (src/calculations/calc-shared.ts), and default to Honolulu.

import { describe, expect, it } from "vitest";

import {
  buildingPermitFee,
  calcParkArea,
  calcSoftCosts,
  calcWaterFees,
  gradingPermit,
  grubbingPermit,
  planReviewFee,
  stockpilingPermit,
  wastewaterFee,
  wsfcCategory,
  type SoftCostInputs,
} from "../src/calculations/calc-shared";
import type { Locality } from "../src/core/locality";
import { flat } from "../src/core/schedule";
import { honolulu } from "../src/localities/hi/honolulu";

// Honolulu with simple, different fees and water charges
const other: Locality = {
  ...honolulu,
  id: "test-fees",
  name: "Test County",
  rules: {
    ...honolulu.rules,
    fees: {
      building_permit: flat(1000, "test"),
      plan_review: { ...flat(0, "test"), min: 50 },
      environmental: { ea: 1, eis: 2 },
      temp_occupancy_cert: 3,
      escp: 4,
      installation_trench: 5,
      service_connection: 6,
      grubbing: flat(7, "test"),
      grading: flat(8, "test"),
      stockpiling: flat(9, "test"),
      wastewater: { charge_per_esdu: 1000, esdu_per_unit: flat(1, "test") },
      park_dedication: {
        sqft_per_unit: 50,
        floor_area_fraction: 0.2,
        application_fee: { exempt: 10, in_lieu: 20 },
      },
      school_impact_per_unit: 0,
      source: "test",
    },
    water: {
      wsfc_per_fu: { low_rise: 100, high_rise: 50 },
      low_rise_max_stories: 5,
      min_fu: 10,
      waiver_unit_cap: 2,
      fire_meter_charge: { "4": 1000, "6": 2000, "8": 3000 },
      source: "test",
    },
  },
};

describe("fee functions read the locality", () => {
  it("building permit and plan review", () => {
    expect(buildingPermitFee(300000, other)).toBe(1000);
    expect(buildingPermitFee(300000)).toBe(2700);
    expect(planReviewFee(1000, other)).toBe(50);
    expect(planReviewFee(1000)).toBe(200);
  });

  it("wastewater and site permits", () => {
    expect(wastewaterFee(10, 4, other)).toBe(4000);
    expect(wastewaterFee(10, 4)).toBeCloseTo(4 * 0.7 * 7539, 9);
    expect(grubbingPermit(20000, other)).toBe(7);
    expect(gradingPermit(500, other)).toBe(8);
    expect(stockpilingPermit(500, other)).toBe(9);
  });

  it("park dedication land", () => {
    // lesser of 50 sqft x 10 units and 20% of 10,000 sqft
    expect(calcParkArea(10, 10000, other)).toBe(500);
    // lesser of 110 x 10 and 10% of 10,000
    expect(calcParkArea(10, 10000)).toBe(1000);
  });
});

describe("water charges read the locality", () => {
  it("the low-rise story limit", () => {
    expect(wsfcCategory(4, other)).toBe("multi_low_rise");
    expect(wsfcCategory(4)).toBe("multi_high_rise");
  });

  it("WSFC and meter cost", () => {
    // 10 units x 7.5 FU at $100 (4 stories is low-rise here); a 4-story
    // building takes a 6" meter (the meter-size assumption is the same everywhere)
    expect(
      calcWaterFees({ max_units: 10, water_chargeable_units: 10, living_stories: 4, fu_per_unit: 7.5, loc: other })
    ).toEqual({ wsfc: 7500, water_meter: 2000, total_fu: 75 });
  });
});

describe("calcSoftCosts uses one locality throughout", () => {
  const inputs: SoftCostInputs = {
    hard_cost: 5_000_000,
    lot_sqft: 20000,
    max_units: 10,
    affordable_units: 0,
    excavation_depth: 4,
    park: "exempt",
    park_area: 0,
    land_cost_per_sqft: 200,
    waivable_fee_basis: "all_units",
    impact_fee_per_unit: 0,
    living_stories: 4,
    fu_per_unit: 7.5,
  };

  it("adds up the other locality's fees", () => {
    const b = calcSoftCosts({ ...inputs, loc: other });
    expect(b.environmental).toBe(3);
    expect(b.building_permit).toBe(10 * 1000);
    expect(b.plan_review).toBe(10 * 50);
    expect(b.wastewater).toBe(10 * 1000);
    expect(b.wsfc).toBe(7500);
    expect(b.water_meter).toBe(2000);
    expect(b.temp_occupancy).toBe(3);
    expect(b.park_dedication).toBe(10);
    expect(b.escp).toBe(4);
    expect(b.utilities).toBe((5 + 6) * 10);
    expect([b.grubbing, b.grading, b.stockpiling]).toEqual([7, 8, 9]);
  });

  it("defaults to Honolulu", () => {
    expect(calcSoftCosts(inputs)).toEqual(calcSoftCosts({ ...inputs, loc: honolulu }));
    expect(calcSoftCosts(inputs).environmental).toBe(1800);
  });
});

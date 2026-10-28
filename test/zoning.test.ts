// Tests for the zoning lookups (src/core/zoning.ts): the engine reads a
// locality's rules, and what a zone missing from its config gets.

import { describe, expect, it } from "vitest";

import {
  baseFar,
  calcFAR,
  calcFarBill6,
  commercialFracByZone,
  constructionMonthsByZone,
  excavationDepthByZone,
  envelopeCoverage,
  lotCoverage,
  lotCoverageBill6,
  openSpaceBonus,
  openSpaceBonusOver,
  permitsGroundFloorRetail,
  permittingMonthsByZone,
  resolveConstMonths,
  waikikiOpenSpaceFrac,
  zoneName,
  zoneStepBack,
} from "../src/calculations/calc-shared";
import type { Locality } from "../src/core/locality";
import { flat } from "../src/core/schedule";
import { FALLBACK_LOT_COVERAGE, zoneCoverage, zoneFar, zoneRules } from "../src/core/zoning";
import { honolulu } from "../src/localities/hi/honolulu";

// Honolulu with one made-up zone and the strict policy, as a new county
// would be set up
const strict: Locality = {
  ...honolulu,
  id: "test-strict",
  name: "Test County",
  unknown_zone: "error",
  rules: {
    ...honolulu.rules,
    zones: {
      "R-TEST": {
        far: { bill6: flat(1.25, "test"), standard: flat(0.75, "test"), tod: flat(2.0, "test") },
        lot_coverage: { bill6: flat(0.5, "test") },
        commercial_coverage: 0.25,
        open_space_far_ceiling: 3.0,
        open_space: flat(0.2, "test"),
        step_back: { trigger_ft: 50, above_ft: 50, ft_per_10ft: 2 },
        bicycle_required: true,
        residential_permitted: true,
        source: "test",
      },
    },
  },
  assumptions: {
    ...honolulu.assumptions,
    zones: {
      "R-TEST": { permitting_months: 6, construction_months: 9, excavation_depth_ft: 2 },
    },
    default_zone: { permitting_months: 30, construction_months: 40, excavation_depth_ft: 10 },
  },
};

describe("zone lookups", () => {
  it("Honolulu gives an unlisted zone no FAR, as the original model did", () => {
    expect(zoneRules(honolulu, "XYZ")).toBeUndefined();
    expect(zoneFar(honolulu, "XYZ", "bill6", 20000)).toBe(0);
  });

  it("a strict locality stops on an unlisted zone", () => {
    expect(() => zoneFar(strict, "A-2", "bill6", 20000)).toThrow(/no zoning rules for zone "A-2"/);
  });

  it("the FAR functions read whichever locality they are given", () => {
    expect(calcFarBill6("R-TEST", strict)).toBe(1.25);
    expect(calcFAR("R-TEST", 20000, strict)).toBe(0.75);
    expect(baseFar("R-TEST", 20000, strict)).toBe(2.0);
    // and default to Honolulu
    expect(calcFarBill6("A-2")).toBe(3.0);
  });

  it("a pathway with no FAR in a zone gives 0", () => {
    expect(zoneFar(strict, "R-TEST", "h201", 20000)).toBe(0);
  });
});

describe("coverage, open space, commercial share and step-backs", () => {
  it("Honolulu gives a zone with no coverage rule the 60% fallback", () => {
    expect(zoneCoverage(honolulu, "I-2", "bill6", 20000)).toBe(FALLBACK_LOT_COVERAGE);
    expect(lotCoverage("XYZ", 20000)).toBe(FALLBACK_LOT_COVERAGE);
  });

  it("a strict locality stops on a pathway with no coverage rule", () => {
    expect(() => lotCoverage("R-TEST", 20000, strict)).toThrow(/no standard lot coverage for zone "R-TEST"/);
  });

  it("the functions read whichever locality they are given", () => {
    expect(lotCoverageBill6("R-TEST", strict)).toBe(0.5);
    expect(commercialFracByZone("R-TEST", strict)).toBe(0.25);
    expect(permitsGroundFloorRetail("R-TEST", strict)).toBe(true);
    // the bonus is the gap from the TOD base FAR (2.0) to the ceiling (3.0)
    expect(openSpaceBonus("R-TEST", strict)).toBe(1.0);
    expect(openSpaceBonusOver("R-TEST", 2.5, strict)).toBe(0.5);
    expect(waikikiOpenSpaceFrac("R-TEST", 1.0, strict)).toBe(0.2);
    // 20% open space caps coverage at 80%
    expect(envelopeCoverage("R-TEST", 1.0, 0.9, strict)).toBe(0.8);
    expect(zoneStepBack("R-TEST", strict)).toEqual({ trigger_ft: 50, above_ft: 50, ft_per_10ft: 2 });
  });

  it("zoneStepBack returns a copy, so the config can't be changed through it", () => {
    const step_back = zoneStepBack("A-2");
    step_back!.trigger_ft = 999;
    expect(zoneStepBack("A-2")!.trigger_ft).toBe(40);
  });
});

describe("timing, excavation and zone names", () => {
  it("read the locality's zone assumptions", () => {
    expect(permittingMonthsByZone("R-TEST", strict)).toBe(6);
    expect(constructionMonthsByZone("R-TEST", strict)).toBe(9);
    expect(excavationDepthByZone("R-TEST", strict)).toBe(2);
    // a slider override still wins
    expect(resolveConstMonths("R-TEST", 15, strict)).toBe(15);
    expect(resolveConstMonths("R-TEST", undefined, strict)).toBe(9);
  });

  it("a zone with no estimates of its own gets the locality's default", () => {
    expect(permittingMonthsByZone("OTHER", strict)).toBe(30);
    expect(constructionMonthsByZone("XYZ")).toBe(18);
    expect(permittingMonthsByZone("XYZ")).toBe(14);
    expect(excavationDepthByZone("XYZ")).toBe(4);
  });

  it("zone names come from the config", () => {
    expect(zoneName("Apart")).toBe("Apartment Precinct");
    expect(zoneName("A-2")).toBe("A-2");
    expect(zoneName("R-TEST", strict)).toBe("R-TEST");
  });
});

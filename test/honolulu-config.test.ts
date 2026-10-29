// Tests that Honolulu's config (src/localities/hi/honolulu) holds exactly the
// values of the original model: a frozen copy of @uhero/feasim 0.1.0's
// calc-shared.ts (test/legacy). The model now reads its rules from the
// config, so comparing against the live code would compare the config with
// itself; the frozen copy keeps this a real check.

import { describe, expect, it } from "vitest";

import {
  AFFORDABLE_RENT_INCOME_SHARE,
  BICYCLE_PARKING,
  baseFar,
  bicycleRequired,
  buildingPermitFee,
  calcFAR,
  calcFarBill6,
  commercialFracByZone,
  DEFAULT_CAP_RATE,
  excavationDepthByZone,
  FEES,
  FINANCING,
  FIRE_METER_CHARGE,
  gradingPermit,
  grubbingPermit,
  HOLD,
  INCOME_LIMITS,
  LOADING,
  loadingSpaces,
  LOT_COVERAGE,
  lotCoverage,
  lotCoverageBill6,
  OPEN_SPACE_FAR_CEILING,
  PARK_FLOOR_AREA_FRACTION,
  PARK_SQFT_PER_UNIT,
  PARKING,
  PARKING_MINIMUM,
  planReviewFee,
  residentialUse,
  stockpilingPermit,
  TOD_ELIGIBLE_DISTRICTS,
  VACANCY,
  waikikiOpenSpaceFrac,
  wastewaterFee,
  WSFC_MIN_FU,
  WSFC_PER_FU,
  WSFC_WAIVER_UNIT_CAP,
  wsfcCategory,
  ZONE_GROUPS,
  zoneName,
  zoneStepBack,
} from "./legacy/calc-shared-v0.1.0";
import type { PathwayId } from "../src/core/locality";
import { evaluateSchedule, type Schedule } from "../src/core/schedule";
import { FALLBACK_LOT_COVERAGE } from "../src/core/zoning";
import { honolulu } from "../src/localities/hi/honolulu";
import calculatorDefaults from "./data/calculator-defaults.json";
import gaugeParcels from "./data/gauge-parcels.json";

const { rules, assumptions } = honolulu;
const ZONES = Object.keys(rules.zones);

// lot sizes: an even sweep plus every band edge the FAR and coverage use
const LOTS = [
  ...Array.from({ length: 100 }, (_, i) => i * 4073),
  ...[7500, 10000, 20000, 30000, 40000].flatMap((e) => [e - 1, e - 0.5, e, e + 0.5, e + 1]),
];

// a missing schedule means no value: the code returns 0 there
const at = (s: Schedule | undefined, x: number) => (s ? evaluateSchedule(s, x) : 0);
// a missing coverage rule gets the engine's fallback, as in the original
const covAt = (s: Schedule | undefined, x: number) =>
  s ? evaluateSchedule(s, x) : FALLBACK_LOT_COVERAGE;

// every zone code that appears in the test data
function dataZones(): string[] {
  const found = new Set<string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === "object") {
      const z = (o as { zone_class?: unknown }).zone_class;
      if (typeof z === "string") found.add(z);
      Object.values(o).forEach(walk);
    }
  };
  walk(gaugeParcels);
  walk(calculatorDefaults);
  return [...found];
}

describe("Honolulu config: coverage of zones", () => {
  it("lists every zone the code and the test parcels use", () => {
    const used = new Set([
      ...Object.values(ZONE_GROUPS).flat(),
      ...Object.keys(LOT_COVERAGE),
      ...TOD_ELIGIBLE_DISTRICTS,
      ...Object.keys(OPEN_SPACE_FAR_CEILING),
      ...dataZones(),
    ]);
    for (const z of used) expect(ZONES, z).toContain(z);
  });

  it("an unlisted zone has no FAR in the code either", () => {
    expect(calcFAR("XYZ", 20000)).toBe(0);
    expect(calcFarBill6("XYZ")).toBe(0);
  });
});

describe("Honolulu config: zoning matches the code", () => {
  const far = (z: string, p: PathwayId) => rules.zones[z].far?.[p];
  const cov = (z: string, p: PathwayId) => rules.zones[z].lot_coverage?.[p];

  it.each(ZONES)("%s: FAR in every pathway", (z) => {
    for (const lot of LOTS) {
      expect(at(far(z, "standard"), lot), `standard ${lot}`).toBe(calcFAR(z, lot));
      expect(at(far(z, "bill6"), lot), `bill6 ${lot}`).toBe(calcFarBill6(z));
      expect(at(far(z, "h201"), lot), `h201 ${lot}`).toBe(calcFarBill6(z));
      expect(at(far(z, "tod"), lot), `tod ${lot}`).toBe(baseFar(z, lot));
    }
  });

  it.each(ZONES)("%s: lot coverage in every pathway", (z) => {
    for (const lot of LOTS) {
      expect(covAt(cov(z, "standard"), lot), `standard ${lot}`).toBe(lotCoverage(z, lot));
      expect(covAt(cov(z, "tod"), lot), `tod ${lot}`).toBe(lotCoverage(z));
      expect(covAt(cov(z, "bill6"), lot), `bill6 ${lot}`).toBe(lotCoverageBill6(z));
      expect(covAt(cov(z, "h201"), lot), `h201 ${lot}`).toBe(lotCoverageBill6(z));
    }
  });

  it.each(ZONES)("%s: commercial share, bonus, open space, step-back, uses", (z) => {
    const zr = rules.zones[z];
    expect(zr.commercial_coverage).toBe(commercialFracByZone(z));
    expect(zr.open_space_far_ceiling).toBe(OPEN_SPACE_FAR_CEILING[z]);
    for (let f = 0; f <= 8; f += 0.25) {
      expect(at(zr.open_space, f), `FAR ${f}`).toBe(waikikiOpenSpaceFrac(z, f));
    }
    expect(zr.step_back).toEqual(zoneStepBack(z));
    expect(zr.bicycle_required).toBe(bicycleRequired(z));
    expect(zr.residential_permitted).toBe(residentialUse(z, "pdt") === "permitted");
    expect(zr.name ?? z).toBe(zoneName(z));
  });
});

describe("Honolulu config: zone assumptions match the code", () => {
  const zone = (z: string) => assumptions.zones[z] ?? assumptions.default_zone;

  it.each([...ZONES, "low_rise", "mid_rise", "XYZ"])("%s: excavation depth", (z) => {
    expect(zone(z).excavation_depth_ft).toBe(excavationDepthByZone(z));
  });
});

// Values changed on purpose since 0.1.0, by the team in UHERO's package
// (@uhero/feasim 0.2.1). Everything else must still match 0.1.0.
describe("Honolulu config: changes since 0.1.0", () => {
  it("one permitting and construction time for every zone (commit 91255fe)", () => {
    // 0.1.0 set them by zone; 0.2.1 uses 18 and 12 months everywhere
    expect(assumptions.timing).toEqual({ permitting_months: 18, construction_months: 12 });
  });

  it("rent growth 4% instead of 3.5% (commit 27716f3)", () => {
    expect(HOLD.annual_rent_growth).toBe(0.035);
    expect(assumptions.market.annual_rent_growth).toBe(0.04);
  });
});

describe("Honolulu config: parking, loading and bicycle match the code", () => {
  it("parking minimums", () => {
    expect(rules.parking.residential_sqft_per_stall).toBe(PARKING_MINIMUM.residential_sqft_per_stall);
    expect(rules.parking.retail_sqft_per_stall).toBe(PARKING_MINIMUM.retail_sqft_per_stall);
    expect(rules.parking.joint_use).toBe(PARKING_MINIMUM.joint_use);
  });

  it("loading spaces and sizes", () => {
    expect(rules.loading.min_lot_sqft).toBe(LOADING.min_lot_sqft);
    expect(rules.loading.small_space_sqft).toBe(LOADING.small_sqft);
    expect(rules.loading.large_space_sqft).toBe(LOADING.large_sqft);
    for (let units = 0; units <= 2000; units++) {
      expect(evaluateSchedule(rules.loading.multifamily_spaces, units), `${units} units`).toBe(
        loadingSpaces(units, 0)
      );
    }
    for (let sqft = 0; sqft <= 400000; sqft += 250) {
      expect(evaluateSchedule(rules.loading.retail_spaces, sqft), `${sqft} sqft`).toBe(
        loadingSpaces(0, sqft)
      );
    }
  });

  it("bicycle parking", () => {
    for (const term of ["short_term", "long_term"] as const) {
      const { cost_per_space: _, ...rule } = BICYCLE_PARKING[term];
      expect(rules.bicycle[term]).toEqual(rule);
    }
    expect(rules.bicycle.sqft_per_space).toBe(BICYCLE_PARKING.sqft_per_space);
  });
});

describe("Honolulu config: fees match the code", () => {
  const f = rules.fees;

  it("building permit and plan review", () => {
    for (let v = 0; v <= 5_000_000; v += 997) {
      expect(evaluateSchedule(f.building_permit, v), `$${v}`).toBe(buildingPermitFee(v));
    }
    for (let fee = 0; fee <= 400000; fee += 113) {
      expect(evaluateSchedule(f.plan_review, fee), `$${fee}`).toBe(planReviewFee(fee));
    }
  });

  it("flat fees", () => {
    expect(f.environmental).toEqual(FEES.environment);
    expect(f.temp_occupancy_cert).toBe(FEES.administrative.temp_occupancy_cert);
    expect(f.escp).toBe(FEES.civil.escp);
    expect(f.installation_trench).toBe(FEES.civil.installation_trench);
    expect(f.service_connection).toBe(FEES.civil.service_connection);
    expect(f.school_impact_per_unit).toBe(FEES.impact.per_dwelling);
  });

  it("site permits", () => {
    for (let x = 0; x <= 200000; x += 37) {
      expect(evaluateSchedule(f.grubbing, x), `grubbing ${x}`).toBe(grubbingPermit(x));
      expect(evaluateSchedule(f.grading, x), `grading ${x}`).toBe(gradingPermit(x));
      expect(evaluateSchedule(f.stockpiling, x), `stockpiling ${x}`).toBe(stockpilingPermit(x));
    }
  });

  it("wastewater", () => {
    expect(f.wastewater.charge_per_esdu).toBe(FEES.wastewater_charge_per_esdu);
    for (let units = 1; units <= 500; units++) {
      const per_unit =
        evaluateSchedule(f.wastewater.esdu_per_unit, units) * f.wastewater.charge_per_esdu;
      expect(per_unit, `${units} units`).toBe(wastewaterFee(units, 1));
    }
  });

  it("park dedication", () => {
    expect(f.park_dedication.sqft_per_unit).toBe(PARK_SQFT_PER_UNIT);
    expect(f.park_dedication.floor_area_fraction).toBe(PARK_FLOOR_AREA_FRACTION);
    expect(f.park_dedication.application_fee).toEqual(FEES.park_dedication);
  });
});

describe("Honolulu config: water, tax and income limits match the code", () => {
  it("BWS water charges", () => {
    const w = rules.water;
    expect(w.wsfc_per_fu).toEqual({
      low_rise: WSFC_PER_FU.multi_low_rise,
      high_rise: WSFC_PER_FU.multi_high_rise,
    });
    for (let stories = 0; stories <= 60; stories++) {
      const low = stories <= w.low_rise_max_stories;
      expect(low ? "multi_low_rise" : "multi_high_rise").toBe(wsfcCategory(stories));
    }
    expect(w.min_fu).toBe(WSFC_MIN_FU);
    expect(w.waiver_unit_cap).toBe(WSFC_WAIVER_UNIT_CAP);
    expect(w.fire_meter_charge).toEqual(FIRE_METER_CHARGE);
  });

  it("property tax and HHFDC income limits", () => {
    expect(rules.property_tax_rate).toBe(FINANCING.rpt_residential);
    expect(rules.income_limits).toEqual(INCOME_LIMITS);
  });
});

describe("Honolulu config: state rules and market assumptions match the code", () => {
  it("state rules", () => {
    expect(honolulu.state.affordable_rent_income_share).toBe(AFFORDABLE_RENT_INCOME_SHARE);
    // H201_MIN_AFD_FRAC in calc-h201.ts is not exported
    expect(honolulu.state.h201_min_affordable_frac).toBe(0.5);
  });

  it("market assumptions", () => {
    const m = assumptions.market;
    expect(m.cap_rate).toBe(DEFAULT_CAP_RATE);
    expect(m.vacancy).toEqual({ residential: VACANCY.rental, retail: VACANCY.default });
    expect(m.cost_inflation).toBe(FINANCING.cost_inflation);
    expect(m.ami_escalation).toBe(FINANCING.ami_escalation);
    expect(m.annual_opex_growth).toBe(HOLD.annual_opex_growth);
    expect(m.annual_assessment_growth).toBe(HOLD.annual_assessment_growth);
    const { stalls_per_unit: _, ...parking } = PARKING;
    expect(m.parking).toEqual(parking);
  });
});

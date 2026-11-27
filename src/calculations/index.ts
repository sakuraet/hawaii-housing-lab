// Unified entry point for UHERO development feasibility analysis.
// Dispatches to per-program calculators and re-exports for consumers.
//
// Architecture:
//   calc-shared.ts    — shared constants, types, helpers (from assumptions.R)
//   calc-bill7.ts     — Bill 7 calculator (ROH Chapter 32)
//   calc-standard.ts  — Standard calculator (from calculator/standard/*.R)
//   calc-tod.ts       — TOD calculator (IPDT/PDT/TOD Special Districts)
//   calc-h201.ts      — 201-H housing
//   calc-bill6.ts     — Bill 6 calculator (ROH Chapter 25, ordinance)
//   calculations.ts   — this file: re-exports + dispatch

import {
  BILL6_DEFAULT_EQUITY,
  BILL6_DEFAULT_FLOOR_HEIGHT,
  BILL6_DEFAULT_HEIGHT_LIMIT,
  BILL6_DEFAULT_HOLD_YEARS,
  BILL6_DEFAULT_LAND_COST,
  BILL6_DEFAULT_PERMANENT_RATE,
  calcbill6Single,
} from "./calc-bill6";
import {
  calcBill7Single,
  DEFAULT_AFFORDABLE_AMI,
  DEFAULT_GRANT_TYPE,
  DEFAULT_HEIGHT_LIMIT,
  DEFAULT_HOLD_YEARS,
  DEFAULT_INCLUDE_RETAIL,
  DEFAULT_LAND_COST,
  DEFAULT_MARKET_AMI,
  DEFAULT_PERMANENT_RATE,
  DEFAULT_RETAIL_RENT,
} from "./calc-bill7";
import {
  calcH201Single,
  H201_DEFAULT_AFFORDABILITY,
  H201_DEFAULT_EQUITY,
  H201_DEFAULT_HEIGHT_LIMIT,
  H201_DEFAULT_HOLD_YEARS,
  H201_DEFAULT_LAND_COST,
  H201_DEFAULT_PERMANENT_RATE,
  H201_DEFAULT_PERMITTING_MO,
  H201_DEFAULT_SALE_SPLIT,
} from "./calc-h201";
import {
  commercialFracByZone,
  getAffordablePrice as getAffordablePriceShared,
  nonresidentialRequired,
  permitsGroundFloorRetail,
  type BusinessHousing,
  type FeeBasis,
  type OpenSpaceBonusMode,
  type ParcelOutput,
  type ProgramId,
  type SliderInputs,
} from "./calc-shared";
import {
  calcStandardSingle,
  STD_DEFAULT_EQUITY,
  STD_DEFAULT_FLOOR_HEIGHT,
  STD_DEFAULT_HEIGHT_LIMIT,
  STD_DEFAULT_HOLD_YEARS,
  STD_DEFAULT_LAND_COST,
  STD_DEFAULT_PERMANENT_RATE,
} from "./calc-standard";
import {
  calcTodSingle,
  TOD_DEFAULT_EQUITY,
  TOD_DEFAULT_HEIGHT_LIMIT,
  TOD_DEFAULT_HOLD_YEARS,
  TOD_DEFAULT_LAND_COST,
  TOD_DEFAULT_PERMANENT_RATE,
  TOD_DEFAULT_ZONE_CLASS,
} from "./calc-tod";
import { assertPathway, getLocality } from "../localities";

const PROGRAMS: ProgramId[] = ["current", "bill6", "standard", "bill7", "tod", "h201"];

// =========================================================
// RE-EXPORTS
// =========================================================

export type {
  BusinessHousing,
  FeeBasis,
  OpenSpaceBonusMode,
  ParcelOutput,
  ProgramId,
  SliderInputs,
};
export { getAffordablePriceShared as getAffordablePrice };
export { commercialFracByZone, permitsGroundFloorRetail };
export { calcFarBill6, calcFAR } from "./calc-shared";

// Bill 7 defaults
export {
  DEFAULT_AFFORDABLE_AMI,
  DEFAULT_GRANT_TYPE,
  DEFAULT_HEIGHT_LIMIT,
  DEFAULT_HOLD_YEARS,
  DEFAULT_INCLUDE_RETAIL,
  DEFAULT_LAND_COST,
  DEFAULT_MARKET_AMI,
  DEFAULT_PERMANENT_RATE,
  DEFAULT_RETAIL_RENT,
};

// Standard defaults
export {
  STD_DEFAULT_EQUITY,
  STD_DEFAULT_FLOOR_HEIGHT,
  STD_DEFAULT_HEIGHT_LIMIT,
  STD_DEFAULT_HOLD_YEARS,
  STD_DEFAULT_LAND_COST,
  STD_DEFAULT_PERMANENT_RATE,
};

// TOD defaults
export {
  TOD_DEFAULT_EQUITY,
  TOD_DEFAULT_HEIGHT_LIMIT,
  TOD_DEFAULT_HOLD_YEARS,
  TOD_DEFAULT_LAND_COST,
  TOD_DEFAULT_PERMANENT_RATE,
  TOD_DEFAULT_ZONE_CLASS,
};

// 201H defaults
export {
  H201_DEFAULT_AFFORDABILITY,
  H201_DEFAULT_EQUITY,
  H201_DEFAULT_HEIGHT_LIMIT,
  H201_DEFAULT_HOLD_YEARS,
  H201_DEFAULT_LAND_COST,
  H201_DEFAULT_PERMANENT_RATE,
  H201_DEFAULT_PERMITTING_MO,
  H201_DEFAULT_SALE_SPLIT,
};

// Bill 6 defaults
export {
  BILL6_DEFAULT_EQUITY,
  BILL6_DEFAULT_HEIGHT_LIMIT,
  BILL6_DEFAULT_FLOOR_HEIGHT,
  BILL6_DEFAULT_LAND_COST,
  BILL6_DEFAULT_PERMANENT_RATE,
  BILL6_DEFAULT_HOLD_YEARS,
};

// =========================================================
// DISPATCH
// =========================================================

// The § 21-3.120-2 open-space bonus adds FAR but gives up ground, so on a lot whose height can't use the extra floor area it only costs space. A
// developer takes it where it pays: run the project with and without it and
// keep the one with the higher residual land value. Where neither pencils,
// keep the bigger building, the one a developer would push to make work.
// open_space_bonus_mode "on" or "off" takes that choice away from the model.
export function calcSingle(sliders: SliderInputs): ParcelOutput {
  const bonus = sliders.open_space_bonus ?? 0;
  // TOD without a max_far takes calcFarTod's default, which already counts
  // the bonus, so there is no FAR to compare against
  if (
    bonus <= 0 ||
    sliders.program === "bill7" ||
    (sliders.program === "tod" &&
      sliders.max_far == null &&
      sliders.far_without_bonus == null)
  )
    return { ...calcProgram(sliders), open_space_bonus: 0 };
  const mode = sliders.open_space_bonus_mode ?? "auto";
  const withoutBonus = () =>
    calcProgram({
      ...sliders,
      open_space_bonus: 0,
      max_far:
        sliders.far_without_bonus ??
        (sliders.max_far != null
          ? Math.max(0, sliders.max_far - bonus)
          : undefined),
    });
  if (mode === "off") return { ...withoutBonus(), open_space_bonus: 0 };
  const with_bonus = calcProgram(sliders);
  if (mode === "on") return { ...with_bonus, open_space_bonus: bonus };
  const without_bonus = withoutBonus();
  return prefersWithout(with_bonus, without_bonus)
    ? { ...without_bonus, open_space_bonus: 0 }
    : { ...with_bonus, open_space_bonus: bonus };
}

const rlvOf = (r: ParcelOutput) =>
  Number.isFinite(r.rlv) ? r.rlv : -Infinity;

/** whether the project without the bonus beats the one with it */
function prefersWithout(
  with_bonus: ParcelOutput,
  without_bonus: ParcelOutput
): boolean {
  const a = rlvOf(with_bonus);
  const b = rlvOf(without_bonus);
  if (a > 0 || b > 0) return b > a;
  if (without_bonus.buildable_sqft !== with_bonus.buildable_sqft)
    return without_bonus.buildable_sqft > with_bonus.buildable_sqft;
  return b > a;
}

// B-1 and B-2 (§ 21-5.50-1(c)): a project puts its housing above a
// nonresidential use or builds a minimum nonresidential floor area. Run both
// and keep the better, on the same terms as the open-space bonus.
// business_housing "above" or "min_floor_area" takes that choice away.
// Bill 7 has its own standards (§ 32-2.3).
function calcProgram(sliders: SliderInputs): ParcelOutput {
  // stop a pathway the locality does not have (other counties: current only)
  const loc = getLocality(sliders.locality);
  assertPathway(loc, PROGRAMS.includes(sliders.program) ? sliders.program : "bill6");
  if (
    sliders.program === "bill7" ||
    !nonresidentialRequired(sliders.zone_class ?? "", sliders.bmx3_uses, loc)
  )
    return runProgram(sliders);
  const run = (business_housing: BusinessHousing): ParcelOutput => ({
    ...runProgram({ ...sliders, business_housing }),
    business_housing,
  });
  const mode = sliders.business_housing ?? "auto";
  if (mode !== "auto") return run(mode);
  const above = run("above");
  const by_area = run("min_floor_area");
  return prefersMinFloorArea(above, by_area) ? by_area : above;
}

/** whether (B) beats (A): a higher residual land value, or where neither
 *  pencils, more units (the two build about the same floor area) */
function prefersMinFloorArea(
  above: ParcelOutput,
  by_area: ParcelOutput
): boolean {
  if (above.max_units <= 0 || by_area.max_units <= 0)
    return by_area.max_units > above.max_units;
  const a = rlvOf(above);
  const b = rlvOf(by_area);
  if (a <= 0 && b <= 0 && above.max_units !== by_area.max_units)
    return by_area.max_units > above.max_units;
  return b > a;
}

function runProgram(sliders: SliderInputs): ParcelOutput {
  switch (sliders.program) {
    case "standard":
      return calcStandardSingle(sliders);
    case "tod":
      return calcTodSingle(sliders);
    case "h201":
      return calcH201Single(sliders);
    case "bill7":
      return calcBill7Single(sliders);
    // current zoning: the same calculator in every county
    case "current":
    case "bill6":
    default:
      return calcbill6Single(sliders);
  }
}

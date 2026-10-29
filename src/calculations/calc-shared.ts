// =========================================================
// CONSTANTS
// Shared constants, types, and helper functions used by all program calculators.
// =========================================================

import type { Locality } from "../core/locality";
import { evaluateSchedule } from "../core/schedule";
import { zoneAssumptions, zoneCoverage, zoneFar, zoneRules } from "../core/zoning";
import { honolulu } from "../localities/hi/honolulu";

// currrently unused as of 2026-08-05, zone-specific hard construction cost per sqft
export const COST_PER_ZONE: Record<string, number> = {
  "A-1": 170.5,
  "A-2": 161.21,
  "A-3": 183.7,
  "AMX-1": 200.0,
  "AMX-2": 266.91,
  "AMX-3": 231.18,
  "R-5": 170.5,
  "B-1": 200.0,
  "B-2": 161.21,
  "BMX-3": 231.18,
  "BMX-4": 231.18,
  Apart: 161.21,
  ApartMix: 161.21,
};

// the official district name for a zone code, where the locality's config
// gives one (Honolulu: the Waikiki precincts); otherwise the code itself
export function zoneName(zone_class: string, loc: Locality = honolulu): string {
  return loc.rules.zones[zone_class]?.name ?? zone_class;
}

// whether the zone permits ground-floor retail: it has a commercial share
export function permitsGroundFloorRetail(
  zone_class: string,
  loc: Locality = honolulu
): boolean {
  return commercialFracByZone(zone_class, loc) > 0;
}

// ground floor commercial fraction of lot area, by zone (Honolulu: ROH Table
// 21-3.3), from the locality's zoning config; 0 where none is permitted
export function commercialFracByZone(
  zone_class: string,
  loc: Locality = honolulu
): number {
  return zoneRules(loc, zone_class)?.commercial_coverage ?? 0;
}

// PARK DEDICATION CONSTANTS
// currrently unused as of 2026-08-05, but may be used in future versions of the calculator
// private park build cost per sqft (ground-level amenity)
export const PARK_BUILD_COST_PER_SQFT = 145;
// Honolulu's park dedication land requirement (ROH 22-7.5), read from its
// config (rules.fees.park_dedication)
export const PARK_SQFT_PER_UNIT = honolulu.rules.fees.park_dedication.sqft_per_unit;
export const PARK_FLOOR_AREA_FRACTION =
  honolulu.rules.fees.park_dedication.floor_area_fraction;
// park dedication minimum land area = lesser of so many sqft per unit and a
// share of floor area (Honolulu: 110 sqft, 10%), not counting any exempt
// units (Maui: the first 3)
export function calcParkArea(
  max_units: number,
  buildable_sqft: number,
  loc: Locality = honolulu
): number {
  const park = loc.rules.fees.park_dedication;
  const counted_units = Math.max(0, max_units - (park.exempt_units ?? 0));
  return Math.min(
    park.sqft_per_unit * counted_units,
    park.floor_area_fraction * buildable_sqft
  );
}
// construction management fee
export const CONSTRUCTION_MGMT_RATE = 0.03;

// retail construction cost premium over residential rate
export const RETAIL_PREMIUM = 15;

// 80% efficiency factor for building
export const EFFICIENCY = 0.8;

// unit mix presets: each maps a mix key to component types + weights (must sum to 1) no longer UNIT_SIZE function
export const UNIT_MIX: Record<string, { type: string; weight: number }[]> = {
  studio_100: [{ type: "studio", weight: 1.0 }],
  studio75_1br25: [
    { type: "studio", weight: 0.75 },
    { type: "one_bb", weight: 0.25 },
  ],
  studio50_1br50: [
    { type: "studio", weight: 0.5 },
    { type: "one_bb", weight: 0.5 },
  ],
  studio25_1br75: [
    { type: "studio", weight: 0.25 },
    { type: "one_bb", weight: 0.75 },
  ],
  one_bb_100: [{ type: "one_bb", weight: 1.0 }],
  one_br50_2br50: [
    { type: "one_bb", weight: 0.5 },
    { type: "two_bb", weight: 0.5 },
  ],
  two_bb_100: [{ type: "two_bb", weight: 1.0 }],
  third_each: [
    { type: "studio", weight: 1 / 3 },
    { type: "one_bb", weight: 1 / 3 },
    { type: "two_bb", weight: 1 / 3 },
  ],
};

// blended average unit size for a mix key (sqft)
export function mixUnitSize(mix_key: string): number {
  const mix = UNIT_MIX[mix_key] ?? UNIT_MIX["one_bb_100"];
  return mix.reduce((sum, m) => sum + (UNIT_SIZE[m.type] ?? 500) * m.weight, 0);
}

// blended rent for a mix key (weighted avg of each component's rentByAmi)
export function mixRentByAmi(
  ami: string | number,
  mix_key: string,
  loc: Locality = honolulu
): number {
  const mix = UNIT_MIX[mix_key] ?? UNIT_MIX["one_bb_100"];
  return Math.floor(
    mix.reduce((sum, m) => sum + rentByAmi(ami, m.type, loc) * m.weight, 0)
  );
}

/** affordable units a project of this size must set aside under the
 *  locality's inclusionary rule (Maui: 25% of the market-rate units, rounded
 *  up, for 10 or more units); 0 where there is none. With W required units
 *  out of N, W is the least whole number with W >= share x (N - W). */
export function requiredAffordableUnits(units: number, loc: Locality = honolulu): number {
  const rule = loc.rules.inclusionary;
  if (!rule || units < rule.min_units) return 0;
  const s = rule.share_of_market;
  return Math.min(units, Math.ceil((s * units) / (1 + s) - 1e-9));
}

/** monthly rent of a required affordable unit: the average of the rents at
 *  each AMI cap the rule spreads its units over (Maui: 80, 100, 120) */
export function inclusionaryRent(mix_key: string, loc: Locality): number {
  const amis = loc.rules.inclusionary?.rent_ami ?? [];
  if (amis.length === 0) return 0;
  return amis.reduce((sum, ami) => sum + mixRentByAmi(ami, mix_key, loc), 0) / amis.length;
}

// blended sale price for a mix key (weighted avg of each component's getAffordablePrice)
export function mixAffordablePrice(
  mix_key: string,
  ami: number,
  rate: number
): number {
  const mix = UNIT_MIX[mix_key] ?? UNIT_MIX["one_bb_100"];
  return Math.round(
    mix.reduce(
      (sum, m) => sum + getAffordablePrice(m.type, ami, rate) * m.weight,
      0
    )
  );
}

// unit sizes by type (sqft)
export const UNIT_SIZE: Record<string, number> = {
  studio: 300,
  one_bb: 500,
  two_bb: 700,
  three_bb: 900,
  four_bb: 1200,
};

// map unit type for rent functions
const RENT_HOUSEHOLD: Record<string, number[]> = {
  studio: [1],
  one_bb: [1, 2],
  two_bb: [3],
  three_bb: [4, 5],
  four_bb: [6],
};

// affordable rent = a share of household income, utilities included (HHFDC:
// 30%), from the state rules
export const AFFORDABLE_RENT_INCOME_SHARE = honolulu.state.affordable_rent_income_share;

// monthly rent at an AMI level, from the locality's income limits
export function rentByAmi(
  ami: string | number,
  unit_type: string,
  loc: Locality = honolulu
): number {
  const limits = loc.rules.income_limits;
  const raw = Number(String(ami).replace("ami_", ""));
  const pct = Number.isFinite(raw) ? raw : 50;
  // exact bracket if published; otherwise scale the 50% row (it's linear)
  const row = limits[pct] ?? limits[50].map((v) => (v * pct) / 50);
  const sizes = RENT_HOUSEHOLD[unit_type] ?? RENT_HOUSEHOLD[DEFAULT_UNIT_TYPE];
  const income = sizes.reduce((sum, p) => sum + row[p - 1], 0) / sizes.length;
  // HHFDC publishes these floored, not rounded
  return Math.floor((income * loc.state.affordable_rent_income_share) / 12);
}

// default unit type
export const DEFAULT_UNIT_TYPE = "one_bb";

// vacancy rates: Honolulu's retail (default) and residential (rental), read
// from its config (assumptions.market.vacancy); home is unused
const honoluluMarket = honolulu.assumptions.market;
export const VACANCY = {
  default: honoluluMarket.vacancy.retail,
  rental: honoluluMarket.vacancy.residential,
  home: 0.01,
};

// admin income
export const INCOME = {
  application_fee: 50,
  lease_renewal: 200,
};

// operating expense rates
export const EXPENSES = {
  property_mgmt_rate: 0.15,
  property_insurance_unit: 1000,
  liability_insurance_unit: 150,
  monitor_unit: 60,
  // opex as % of EGI, excludes property tax (modeled separately in hold loop)
  opex_ratio: 0.2,
};

// timing assumptions
export const TIMING = {
  stabilization: 3,
  absorption_units_per_month: 20,
  monthly_sale_cap: 20,
  target_occupancy: 0.9,
};

// finance assumptions
export const FINANCING = {
  loan_fee: 0.0075,
  construction_rate: 0.08,
  dev_fee: 0.1,
  contingency: 1.1,
  cost_carried: 0.1,
  equity: 0.1,
  // Honolulu's, from its config: AMI growth escalates AMI-capped rents and
  // sale prices to lease-up/sale; cost inflation escalates hard cost to the
  // construction midpoint; the property tax rate is a county rule
  ami_escalation: honoluluMarket.ami_escalation,
  cost_inflation: honoluluMarket.cost_inflation,
  disposition_cost: 0.035,
  rpt_residential: honolulu.rules.property_tax_rate,
};

// hold strategy assumptions
export const HOLD = {
  amort_years: 30,
  // Honolulu's growth rates, from its config: hold-period rent growth for all
  // units, operating expenses on their own series rather than as a fixed
  // share of EGI, and the property-tax escalation
  annual_rent_growth: honoluluMarket.annual_rent_growth,
  annual_opex_growth: honoluluMarket.annual_opex_growth,
  annual_assessment_growth: honoluluMarket.annual_assessment_growth,
  exit_cap_spread: 0.005,
  tax_exemption_years: 15,
};

// Honolulu's market cap rate, the same for every zone, from its config
export const DEFAULT_CAP_RATE = honoluluMarket.cap_rate;

// required return-on-cost spread over cap rate (150 bps)
export const DEFAULT_TARGET_SPREAD = 0.015;

// land carry rate: annual cost of capital on the land purchase
export const DEFAULT_TARGET_RETURN = 0.115;

// developer profit as a margin on total project cost (dev cost + finance)
export const DEFAULT_PROFIT_MARGIN = 0.15;

// slider override if provided, else the locality's market cap rate
export function resolveCapRate(
  override?: number,
  loc: Locality = honolulu
): number {
  if (override != null && override > 0) return override;
  return loc.assumptions.market.cap_rate;
}

// retail cap rate spread above residential cap rate
export const RETAIL_CAP_SPREAD = 0.015;

// Bill 7's ground-floor commercial share when a lot has no zone: the AMX-1
// share up to 30 ft of height, the AMX-2 share above (Table 21-3.3)
export const COMMERCIAL_COVERAGE = {
  commercial1: 0.3,
  commercial2: 0.4,
};

// bill 7 grant amounts: post-construction per affordable unit (units under
// 300 sf get $40/sf of floor area), pre-construction per unit
export const GRANT = {
  pre_construct: 50000,
  post_construct: 12000,
  small_unit_sqft: 300,
  small_unit_per_sqft: 40,
};

// prevailing wages (HRS 104), required for the pre-construction subsidy only
export const PREVAILING_WAGE = {
  // on-site labor share of hard cost (2022 economic census, DBEDT data book
  // tables 21.05-21.06: 22-27%)
  onsite_labor_share: 0.25,
  // prevailing wage premium on that labor: median of 11 trades, dlir bulletin
  // 509 (basic + fringe) vs bls oews honolulu median wage plus 30% benefits
  // (27-83% by trade; test 35% and 55%)
  labor_premium: 0.45,
};

// post-construction grant for one affordable unit of the given floor area
export function postGrantPerUnit(unit_sqft: number): number {
  return unit_sqft < GRANT.small_unit_sqft
    ? unit_sqft * GRANT.small_unit_per_sqft
    : GRANT.post_construct;
}

// blended post-construction grant per affordable unit for a mix key, sized
// unit type by unit type
export function mixPostGrant(mix_key: string): number {
  const mix = UNIT_MIX[mix_key] ?? UNIT_MIX["one_bb_100"];
  return mix.reduce(
    (sum, m) => sum + postGrantPerUnit(UNIT_SIZE[m.type] ?? 500) * m.weight,
    0
  );
}

// parking: the default stalls per dwelling unit (TOD), and Honolulu's stall
// sizes, costs and rent, read from its config (assumptions.market.parking)
export const PARKING = {
  stalls_per_unit: 0,
  ...honoluluMarket.parking,
};

// ground-floor retail share of the floor plate
export const DEFAULT_RETAIL_SHARE = 0.1;

// Honolulu's minimum off-street parking (§ 21-6.20, Table 21-6.1) and joint
// use (§ 21-6.30(g), Table 21-6.2), for pathways that must provide parking.
// Read from its config (rules.parking); the functions below take a locality.
export const PARKING_MINIMUM = {
  // Honolulu's minimum is by floor area, so this is always set
  residential_sqft_per_stall: honolulu.rules.parking.residential_sqft_per_stall as number,
  retail_sqft_per_stall: honolulu.rules.parking.retail_sqft_per_stall,
  joint_use: honolulu.rules.parking.joint_use,
};

// Honolulu's off-street loading (§ 21-6.110) and space sizes (§ 21-6.130),
// read from its config (rules.loading)
export const LOADING = {
  min_lot_sqft: honolulu.rules.loading.min_lot_sqft,
  small_sqft: honolulu.rules.loading.small_space_sqft,
  large_sqft: honolulu.rules.loading.large_space_sqft,
};

// § 21-6.20(b)(1), § 21-6.110(b)(3): a fraction of 0.5 or more rounds up
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9);
}

/** legal minimum stalls per unit: 1 per so many sqft of private dwelling
 *  area (Honolulu: 1,000), or a flat number per unit where the locality sets
 *  one (Maui: 2); exempt parcels (§ 21-6.20(a)) pass `parking_exempt`
 *  instead */
export function legalParkingRatio(
  unit_type: string,
  loc: Locality = honolulu
): number {
  const { residential_stalls_per_unit, residential_sqft_per_stall } = loc.rules.parking;
  if (residential_stalls_per_unit != null) return residential_stalls_per_unit;
  if (residential_sqft_per_stall == null) {
    throw new Error(`${loc.name} (${loc.id}): no residential parking minimum`);
  }
  return mixUnitSize(unit_type) / residential_sqft_per_stall;
}

/** loading spaces for multifamily (by units) and retail (by floor area),
 *  with the joint-use rate when both need one (Honolulu: Table 21-6.5) */
export function loadingSpaces(
  units: number,
  retail_sqft: number,
  joint_use = 1,
  loc: Locality = honolulu
): number {
  const multifamily = evaluateSchedule(loc.rules.loading.multifamily_spaces, units);
  const retail = evaluateSchedule(loc.rules.loading.retail_spaces, retail_sqft);
  const joint = multifamily > 0 && retail > 0 ? joint_use : 1;
  return roundHalfUp(joint * (multifamily + retail));
}

/** ground area the loading spaces take, sqft: one small space, or a third
 *  of them large when more than one is required (Honolulu: § 21-6.130(a)) */
export function loadingSqft(spaces: number, loc: Locality = honolulu): number {
  const { small_space_sqft, large_space_sqft } = loc.rules.loading;
  if (spaces <= 0) return 0;
  if (spaces === 1) return small_space_sqft;
  const large = roundHalfUp(spaces / 3);
  return large * large_space_sqft + (spaces - large) * small_space_sqft;
}

/** Article 6 inputs to podiumEnvelope for a pathway that must provide
 *  parking: retail stalls, the joint-use rate and loading. An exempt lot
 *  (§ 21-6.20(a)) needs no stalls but still needs loading (§ 21-6.110).
 *  Bicycle parking follows the zone where one is given (Maui requires none);
 *  without a zone it is required, as in the original model. */
export function article6Parking(
  lot_sqft: number,
  parking_exempt = false,
  loc: Locality = honolulu,
  zone_class?: string
) {
  return {
    retail_stalls_per_sqft: parking_exempt
      ? 0
      : 1 / loc.rules.parking.retail_sqft_per_stall,
    joint_use: loc.rules.parking.joint_use,
    loading: lot_sqft > loc.rules.loading.min_lot_sqft,
    bicycle: zone_class == null ? true : bicycleRequired(zone_class, loc),
  };
}

// bicycle parking: installed cost per space, the same everywhere
// (GoodLockers, Nov 2025): a U-rack for short-term, a locker for long-term
const BICYCLE_COST_PER_SPACE = { short_term: 225, long_term: 1250 };

// Honolulu's bicycle parking (§ 21-6.40, Table 21-6.3), read from its config
// (rules.bicycle), with the installed costs above
export const BICYCLE_PARKING = {
  short_term: {
    ...honolulu.rules.bicycle.short_term,
    cost_per_space: BICYCLE_COST_PER_SPACE.short_term,
  },
  long_term: {
    ...honolulu.rules.bicycle.long_term,
    cost_per_space: BICYCLE_COST_PER_SPACE.long_term,
  },
  sqft_per_space: honolulu.rules.bicycle.sqft_per_space,
};

/** whether the zone requires bicycle parking (Honolulu: § 21-6.40(a), every
 *  district but industrial); a zone the config does not list requires it */
export function bicycleRequired(
  zone_class: string,
  loc: Locality = honolulu
): boolean {
  return zoneRules(loc, zone_class)?.bicycle_required ?? true;
}

/** short- and long-term spaces for the housing and the retail, with a
 *  fraction of 0.5 or more rounded up (Honolulu: Table 21-6.3, § 21-6.40(b)) */
export function bicycleSpaces(
  units: number,
  retail_sqft: number,
  retail_stalls: number,
  loc: Locality = honolulu
): { short_term: number; long_term: number } {
  const st = loc.rules.bicycle.short_term;
  const lt = loc.rules.bicycle.long_term;
  const up = (x: number) => Math.ceil(x - 1e-9);
  const retail = retail_sqft > 0;
  const short_retail = retail
    ? Math.max(
        up(retail_sqft / st.retail_sqft_per_space),
        up(retail_stalls / st.stalls_per_space)
      )
    : 0;
  const long_retail = retail
    ? Math.max(
        retail_sqft / lt.retail_sqft_per_space,
        up(retail_stalls / lt.stalls_per_space)
      )
    : 0;
  return {
    short_term: roundHalfUp(units / st.units_per_space + short_retail),
    long_term: roundHalfUp(units / lt.units_per_space + long_retail),
  };
}

// Honolulu's flat fees, read from its config (rules.fees). The school impact
// fee (HRS Ch. 302A) is a state assessment, so the city's waivable-fee toggle
// does not reach it; it is $0 for now instead of $1,836. The TOD zoning
// application fee belongs to the TOD pathway, which only Honolulu has.
const honoluluFees = honolulu.rules.fees;
export const FEES = {
  environment: { ...honoluluFees.environmental },
  administrative: { temp_occupancy_cert: honoluluFees.temp_occupancy_cert },
  park_dedication: { ...honoluluFees.park_dedication.application_fee },
  impact: { per_dwelling: honoluluFees.school_impact_per_unit },
  civil: {
    escp: honoluluFees.escp,
    installation_trench: honoluluFees.installation_trench,
    service_connection: honoluluFees.service_connection,
  },
  zoning: { tod_application: 15000 },
  wastewater_charge_per_esdu: honoluluFees.wastewater.charge_per_esdu,
};

// =========================================================
// BWS WATER CHARGES (one-time soft costs, paid at building permit)
// =========================================================

// Honolulu's Board of Water Supply charges, read from its config
// (rules.water); the functions below take a locality.
// Water System Facilities Charge, $/fixture unit; flat, never escalated.
// Multi-family rates only (single-family is not used).
export const WSFC_PER_FU = {
  // up to 3 living stories
  multi_low_rise: honolulu.rules.water.wsfc_per_fu.low_rise,
  // higher than 3 living stories
  multi_high_rise: honolulu.rules.water.wsfc_per_fu.high_rise,
};

// per application
export const WSFC_MIN_FU = honolulu.rules.water.min_fu;
// affordable-unit waiver cap, applied per project (BWS's is 500/yr islandwide)
export const WSFC_WAIVER_UNIT_CAP = honolulu.rules.water.waiver_unit_cap;

// fixture units per dwelling unit, low-flow; no dishwasher or hose bibb,
// in-unit washer
export const FU_PER_UNIT = {
  bath_1: 7.5,
  bath_1_5: 9.8,
  bath_2: 11.4,
} as const;

// baths assumed for each unit type
export const BATHS_BY_UNIT_TYPE: Record<string, keyof typeof FU_PER_UNIT> = {
  studio: "bath_1",
  one_bb: "bath_1",
  two_bb: "bath_1_5",
  three_bb: "bath_2",
  four_bb: "bath_2",
};

// matches BWS's worked examples
export const COMMON_AREA_FU = 0;

// new meter cost: fire service connection charge by meter size (inches)
export const FIRE_METER_CHARGE: Record<string, number> = {
  ...honolulu.rules.water.fire_meter_charge,
};

// which WSFC rate applies: low-rise up to the locality's story limit
// (Honolulu: 3 living stories), high-rise above
export function wsfcCategory(
  living_stories: number,
  loc: Locality = honolulu
): "multi_low_rise" | "multi_high_rise" {
  return living_stories <= loc.rules.water.low_rise_max_stories
    ? "multi_low_rise"
    : "multi_high_rise";
}

// blended fixture units per dwelling unit for a mix key; the locality's
// demand units instead where its water charge is by projected use (Maui)
export function mixFixtureUnits(mix_key: string, loc: Locality = honolulu): number {
  const mix = UNIT_MIX[mix_key] ?? UNIT_MIX["one_bb_100"];
  const demand = loc.rules.water.demand_per_unit;
  return mix.reduce(
    (sum, m) =>
      sum +
      (demand
        ? demand[m.type] ?? demand.one_bb
        : FU_PER_UNIT[BATHS_BY_UNIT_TYPE[m.type] ?? "bath_1"]) *
        m.weight,
    0
  );
}

// assumed fire meter size by residential stories
export function fireMeterSize(living_stories: number): string {
  if (living_stories <= 3) return "4";
  if (living_stories <= 6) return "6";
  return "8";
}

// residential stories built: residential floor area over the floor plate
export function livingStories(
  gross_residential_sqft: number,
  coverage_cap: number,
  setback_cap: number,
  floors: number
): number {
  const plate = Math.min(coverage_cap, setback_cap) / Math.max(floors, 1);
  if (plate <= 0 || gross_residential_sqft <= 0) return 0;
  return Math.ceil(gross_residential_sqft / plate - 1e-9);
}

// WSFC and new meter cost on the units the Impact Fees toggle doesn't waive
export function calcWaterFees(i: {
  max_units: number;
  water_chargeable_units: number;
  living_stories: number;
  fu_per_unit: number;
  // whose water charges apply; Honolulu by default
  loc?: Locality;
}): { wsfc: number; water_meter: number; total_fu: number } {
  if (i.max_units <= 0) return { wsfc: 0, water_meter: 0, total_fu: 0 };
  const water = (i.loc ?? honolulu).rules.water;
  const rate =
    wsfcCategory(i.living_stories, i.loc) === "multi_low_rise"
      ? water.wsfc_per_fu.low_rise
      : water.wsfc_per_fu.high_rise;
  const total_fu = Math.max(
    i.max_units * i.fu_per_unit + COMMON_AREA_FU,
    water.min_fu
  );
  const waived_units = i.max_units - i.water_chargeable_units;
  // WSFC is waived on the fixture units of the waived units
  const wsfc =
    i.water_chargeable_units > 0
      ? (total_fu - waived_units * i.fu_per_unit) * rate
      : 0;
  // the meter waiver is the waived units' share of all units
  const meter_gross = water.fire_meter_charge[fireMeterSize(i.living_stories)];
  const water_meter = (meter_gross * i.water_chargeable_units) / i.max_units;
  return { wsfc, water_meter, total_fu };
}

// =========================================================
// HHFDC AFFORDABLE SALE PRICE TABLES
// =========================================================
// 2025 HHFDC Honolulu County income limits by AMI % and family size (median
// $129,300), read from Honolulu's config (rules.income_limits)
export const INCOME_LIMITS: Record<number, number[]> = honolulu.rules.income_limits;

const HHFDC_RATES = [
  0.04, 0.0425, 0.045, 0.0475, 0.05, 0.0525, 0.055, 0.0575, 0.06, 0.0625, 0.065,
  0.0675, 0.07, 0.0725, 0.075,
];

type HhfdcTable = Record<number, Record<string, number>>;

const HHFDC_0BR: HhfdcTable = {
  0.04: {
    ami_50: 273700,
    ami_60: 328400,
    ami_70: 383200,
    ami_80: 437900,
    ami_90: 492700,
    ami_100: 547400,
    ami_110: 602100,
    ami_120: 656900,
    ami_130: 711600,
    ami_140: 766300,
  },
  0.0425: {
    ami_50: 265600,
    ami_60: 318700,
    ami_70: 371900,
    ami_80: 425000,
    ami_90: 478100,
    ami_100: 531200,
    ami_110: 584400,
    ami_120: 637500,
    ami_130: 690600,
    ami_140: 743700,
  },
  0.045: {
    ami_50: 257900,
    ami_60: 309500,
    ami_70: 361000,
    ami_80: 412600,
    ami_90: 464200,
    ami_100: 515800,
    ami_110: 567300,
    ami_120: 618900,
    ami_130: 670500,
    ami_140: 722100,
  },
  0.0475: {
    ami_50: 250500,
    ami_60: 300600,
    ami_70: 350700,
    ami_80: 400800,
    ami_90: 450900,
    ami_100: 501000,
    ami_110: 551100,
    ami_120: 601200,
    ami_130: 651300,
    ami_140: 701400,
  },
  0.05: {
    ami_50: 243400,
    ami_60: 292100,
    ami_70: 340800,
    ami_80: 389500,
    ami_90: 438100,
    ami_100: 486800,
    ami_110: 535500,
    ami_120: 584200,
    ami_130: 632900,
    ami_140: 681500,
  },
  0.0525: {
    ami_50: 236600,
    ami_60: 284000,
    ami_70: 331300,
    ami_80: 378600,
    ami_90: 425900,
    ami_100: 473300,
    ami_110: 520600,
    ami_120: 567900,
    ami_130: 615200,
    ami_140: 662600,
  },
  0.055: {
    ami_50: 230100,
    ami_60: 276200,
    ami_70: 322200,
    ami_80: 368200,
    ami_90: 414200,
    ami_100: 460300,
    ami_110: 506300,
    ami_120: 552300,
    ami_130: 598300,
    ami_140: 644400,
  },
  0.0575: {
    ami_50: 223900,
    ami_60: 268700,
    ami_70: 313500,
    ami_80: 358300,
    ami_90: 403000,
    ami_100: 447800,
    ami_110: 492600,
    ami_120: 537400,
    ami_130: 582200,
    ami_140: 626900,
  },
  0.06: {
    ami_50: 217900,
    ami_60: 261500,
    ami_70: 305100,
    ami_80: 348700,
    ami_90: 392300,
    ami_100: 435900,
    ami_110: 479500,
    ami_120: 523100,
    ami_130: 566600,
    ami_140: 610200,
  },
  0.0625: {
    ami_50: 212200,
    ami_60: 254700,
    ami_70: 297100,
    ami_80: 339500,
    ami_90: 382100,
    ami_100: 424400,
    ami_110: 466900,
    ami_120: 509300,
    ami_130: 551800,
    ami_140: 594200,
  },
  0.065: {
    ami_50: 206700,
    ami_60: 248100,
    ami_70: 289400,
    ami_80: 330800,
    ami_90: 372200,
    ami_100: 413500,
    ami_110: 454800,
    ami_120: 496100,
    ami_130: 537500,
    ami_140: 578800,
  },
  0.0675: {
    ami_50: 201500,
    ami_60: 241800,
    ami_70: 282000,
    ami_80: 322300,
    ami_90: 362700,
    ami_100: 402900,
    ami_110: 443200,
    ami_120: 483500,
    ami_130: 523800,
    ami_140: 564100,
  },
  0.07: {
    ami_50: 196400,
    ami_60: 235700,
    ami_70: 275000,
    ami_80: 314200,
    ami_90: 353600,
    ami_100: 392800,
    ami_110: 432000,
    ami_120: 471400,
    ami_130: 510600,
    ami_140: 549900,
  },
  0.0725: {
    ami_50: 191500,
    ami_60: 229900,
    ami_70: 268200,
    ami_80: 306500,
    ami_90: 344800,
    ami_100: 383100,
    ami_110: 421400,
    ami_120: 459700,
    ami_130: 498000,
    ami_140: 536300,
  },
  0.075: {
    ami_50: 186900,
    ami_60: 224300,
    ami_70: 261600,
    ami_80: 299000,
    ami_90: 336400,
    ami_100: 373800,
    ami_110: 411100,
    ami_120: 448500,
    ami_130: 485900,
    ami_140: 523300,
  },
};

const HHFDC_1BR: HhfdcTable = {
  0.04: {
    ami_50: 312800,
    ami_60: 375400,
    ami_70: 437900,
    ami_80: 500500,
    ami_90: 563000,
    ami_100: 625600,
    ami_110: 688100,
    ami_120: 750700,
    ami_130: 813300,
    ami_140: 875800,
  },
  0.0425: {
    ami_50: 303600,
    ami_60: 364300,
    ami_70: 425000,
    ami_80: 485700,
    ami_90: 546400,
    ami_100: 607100,
    ami_110: 667800,
    ami_120: 728500,
    ami_130: 789300,
    ami_140: 850000,
  },
  0.045: {
    ami_50: 294700,
    ami_60: 353700,
    ami_70: 412600,
    ami_80: 471600,
    ami_90: 530500,
    ami_100: 589500,
    ami_110: 648400,
    ami_120: 707300,
    ami_130: 766300,
    ami_140: 825200,
  },
  0.0475: {
    ami_50: 286300,
    ami_60: 343500,
    ami_70: 400800,
    ami_80: 458000,
    ami_90: 515300,
    ami_100: 572500,
    ami_110: 629800,
    ami_120: 687100,
    ami_130: 744300,
    ami_140: 801600,
  },
  0.05: {
    ami_50: 278200,
    ami_60: 333800,
    ami_70: 389500,
    ami_80: 445100,
    ami_90: 500700,
    ami_100: 556400,
    ami_110: 612000,
    ami_120: 667600,
    ami_130: 723300,
    ami_140: 778900,
  },
  0.0525: {
    ami_50: 270400,
    ami_60: 324500,
    ami_70: 378600,
    ami_80: 432700,
    ami_90: 486800,
    ami_100: 540900,
    ami_110: 594900,
    ami_120: 649000,
    ami_130: 703100,
    ami_140: 757200,
  },
  0.055: {
    ami_50: 263000,
    ami_60: 315600,
    ami_70: 368200,
    ami_80: 420800,
    ami_90: 473400,
    ami_100: 526000,
    ami_110: 578600,
    ami_120: 631200,
    ami_130: 683800,
    ami_140: 736400,
  },
  0.0575: {
    ami_50: 255900,
    ami_60: 307100,
    ami_70: 358300,
    ami_80: 409400,
    ami_90: 460600,
    ami_100: 511800,
    ami_110: 563000,
    ami_120: 614100,
    ami_130: 665300,
    ami_140: 716500,
  },
  0.06: {
    ami_50: 249100,
    ami_60: 298900,
    ami_70: 348700,
    ami_80: 398500,
    ami_90: 448300,
    ami_100: 498200,
    ami_110: 548000,
    ami_120: 597800,
    ami_130: 647600,
    ami_140: 697400,
  },
  0.0625: {
    ami_50: 242500,
    ami_60: 291000,
    ami_70: 339500,
    ami_80: 388100,
    ami_90: 436600,
    ami_100: 485100,
    ami_110: 533600,
    ami_120: 582200,
    ami_130: 630600,
    ami_140: 679100,
  },
  0.065: {
    ami_50: 236300,
    ami_60: 283500,
    ami_70: 330800,
    ami_80: 378000,
    ami_90: 425300,
    ami_100: 472500,
    ami_110: 519800,
    ami_120: 567300,
    ami_130: 614300,
    ami_140: 661500,
  },
  0.0675: {
    ami_50: 230000,
    ami_60: 276300,
    ami_70: 322300,
    ami_80: 368400,
    ami_90: 414400,
    ami_100: 460600,
    ami_110: 506500,
    ami_120: 552900,
    ami_130: 598600,
    ami_140: 644700,
  },
  0.07: {
    ami_50: 224500,
    ami_60: 269400,
    ami_70: 314200,
    ami_80: 359000,
    ami_90: 404000,
    ami_100: 449000,
    ami_110: 493700,
    ami_120: 539000,
    ami_130: 583600,
    ami_140: 628600,
  },
  0.0725: {
    ami_50: 218900,
    ami_60: 262700,
    ami_70: 306500,
    ami_80: 350000,
    ami_90: 394000,
    ami_100: 438100,
    ami_110: 481600,
    ami_120: 525800,
    ami_130: 569200,
    ami_140: 613200,
  },
  0.075: {
    ami_50: 213600,
    ami_60: 256300,
    ami_70: 299000,
    ami_80: 341700,
    ami_90: 384400,
    ami_100: 427000,
    ami_110: 469900,
    ami_120: 512600,
    ami_130: 555300,
    ami_140: 598000,
  },
};

const HHFDC_2BR: HhfdcTable = {
  0.04: {
    ami_50: 351900,
    ami_60: 422300,
    ami_70: 492700,
    ami_80: 563000,
    ami_90: 633400,
    ami_100: 703800,
    ami_110: 774200,
    ami_120: 844500,
    ami_130: 914900,
    ami_140: 985300,
  },
  0.0425: {
    ami_50: 341500,
    ami_60: 409800,
    ami_70: 478100,
    ami_80: 546400,
    ami_90: 614700,
    ami_100: 683000,
    ami_110: 751300,
    ami_120: 819600,
    ami_130: 887900,
    ami_140: 956200,
  },
  0.045: {
    ami_50: 331600,
    ami_60: 397900,
    ami_70: 464200,
    ami_80: 530500,
    ami_90: 596800,
    ami_100: 663100,
    ami_110: 729400,
    ami_120: 795800,
    ami_130: 862100,
    ami_140: 928400,
  },
  0.0475: {
    ami_50: 322100,
    ami_60: 386500,
    ami_70: 450900,
    ami_80: 515300,
    ami_90: 579700,
    ami_100: 644100,
    ami_110: 708500,
    ami_120: 772900,
    ami_130: 837300,
    ami_140: 901800,
  },
  0.05: {
    ami_50: 313000,
    ami_60: 375500,
    ami_70: 438100,
    ami_80: 500700,
    ami_90: 563300,
    ami_100: 625900,
    ami_110: 688500,
    ami_120: 751100,
    ami_130: 813700,
    ami_140: 876300,
  },
  0.0525: {
    ami_50: 304200,
    ami_60: 365100,
    ami_70: 425900,
    ami_80: 486800,
    ami_90: 547600,
    ami_100: 608500,
    ami_110: 669300,
    ami_120: 730200,
    ami_130: 791000,
    ami_140: 851900,
  },
  0.055: {
    ami_50: 295900,
    ami_60: 355100,
    ami_70: 414200,
    ami_80: 473400,
    ami_90: 532600,
    ami_100: 591800,
    ami_110: 650900,
    ami_120: 710100,
    ami_130: 769300,
    ami_140: 828500,
  },
  0.0575: {
    ami_50: 287900,
    ami_60: 345500,
    ami_70: 403000,
    ami_80: 460600,
    ami_90: 518200,
    ami_100: 575800,
    ami_110: 633300,
    ami_120: 690900,
    ami_130: 748500,
    ami_140: 806100,
  },
  0.06: {
    ami_50: 280200,
    ami_60: 336300,
    ami_70: 392300,
    ami_80: 448300,
    ami_90: 504400,
    ami_100: 560400,
    ami_110: 616500,
    ami_120: 672500,
    ami_130: 728500,
    ami_140: 784600,
  },
  0.0625: {
    ami_50: 272900,
    ami_60: 327400,
    ami_70: 382000,
    ami_80: 436600,
    ami_90: 491100,
    ami_100: 545700,
    ami_110: 600300,
    ami_120: 654700,
    ami_130: 709400,
    ami_140: 764000,
  },
  0.065: {
    ami_50: 265800,
    ami_60: 319000,
    ami_70: 372100,
    ami_80: 425300,
    ami_90: 478400,
    ami_100: 531600,
    ami_110: 584700,
    ami_120: 637900,
    ami_130: 691100,
    ami_140: 744200,
  },
  0.0675: {
    ami_50: 259000,
    ami_60: 310800,
    ami_70: 362600,
    ami_80: 414400,
    ami_90: 466200,
    ami_100: 518000,
    ami_110: 569700,
    ami_120: 621600,
    ami_130: 673900,
    ami_140: 725300,
  },
  0.07: {
    ami_50: 252500,
    ami_60: 303000,
    ami_70: 353500,
    ami_80: 404000,
    ami_90: 454500,
    ami_100: 505000,
    ami_110: 555500,
    ami_120: 606000,
    ami_130: 656500,
    ami_140: 707000,
  },
  0.0725: {
    ami_50: 246300,
    ami_60: 295500,
    ami_70: 344800,
    ami_80: 394000,
    ami_90: 443300,
    ami_100: 492500,
    ami_110: 541800,
    ami_120: 591000,
    ami_130: 640300,
    ami_140: 689600,
  },
  0.075: {
    ami_50: 240300,
    ami_60: 288300,
    ami_70: 336400,
    ami_80: 384400,
    ami_90: 432500,
    ami_100: 480500,
    ami_110: 528600,
    ami_120: 576600,
    ami_130: 624700,
    ami_140: 672800,
  },
};

const HHFDC_3BR: HhfdcTable = {
  0.04: {
    ami_50: 391000,
    ami_60: 469200,
    ami_70: 547400,
    ami_80: 625600,
    ami_90: 703800,
    ami_100: 782000,
    ami_110: 860200,
    ami_120: 938400,
    ami_130: 1016600,
    ami_140: 1094800,
  },
  0.0425: {
    ami_50: 379500,
    ami_60: 455300,
    ami_70: 531200,
    ami_80: 607100,
    ami_90: 683000,
    ami_100: 758900,
    ami_110: 834800,
    ami_120: 910700,
    ami_130: 986600,
    ami_140: 1062500,
  },
  0.045: {
    ami_50: 368400,
    ami_60: 442100,
    ami_70: 515800,
    ami_80: 589500,
    ami_90: 663100,
    ami_100: 736800,
    ami_110: 810500,
    ami_120: 884200,
    ami_130: 957900,
    ami_140: 1031500,
  },
  0.0475: {
    ami_50: 357800,
    ami_60: 429400,
    ami_70: 501000,
    ami_80: 572500,
    ami_90: 644100,
    ami_100: 715700,
    ami_110: 787200,
    ami_120: 858800,
    ami_130: 930400,
    ami_140: 1002000,
  },
  0.05: {
    ami_50: 347700,
    ami_60: 417300,
    ami_70: 486800,
    ami_80: 556400,
    ami_90: 625900,
    ami_100: 695500,
    ami_110: 765000,
    ami_120: 834500,
    ami_130: 904100,
    ami_140: 973600,
  },
  0.0525: {
    ami_50: 338000,
    ami_60: 405600,
    ami_70: 473300,
    ami_80: 540900,
    ami_90: 608500,
    ami_100: 676100,
    ami_110: 743700,
    ami_120: 811300,
    ami_130: 878900,
    ami_140: 946500,
  },
  0.055: {
    ami_50: 328800,
    ami_60: 394500,
    ami_70: 460300,
    ami_80: 526000,
    ami_90: 591800,
    ami_100: 657500,
    ami_110: 723300,
    ami_120: 789000,
    ami_130: 854800,
    ami_140: 920500,
  },
  0.0575: {
    ami_50: 319900,
    ami_60: 383800,
    ami_70: 447800,
    ami_80: 511800,
    ami_90: 575800,
    ami_100: 639700,
    ami_110: 703700,
    ami_120: 767700,
    ami_130: 831700,
    ami_140: 895600,
  },
  0.06: {
    ami_50: 311300,
    ami_60: 373600,
    ami_70: 435900,
    ami_80: 498200,
    ami_90: 560400,
    ami_100: 622700,
    ami_110: 685000,
    ami_120: 747200,
    ami_130: 809500,
    ami_140: 871800,
  },
  0.0625: {
    ami_50: 303200,
    ami_60: 363800,
    ami_70: 424400,
    ami_80: 485100,
    ami_90: 545700,
    ami_100: 606300,
    ami_110: 667000,
    ami_120: 727600,
    ami_130: 788200,
    ami_140: 848900,
  },
  0.065: {
    ami_50: 295300,
    ami_60: 354400,
    ami_70: 413500,
    ami_80: 472500,
    ami_90: 531600,
    ami_100: 590700,
    ami_110: 649700,
    ami_120: 708800,
    ami_130: 767800,
    ami_140: 826900,
  },
  0.0675: {
    ami_50: 287800,
    ami_60: 345400,
    ami_70: 402900,
    ami_80: 460500,
    ami_90: 518000,
    ami_100: 575600,
    ami_110: 633200,
    ami_120: 690700,
    ami_130: 748300,
    ami_140: 805800,
  },
  0.07: {
    ami_50: 280600,
    ami_60: 336700,
    ami_70: 392800,
    ami_80: 448900,
    ami_90: 505000,
    ami_100: 561100,
    ami_110: 617300,
    ami_120: 673400,
    ami_130: 729500,
    ami_140: 785600,
  },
  0.0725: {
    ami_50: 273600,
    ami_60: 328400,
    ami_70: 383100,
    ami_80: 437800,
    ami_90: 492500,
    ami_100: 547300,
    ami_110: 602000,
    ami_120: 656700,
    ami_130: 711400,
    ami_140: 766200,
  },
  0.075: {
    ami_50: 267000,
    ami_60: 320400,
    ami_70: 373800,
    ami_80: 427100,
    ami_90: 480500,
    ami_100: 533900,
    ami_110: 587300,
    ami_120: 640700,
    ami_130: 694100,
    ami_140: 747500,
  },
};

const HHFDC_4BR: HhfdcTable = {
  0.04: {
    ami_50: 422400,
    ami_60: 506900,
    ami_70: 591300,
    ami_80: 675800,
    ami_90: 760300,
    ami_100: 844800,
    ami_110: 929200,
    ami_120: 1013700,
    ami_130: 1098200,
    ami_140: 1182700,
  },
  0.0425: {
    ami_50: 409900,
    ami_60: 491900,
    ami_70: 573900,
    ami_80: 655800,
    ami_90: 737800,
    ami_100: 819800,
    ami_110: 901800,
    ami_120: 983800,
    ami_130: 1065800,
    ami_140: 1147700,
  },
  0.045: {
    ami_50: 398000,
    ami_60: 477600,
    ami_70: 557200,
    ami_80: 636800,
    ami_90: 716400,
    ami_100: 796000,
    ami_110: 875500,
    ami_120: 955100,
    ami_130: 1034700,
    ami_140: 1114300,
  },
  0.0475: {
    ami_50: 386600,
    ami_60: 463900,
    ami_70: 541200,
    ami_80: 618500,
    ami_90: 695800,
    ami_100: 773100,
    ami_110: 850400,
    ami_120: 927700,
    ami_130: 1005100,
    ami_140: 1082400,
  },
  0.05: {
    ami_50: 375600,
    ami_60: 450800,
    ami_70: 525900,
    ami_80: 601000,
    ami_90: 676100,
    ami_100: 751300,
    ami_110: 826400,
    ami_120: 901500,
    ami_130: 976700,
    ami_140: 1051800,
  },
  0.0525: {
    ami_50: 365200,
    ami_60: 438200,
    ami_70: 511200,
    ami_80: 584300,
    ami_90: 657300,
    ami_100: 730300,
    ami_110: 803400,
    ami_120: 876400,
    ami_130: 949400,
    ami_140: 1022500,
  },
  0.055: {
    ami_50: 355100,
    ami_60: 426200,
    ami_70: 497200,
    ami_80: 568200,
    ami_90: 639300,
    ami_100: 710300,
    ami_110: 781300,
    ami_120: 852400,
    ami_130: 923400,
    ami_140: 994400,
  },
  0.0575: {
    ami_50: 345500,
    ami_60: 414700,
    ami_70: 483800,
    ami_80: 552900,
    ami_90: 622000,
    ami_100: 691100,
    ami_110: 760200,
    ami_120: 829300,
    ami_130: 898400,
    ami_140: 967500,
  },
  0.06: {
    ami_50: 336300,
    ami_60: 403600,
    ami_70: 470900,
    ami_80: 538100,
    ami_90: 605400,
    ami_100: 672700,
    ami_110: 739900,
    ami_120: 807200,
    ami_130: 874500,
    ami_140: 941700,
  },
  0.0625: {
    ami_50: 327500,
    ami_60: 393000,
    ami_70: 458500,
    ami_80: 524000,
    ami_90: 589500,
    ami_100: 655000,
    ami_110: 720500,
    ami_120: 786000,
    ami_130: 851500,
    ami_140: 917000,
  },
  0.065: {
    ami_50: 319000,
    ami_60: 382800,
    ami_70: 446600,
    ami_80: 510400,
    ami_90: 574300,
    ami_100: 638100,
    ami_110: 701900,
    ami_120: 765700,
    ami_130: 829500,
    ami_140: 893300,
  },
  0.0675: {
    ami_50: 310900,
    ami_60: 373100,
    ami_70: 435300,
    ami_80: 497400,
    ami_90: 559600,
    ami_100: 621800,
    ami_110: 684000,
    ami_120: 746200,
    ami_130: 808300,
    ami_140: 870500,
  },
  0.07: {
    ami_50: 303100,
    ami_60: 363700,
    ami_70: 424300,
    ami_80: 485000,
    ami_90: 545600,
    ami_100: 606200,
    ami_110: 666800,
    ami_120: 727400,
    ami_130: 788000,
    ami_140: 848700,
  },
  0.0725: {
    ami_50: 295600,
    ami_60: 354700,
    ami_70: 413800,
    ami_80: 473000,
    ami_90: 532100,
    ami_100: 591200,
    ami_110: 650300,
    ami_120: 709400,
    ami_130: 768600,
    ami_140: 827700,
  },
  0.075: {
    ami_50: 288400,
    ami_60: 346100,
    ami_70: 403800,
    ami_80: 461400,
    ami_90: 519100,
    ami_100: 576800,
    ami_110: 634500,
    ami_120: 692100,
    ami_130: 749800,
    ami_140: 807500,
  },
};

const HHFDC_TABLES: Record<string, HhfdcTable> = {
  studio: HHFDC_0BR,
  one_bb: HHFDC_1BR,
  two_bb: HHFDC_2BR,
  three_bb: HHFDC_3BR,
  four_bb: HHFDC_4BR,
};

// =========================================================
// TYPES
// =========================================================

export type ProgramId = "bill7" | "standard" | "tod" | "h201" | "bill6";

export interface SliderInputs {
  program: ProgramId;
  /** whose rules apply, a locality id such as "hi-maui"; Honolulu if unset */
  locality?: string;
  lot_sqft?: number;
  height_limit?: number;
  floor_height?: number;
  zone_class?: string;
  rental_split?: number;
  sale_split?: number;
  market_price?: number;
  target_return?: number;
  profit_margin?: number;
  affordable_ami?: string;
  /** § 21-3.120-2(b) open-space FAR bonus on offer, in FAR, included in
   *  max_far. It costs lot_sqft/5 of ground per 1.0 FAR, so it is both an
   *  uplift and a land cost; calcSingle takes it only if it raises the
   *  residual land value. */
  open_space_bonus?: number;
  /** FAR without the open-space bonus, for that comparison. Defaults to
   *  max_far - open_space_bonus. */
  far_without_bonus?: number;
  market_ami?: string;
  construction_rate?: number;
  equity?: number;
  grant_type?: "none" | "pre_construct" | "post_construct";
  grant_amount?: number;
  // units the pre-construction subsidy pays on (ROH 32-5.2(c)(2): "each unit")
  grant_units?: "all" | "affordable";
  // pre-construction only: premium on on-site labor
  prevailing_wage_premium?: number;
  // on-site labor share of hard cost
  onsite_labor_share?: number;
  land_cost?: number;
  permanent_rate?: number;
  hold_years?: number;
  amort_years?: number;
  leaseup_months?: number;
  min_dscr?: number;
  include_retail?: boolean;
  retail_rent?: number;
  // ground-floor retail as a share of the floor plate
  retail_share?: number;
  // parking stalls per dwelling unit
  parking_ratio?: number;
  // § 21-6.20(a): no off-street parking required (Primary Urban Center and
  // Ewa plan areas, within 0.5 miles of rail, TOD special districts)
  parking_exempt?: boolean;
  // § 21-9.100-8(c)(1): no ground-floor parking within this many feet of
  // the front lot line (TOD special districts)
  front_no_parking_ft?: number;
  // a legal cap on dwelling units (TOD: IMX-1 under PD-T)
  max_units?: number;
  // height step-back; off unless stepback_trigger_ft is set
  stepback_trigger_ft?: number;
  stepback_above_ft?: number;
  stepback_ft_per_10ft?: number;
  mortgage?: number;
  park?: "exempt" | "in_lieu";
  permitting_months?: number;
  const_months?: number;
  unit_type?: string;
  impact_fee?: number;
  affordability?: number;
  cap_rate?: number;
  target_spread?: number;
  setback?: number;
  // building-lot coverage cap
  coverage?: number;
  opex_ratio?: number;
  hard_cost_per_sqft?: number;
  building_area_per_unit?: number;
  max_far?: number;
  waivable_fee_basis?: FeeBasis;
}

export interface ParcelOutput {
  tmk: string;
  zone_class: string;
  lot_sqft: number;
  // effective height limit the envelope was built to
  height_limit: number;
  // open-space FAR bonus taken; 0 when the project does better without it
  open_space_bonus?: number;
  buildable_sqft: number;
  net_residential_sqft: number;
  net_commercial_sqft: number;
  max_units: number;
  parking_stalls: number;
  // § 21-6.110 loading spaces, in the parking area
  loading_spaces?: number;
  // § 21-6.40 bicycle parking spaces, short- and long-term
  bicycle_spaces?: number;
  bicycle_short_term?: number;
  bicycle_long_term?: number;
  // where the stalls go: a surface lot, the ground floor, or podium floors
  surface_stalls?: number;
  ground_floor_stalls?: number;
  podium_stalls?: number;
  // parking levels above the ground floor
  podium_levels: number;
  parking_sqft: number;
  // share of the building's gross area used for parking
  parking_share: number;
  affordable_units: number;
  afd_rent_units: number;
  mkt_rent_units: number;
  afd_sale_units: number;
  mkt_sale_units: number;
  hard_cost: number;
  soft_cost: number;
  // soft_cost by line item (fees, permits, water charges, construction
  // management); absent when nothing is built
  soft_cost_breakdown?: SoftCostBreakdown;
  dev_cost: number;
  total_financing_cost: number;
  // financing cost of the construction-only loan that RLV is computed on;
  // total_financing_cost above is the deal loan, sized with land in the base
  rlv_financing_cost: number;
  pre_construction_subsidy: number;
  // bill 7 pre-construction: wage premium in hard_cost, and the subsidy cap
  pw_premium_cost?: number;
  subsidy_labor_cap?: number;
  subsidy_cap_binds?: boolean;
  equity_amount: number;
  loan_balance_at_stab: number;
  permitting_months: number;
  const_months: number;
  leaseup_months: number;
  sales_months: number;
  total_carry_months: number;
  total_months: number;
  project_years: number;
  pri: number;
  pgi: number;
  residential_egi: number;
  retail_pgi: number;
  retail_egi: number;
  egi: number;
  gross_sales: number;
  afd_sales: number;
  mkt_sales: number;
  residential_opex: number;
  retail_opex: number;
  operating_expenses: number;
  property_tax: number;
  noi: number;
  cap_rate: number;
  gdv: number;
  dev_strategy: "dev_flip" | "hold";
  dev_hold_years: number;
  dev_post_grant: number;
  dev_land_cost: number;
  dev_total_dev_cost: number;
  // capital subsidy netted out of the ROC basis (grants that fund the build)
  dev_capital_subsidy: number;
  dev_net_dev_cost: number;
  dev_levered_irr: number;
  dev_equity_multiple: number;
  dev_profit: number;
  dev_roc: number;
  dev_equity_invested: number;
  dev_equity_out: number;
  dev_gdv: number;
  dev_selling_costs: number;
  dev_loan_payoff: number;
  dev_perm_principal: number | null;
  dev_perm_rate: number | null;
  dev_annual_debt_svc: number | null;
  dev_dscr: number | null;
  // equity share of the amount financed after the construction loan is sized
  // to the DSCR (the slider is a floor)
  dev_equity_pct_realized: number;
  dev_dscr_binds: boolean;
  dev_is_bankable: boolean | null;
  dev_cash_on_cash: number | null;
  dev_entry_cap: number | null;
  dev_exit_cap: number | null;
  dev_yr1_prop_tax: number | null;
  dev_investment_spread: number;
  dev_target_roc: number;
  dev_is_feasible: boolean;
  total_predev_cost: number;
  construction_equity: number;
  rlv_selling_costs: number;
  // grants discounted to the land purchase at the target return
  rlv_grants_pv: number;
  // (1 + target return) ^ years to stabilization
  rlv_land_carry: number;
  rlv_profit: number;
  rlv_project_cost: number;
  rlv: number;
  rlv_sqft: number;
  dev_roi: number;
}

// soft cost waiver types
export type FeeBasis = "all_units" | "market_units" | "none";

// soft cost inputs (shared across all pathways)
export type SoftCostInputs = {
  hard_cost: number;
  lot_sqft: number;
  max_units: number;
  affordable_units: number;
  excavation_depth: number;
  park: "exempt" | "in_lieu" | "none";
  park_area: number;
  land_cost_per_sqft: number;
  waivable_fee_basis: FeeBasis;
  // school impact fees don't include in waivable_fee_basis as it's a state fee not city
  impact_fee_per_unit: number;
  zoning_application_fee?: number;
  special_district_fee?: number;
  // BWS water charges
  living_stories: number;
  fu_per_unit: number;
  // whose fee schedules and water charges apply; Honolulu by default
  loc?: Locality;
};

// soft cost line items (shared across all pathways)
export type SoftCostBreakdown = {
  environmental: number;
  building_permit: number;
  plan_review: number;
  wastewater: number;
  wsfc: number;
  water_meter: number;
  temp_occupancy: number;
  park_dedication: number;
  escp: number;
  utilities: number;
  grubbing: number;
  stockpiling: number;
  grading: number;
  impact: number;
  construction_mgmt: number;
  zoning_application: number;
  special_district: number;
  total: number;
};

// =========================================================
// HELPER FUNCTIONS
// =========================================================

// zone-based FAR formula
// FAR before Ord. 26-7, scaled by lot size (the Standard pathway). The
// tables are in the locality's zoning config; the open-space bonus
// (§ 21-3.120-2(c)) is added by each pathway that allows it
// (openSpaceBonusOver).
export function calcFAR(
  zone_class: string,
  lot_sqft: number,
  loc: Locality = honolulu
): number {
  return zoneFar(loc, zone_class, "standard", lot_sqft);
}

// ── Transit permits — see the model documentation ────────────────────────

// § 21-9.100-5(b)(5)
export const TOD_ELIGIBLE_DISTRICTS = [
  "A-1", "A-2", "A-3",
  "AMX-1", "AMX-2", "AMX-3",
  "B-1", "B-2",
  "BMX-3", "BMX-4",
  "Resort", "ResCom", "ResMix",
  "I-1", "I-2", "I-3",
  "IMX-1",
];

// § 21-9.100-5(b)(3), single-lot floor
export const TOD_MIN_LOT_SQFT = 20000;

// § 21-9.100-5(e)
export const TOD_MAX_FAR = 7.5;
export const TOD_MAX_HEIGHT_FT = 450;

/** whether the IPD-T bonuses are available at all */
export function todEligible(zone_class: string, lot_sqft: number): boolean {
  return (
    TOD_ELIGIBLE_DISTRICTS.includes(zone_class) && lot_sqft >= TOD_MIN_LOT_SQFT
  );
}

// § 21-9.100-5(d)(1). Use-driven only; the envelope keeps the real district.
export function todUseZone(zone_class: string): string {
  return zone_class === "BMX-4" ? "BMX-4" : "BMX-3";
}

// § 21-9.100-5(e)(1). DOUBLE_AFTER_BONUS orders it 2 x (base + bonus).
// § 21-9.100-5(e)(1)(C): FAR doubles after the open-space bonus in these only
const DOUBLE_AFTER_BONUS = ["B-2", "BMX-3", "BMX-4", "IMX-1"];

// § 21-3.120-2(c) ceilings; the bonus is the gap from base FAR. Honolulu's,
// read from its zoning config (each zone's open_space_far_ceiling).
export const OPEN_SPACE_FAR_CEILING: Record<string, number> = Object.fromEntries(
  Object.entries(honolulu.rules.zones).flatMap(([zone, rules]) =>
    rules.open_space_far_ceiling == null ? [] : [[zone, rules.open_space_far_ceiling]]
  )
);

/**
 * Base FAR for TOD: the current (Ord. 26-7) figure in the Table 21-3.3
 * apartment districts, the Standard FAR for the rest. The locality's zoning
 * config holds it as the `tod` pathway's FAR.
 */
export function baseFar(
  zone_class: string,
  lot_sqft = 0,
  loc: Locality = honolulu
): number {
  return zoneFar(loc, zone_class, "tod", lot_sqft);
}

/** largest open-space bonus the district allows, in FAR */
export function openSpaceBonus(
  zone_class: string,
  loc: Locality = honolulu
): number {
  return openSpaceBonusOver(zone_class, baseFar(zone_class, 0, loc), loc);
}

/** open-space bonus on top of a pathway's own FAR, up to the district ceiling */
export function openSpaceBonusOver(
  zone_class: string,
  far: number,
  loc: Locality = honolulu
): number {
  const ceiling = zoneRules(loc, zone_class)?.open_space_far_ceiling;
  return ceiling == null ? 0 : Math.max(0, ceiling - far);
}

/** lot left for the building once the bonus's public open space (5:1) is set aside */
export function lotAfterOpenSpace(lot_sqft: number, bonus = 0): number {
  return lot_sqft - Math.min(lot_sqft, (bonus * lot_sqft) / 5);
}

export function calcFarTod(
  zone_class: string,
  lot_sqft: number,
  // defaults to the district ceiling; 0 = no public open space provided
  density_bonus?: number,
  plan_far?: number
): number {
  if (!todEligible(zone_class, lot_sqft)) {
    return baseFar(zone_class, lot_sqft);
  }
  const base = baseFar(zone_class, lot_sqft);
  const bonus = density_bonus ?? openSpaceBonus(zone_class);
  const doubled = DOUBLE_AFTER_BONUS.includes(zone_class)
    ? 2 * (base + bonus)
    : 2 * base + bonus;
  const capped = Math.min(doubled, TOD_MAX_FAR);
  return plan_far != null && plan_far > capped ? plan_far : capped;
}

// § 21-9.100-8(a)(1)(A). B-1, BMX-4 and resort are absent from the ladder.
export type TodPermitRoute = "base" | "minor_sd" | "major_sd" | "pdt";

const PDT_SCALED = ["A-1", "A-2", "A-3", "AMX-1", "AMX-2", "AMX-3", "I-1", "I-2", "I-3", "IMX-1"];

export function calcFarPdt(
  zone_class: string,
  lot_sqft: number,
  route: TodPermitRoute = "pdt"
): number {
  const base = baseFar(zone_class, lot_sqft);
  if (route === "base") return base;
  if (zone_class === "BMX-3" || zone_class === "B-2") {
    return route === "pdt" ? 7.0 : 3.5;
  }
  if (PDT_SCALED.includes(zone_class)) {
    return route === "pdt" ? 2.0 * base : 1.2 * base;
  }
  // B-1, BMX-4, resort: no uplift path
  return base;
}

// § 21-9.100-8(a)(1)(D): every route goes up to the map's parenthetical bonus
// height where one is shown; PD-T approval reaches the parenthetical, or the
// major permit height where the map shows none.
export function todHeightPdt(
  base_height: number,
  route: TodPermitRoute = "pdt",
  map_bonus_height?: number
): number {
  const major = Math.min(base_height + 120, 3 * base_height);
  const capped = (height: number) =>
    Math.max(
      base_height,
      map_bonus_height != null ? Math.min(height, map_bonus_height) : height
    );
  switch (route) {
    case "base":
      return base_height;
    case "minor_sd":
      return capped(Math.min(base_height + 60, 2 * base_height));
    case "major_sd":
      return capped(major);
    case "pdt":
      return Math.max(base_height, map_bonus_height ?? major);
  }
}

// Table 21-5.1 bars multi-unit dwelling in industrial districts; IPD-T lifts
// that via the BMX-3 use import (§ 21-9.100-5(d)(1)). Under PD-T only IMX-1
// may have dwellings: up to 10 per zoning lot above the ground floor, with a
// special district permit (§ 21-9.100-7(c)).
const INDUSTRIAL = ["I-1", "I-2", "I-3", "IMX-1"];
export const IMX1_PDT_MAX_UNITS = 10;

export type ResidentialUse = "permitted" | "discretionary" | "not_permitted";

export function residentialUse(
  zone_class: string,
  regime: "pdt" | "ipdt"
): ResidentialUse {
  if (!INDUSTRIAL.includes(zone_class)) return "permitted";
  if (regime === "ipdt") return "permitted"; // BMX-3 uses imported
  return zone_class === "IMX-1" ? "discretionary" : "not_permitted";
}

// Community-benefit ceilings by precinct. A null falls back to the
// § 21-9.100-5(e)(1)(A) formula, correct where a plan is silent.
export interface TodPlanStandards {
  /** core TOD Precinct, <= 1/4 mile */
  core_max_far: number | null;

  core_max_height: number | null;
  /** TIZ Precinct, 1/4 to 1/2 mile */
  tiz_max_far: number | null;
  tiz_max_height: number | null;
  /** figures came from the quarter-mile proxy, not the plan's own polygons */
  approximate?: boolean;
  source: string;
}

export const TOD_PLAN_STANDARDS: Record<string, TodPlanStandards> = {
  // Figs. 5-3 / 5-4, quarter-mile proxy
  "Ala Moana": {
    core_max_far: 10.0,
    core_max_height: 400,
    tiz_max_far: 7.0,
    tiz_max_height: 350,
    approximate: true,
    source:
      "Ala Moana Neighborhood TOD Plan Figs. 5-3 / 5-4, quarter-mile proxy; corroborated by Res. 20-174 (KCR 10.0/400ft), 17-175 (9.95/400ft), 17-221 (9.215/400ft), 20-315 (7.0/400ft)",
  },
  // Figs. 2-6 / 2-7, same proxy.
  Downtown: {
    core_max_far: 7.5,
    core_max_height: 400,
    tiz_max_far: 4.5,
    tiz_max_height: 250,
    approximate: true,
    source: "Downtown Neighborhood TOD Plan Figs. 2-6 / 2-7, quarter-mile proxy",
  },
  // Maps published but not yet read; parcels stay not_modeled.
  // Fig. 2-7. FAR map not transcribed.
  Kalihi: { core_max_far: null, core_max_height: 200, tiz_max_far: null, tiz_max_height: 150, approximate: true, source: "Kalihi Neighborhood TOD Plan Fig. 2-7, quarter-mile proxy" },
  // no plan height map published; base height governs
  Airport: { core_max_far: null, core_max_height: null, tiz_max_far: null, tiz_max_height: null, source: "no plan height map published; base height governs" },
  // heights come per parcel from TOD_Zoning - Proposed
  "East Kapolei": { core_max_far: null, core_max_height: null, tiz_max_far: null, tiz_max_height: null, source: "per-parcel heights from TOD_Zoning - Proposed" },
  // PD-T: the § 21-9.100-8 ladders apply instead
  Waipahu: { core_max_far: null, core_max_height: null, tiz_max_far: null, tiz_max_height: null, source: "PD-T; see § 21-9.100-8(a)(1)" },
  "Aiea-Pearl City": { core_max_far: null, core_max_height: null, tiz_max_far: null, tiz_max_height: null, source: "PD-T; see § 21-9.100-8(a)(1)" },
  Halawa: { core_max_far: null, core_max_height: null, tiz_max_far: null, tiz_max_height: null, source: "PD-T; see § 21-9.100-8(a)(1)" },
};

/** nulls where the plan is silent or untranscribed */
export function todPlanCeiling(
  station_area: string | null,
  precinct: "core" | "tiz"
): { far: number | null; height: number | null; approximate: boolean } {
  const std = station_area ? TOD_PLAN_STANDARDS[station_area] : undefined;
  if (!std) return { far: null, height: null, approximate: false };
  const approximate = std.approximate === true;
  return precinct === "core"
    ? { far: std.core_max_far, height: std.core_max_height, approximate }
    : { far: std.tiz_max_far, height: std.tiz_max_height, approximate };
}

// § 21-9.100-5(e)(2): where there is no draft neighborhood TOD plan, height may
// be up to twice the underlying limit or 450 ft, whichever is lower. Where a
// draft or approved plan exists its maximum governs, except that an existing
// higher limit prevails.
export function todHeightLimit(
  zone_class: string,
  lot_sqft: number,
  base_height: number,
  plan_height?: number
): number {
  if (!todEligible(zone_class, lot_sqft)) return base_height;
  if (plan_height != null) return Math.max(plan_height, base_height);
  return Math.max(base_height, Math.min(2 * base_height, TOD_MAX_HEIGHT_FT));
}

// FAR under current zoning, Ord. 26-7 (the bill6 pathway; 201H uses it too).
// Ord. 26-7 changed the apartment districts only; business districts keep
// Table 21-3.4. Honolulu's figures are flat, so its lot size does not
// matter; another county's can change with lot size (Maui A-1).
export function calcFarBill6(
  zone_class: string,
  loc: Locality = honolulu,
  lot_sqft = 0
): number {
  return zoneFar(loc, zone_class, "bill6", lot_sqft);
}

// maximum lot coverage before Ord. 26-7 (Standard). With a lot size, the
// apartment districts' coverage tiers by lot size apply; without one, the
// zone's flat figure (the TOD base). Read from the locality's zoning config.
export function lotCoverage(
  zone_class: string,
  lot_sqft?: number,
  loc: Locality = honolulu
): number {
  return lot_sqft != null
    ? zoneCoverage(loc, zone_class, "standard", lot_sqft)
    : zoneCoverage(loc, zone_class, "tod", 0);
}

// maximum lot coverage under current zoning (Ord. 26-7 replaced the
// apartment tiers with a flat 60%); by lot size where a county's is not flat
export function lotCoverageBill6(
  zone_class: string,
  loc: Locality = honolulu,
  lot_sqft = 0
): number {
  return zoneCoverage(loc, zone_class, "bill6", lot_sqft);
}

// share of the lot a special district keeps as open space, by FAR (Honolulu:
// the Waikiki precincts, 35% below FAR 1.5, 50% at 1.5+); 0 elsewhere
export function waikikiOpenSpaceFrac(
  zone_class: string,
  far: number,
  loc: Locality = honolulu
): number {
  const open_space = zoneRules(loc, zone_class)?.open_space;
  return open_space ? evaluateSchedule(open_space, far) : 0;
}

// lot coverage & open space don't stack, so the effective coverage is the minimum of the two
export function envelopeCoverage(
  zone_class: string,
  far: number,
  coverage: number,
  loc: Locality = honolulu
): number {
  return Math.min(coverage, 1 - waikikiOpenSpaceFrac(zone_class, far, loc));
}

// default timing in months, all pathways: Honolulu's, from its config
// (assumptions.timing). The bill6 pathway reads the parcel's county instead.
export const DEFAULT_PERMITTING_MONTHS = honolulu.assumptions.timing.permitting_months;
export const DEFAULT_CONST_MONTHS = honolulu.assumptions.timing.construction_months;

// setback-limited footprint (sqft), assuming a 2:1 depth:width lot
export function setbackFootprint(
  lot_sqft: number,
  setback: number,
  ratio = 2
): number {
  const width = Math.sqrt(lot_sqft / ratio);
  const depth = ratio * width;
  const usable_width = Math.max(0, width - 2 * setback);
  const usable_depth = Math.max(0, depth - 2 * setback);
  return usable_width * usable_depth;
}

// footprint with separate yards, on the same 2:1 lot fronting its short side
export function yardFootprint(
  lot_sqft: number,
  front: number,
  rear: number,
  side: number,
  ratio = 2
): number {
  const width = Math.sqrt(lot_sqft / ratio);
  const depth = ratio * width;
  return Math.max(0, width - 2 * side) * Math.max(0, depth - front - rear);
}

// § 21-9.100-8(c)(1): no at-grade or ground-floor parking within this many
// feet of the front lot line in a TOD special district
export const PDT_FRONT_NO_PARKING_FT = 40;

// ground inside the yards within `depth` ft of the front lot line, on the
// same 2:1 lot fronting its short side
export function frontStripSqft(
  lot_sqft: number,
  setback: number,
  depth: number,
  ratio = 2
): number {
  const width = Math.sqrt(lot_sqft / ratio);
  return Math.max(0, width - 2 * setback) * Math.max(0, depth - setback);
}

// excavation depth (ft) by zone class, from the locality's zone assumptions
export function excavationDepthByZone(
  zone_class: string,
  loc: Locality = honolulu
): number {
  return zoneAssumptions(loc, zone_class).excavation_depth_ft;
}

// building permit fee, by construction value (Honolulu: ROH 18-7.5, Table
// 18-A), from the locality's fee schedule
export function buildingPermitFee(
  total_valuation: number,
  loc: Locality = honolulu
): number {
  return evaluateSchedule(loc.rules.fees.building_permit, total_valuation);
}

// plan review fee, by building permit fee (Honolulu: 10%, $200 to $25,000)
export function planReviewFee(
  original_permit_fee: number,
  loc: Locality = honolulu
): number {
  return evaluateSchedule(loc.rules.fees.plan_review, original_permit_fee);
}

// special district processing fee
export function specialDistrictFee(lot_sqft: number): number {
  const acres = lot_sqft / 43560;
  const decimal_part = acres - Math.floor(acres);
  const acres_rounded =
    decimal_part >= 0.45 ? Math.ceil(acres) : Math.floor(acres);
  const fee = 800 + 300 * acres_rounded;
  return Math.min(fee, 15000);
}

// special district total application fee
export function specialDistrictTotal(lot_sqft: number): number {
  return 400 + specialDistrictFee(lot_sqft);
}

// wastewater system facility charge: chargeable units x ESDU per unit (by
// project size) x the charge per ESDU (Honolulu: ROH 43-10.3)
export function wastewaterFee(
  total_units: number,
  chargeable_units: number = total_units,
  loc: Locality = honolulu
): number {
  const ww = loc.rules.fees.wastewater;
  const esdu_per_unit = evaluateSchedule(ww.esdu_per_unit, total_units);
  return chargeable_units * esdu_per_unit * ww.charge_per_esdu;
}

// site permits (Honolulu: ROH 18A-2.4), from the locality's fee schedules:
// grubbing by lot area, grading and stockpiling by cubic yards
export function grubbingPermit(sqft: number, loc: Locality = honolulu): number {
  return evaluateSchedule(loc.rules.fees.grubbing, sqft);
}

export function gradingPermit(
  cubic_yards: number,
  loc: Locality = honolulu
): number {
  return evaluateSchedule(loc.rules.fees.grading, cubic_yards);
}

export function stockpilingPermit(
  cubic_yards: number,
  loc: Locality = honolulu
): number {
  return evaluateSchedule(loc.rules.fees.stockpiling, cubic_yards);
}

// height step-back ("wedding cake"), side and rear yards unless front is set
export type StepBack = {
  trigger_ft: number;
  above_ft: number;
  ft_per_10ft: number;
  front?: boolean;
};

// height step-back by zone (Honolulu: § 21-3.80-1(c), § 21-3.90-1(c), Ord.
// 17-55, § 21-3.100-1(c), § 21-9.80-5(c)), from the locality's zoning config;
// undefined where the zone has none. A copy, so callers can't change the config.
export function zoneStepBack(
  zone_class: string,
  loc: Locality = honolulu
): StepBack | undefined {
  const step_back = zoneRules(loc, zone_class)?.step_back;
  return step_back ? { ...step_back } : undefined;
}

// the sliders' step-back if set, otherwise the zone's own
export function stepBackOf(
  s: SliderInputs,
  zone_default?: StepBack
): StepBack | undefined {
  if (s.stepback_trigger_ft == null) return zone_default;
  return {
    trigger_ft: s.stepback_trigger_ft,
    above_ft: s.stepback_above_ft ?? 40,
    ft_per_10ft: s.stepback_ft_per_10ft ?? 1,
  };
}

// floor plate of each storey, ground first
export function floorPlates(i: {
  floors: number;
  floor_height: number;
  height_limit: number;
  lot_sqft: number;
  coverage_plate: number;
  setback: number;
  stepback?: StepBack;
}): number[] {
  const plates: number[] = [];
  for (let k = 1; k <= i.floors; k++) {
    let extra = 0;
    if (i.stepback && i.height_limit > i.stepback.trigger_ft) {
      const above = k * i.floor_height - i.stepback.above_ft;
      if (above > 0)
        extra = Math.ceil(above / 10 - 1e-9) * i.stepback.ft_per_10ft;
    }
    plates.push(
      Math.max(
        0,
        Math.min(
          i.coverage_plate,
          yardFootprint(
            i.lot_sqft,
            i.setback + (i.stepback?.front ? extra : 0),
            i.setback + extra,
            i.setback + extra
          )
        )
      )
    );
  }
  return plates;
}

// smallest footprint that fits `area` within each storey's plate
function slimFootprint(plates: number[], area: number): number {
  const fits = (f: number) =>
    plates.reduce((sum, p) => sum + Math.min(f, p), 0) >= area - 1e-6;
  let lo = 0;
  let hi = plates[0] ?? 0;
  if (!fits(hi)) return hi;
  for (let n = 0; n < 60; n++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

// building envelope with surface or podium parking; parking counts toward
// height, not FAR
export function podiumEnvelope(i: {
  plates: number[];
  far_cap: number;
  // most ground-floor retail the zone allows (sqft); 0 for none
  retail_cap: number;
  retail_share: number;
  unit_size: number;
  parking_ratio: number;
  // stalls required per sqft of ground-floor retail (Table 21-6.1); 0 for none
  retail_stalls_per_sqft?: number;
  // Table 21-6.2 rate when housing and retail share stalls and loading
  joint_use?: number;
  // § 21-6.110: reserve ground for the required loading spaces
  loading?: boolean;
  // § 21-6.40: reserve ground for the required bicycle parking
  bicycle?: boolean;
  // ground-floor area along the front where no stalls or loading may go
  // (§ 21-9.100-8(c)); the building's frontage holds retail, lobby or housing
  front_strip_sqft?: number;
  // a legal cap on units (Bill 7)
  max_units?: number;
  // a cap on the unit count; only the floor area those units need is built
  unit_cap?: number;
  // whose loading, bicycle parking and parking cost figures apply; Honolulu
  // by default
  loc?: Locality;
}) {
  const loc = i.loc ?? honolulu;
  const park = loc.assumptions.market.parking;
  const plates = i.plates;
  const floors = plates.length;
  const ground = plates[0] ?? 0;
  const retail_sqft = Math.max(
    0,
    Math.min(i.retail_cap, i.retail_share * ground, i.far_cap)
  );
  const retail_stalls = retail_sqft * (i.retail_stalls_per_sqft ?? 0);
  const parking = i.parking_ratio > 0 || retail_stalls > 0;
  // housing and retail share the stalls (Table 21-6.2)
  const joint =
    i.parking_ratio > 0 && retail_stalls > 0 ? (i.joint_use ?? 1) : 1;
  const stallsFor = (units: number) =>
    roundHalfUp(joint * (i.parking_ratio * units + retail_stalls));
  // most units whose stalls fit `capacity`; stallsFor rises with units
  const unitsFor = (capacity: number) => {
    if (stallsFor(0) > capacity) return 0;
    if (i.parking_ratio <= 0) return Infinity;
    let lo = 0;
    let hi = 1;
    while (stallsFor(hi) <= capacity) hi *= 2;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (stallsFor(mid) <= capacity) lo = mid;
      else hi = mid;
    }
    return lo;
  };
  const above = new Array<number>(floors + 1).fill(0);
  for (let j = floors - 1; j >= 0; j--) above[j] = above[j + 1] + plates[j];
  // a unit-count cap limits the floor area, so only those units are built
  if (i.unit_cap != null)
    i = {
      ...i,
      far_cap: Math.min(
        i.far_cap,
        retail_sqft + (i.unit_cap * i.unit_size) / EFFICIENCY + 1e-6
      ),
    };
  const stallsOn = (sqft: number) => Math.floor(sqft / park.stall_sqft);

  // loading spaces, sized for the most units the envelope holds
  const most_units = Math.min(
    Math.floor(
      (Math.max(0, Math.min(i.far_cap, above[0]) - retail_sqft) * EFFICIENCY) /
        i.unit_size
    ),
    i.max_units ?? Infinity
  );
  const loading_spaces = i.loading
    ? loadingSpaces(most_units, retail_sqft, i.joint_use ?? 1, loc)
    : 0;
  // § 21-6.40: bicycle parking, sized the same way
  const bicycle = i.bicycle
    ? bicycleSpaces(most_units, retail_sqft, retail_stalls, loc)
    : { short_term: 0, long_term: 0 };
  // loading and bicycle parking take ground in the parking area
  const loading_sqft =
    loadingSqft(loading_spaces, loc) +
    (bicycle.short_term + bicycle.long_term) * loc.rules.bicycle.sqft_per_space;
  // the front strip keeps parking and loading behind the building's frontage
  const front_strip = Math.min(ground, i.front_strip_sqft ?? 0);

  // surface lot first: if every stall fits on the ground plate a slimmer
  // building leaves open, no parking is built into the building
  if (parking) {
    const residential_sqft = Math.max(
      0,
      Math.min(i.far_cap, above[0]) - retail_sqft
    );
    const units = Math.min(
      Math.floor((residential_sqft * EFFICIENCY) / i.unit_size),
      i.max_units ?? Infinity
    );
    const stalls = stallsFor(units);
    const footprint = slimFootprint(plates, residential_sqft + retail_sqft);
    // the building fronts the street; open ground in the strip stays unpaved
    const open = Math.max(0, ground - Math.max(footprint, front_strip));
    if (
      stalls <= Math.floor((open - loading_sqft) / park.surface_stall_sqft)
    ) {
      const parking_sqft = stalls * park.surface_stall_sqft + loading_sqft;
      // the building only slims as far as the lot needs
      const built = Math.max(
        footprint,
        Math.min(ground - parking_sqft, residential_sqft + retail_sqft)
      );
      const gross_sqft = residential_sqft + retail_sqft + parking_sqft;
      let living_stories = 0;
      for (
        let j = 0, filled = 0;
        j < floors && filled < residential_sqft - 1e-9;
        j++
      ) {
        filled += Math.min(built, plates[j]);
        living_stories++;
      }
      return {
        residential_sqft,
        retail_sqft,
        lobby_sqft: 0,
        units,
        stalls,
        surface_stalls: stalls,
        ground_floor_stalls: 0,
        podium_stalls: 0,
        loading_spaces,
        bicycle_short_term: bicycle.short_term,
        bicycle_long_term: bicycle.long_term,
        podium_levels: 0,
        parking_sqft,
        parking_cost: parking_sqft * park.surface_cost_per_sqft,
        parking_share: gross_sqft > 0 ? parking_sqft / gross_sqft : 0,
        living_stories,
      };
    }
  }

  const firstResidential = (podium_levels: number) =>
    parking ? Math.min(floors, 1 + podium_levels) : 0;
  const residentialAt = (podium_levels: number) => {
    const by_height = parking
      ? above[firstResidential(podium_levels)]
      : above[0] - retail_sqft - loading_sqft;
    const residential_sqft = Math.max(
      0,
      Math.min(i.far_cap - retail_sqft, by_height)
    );
    const by_area = Math.floor((residential_sqft * EFFICIENCY) / i.unit_size);
    const units = Math.min(by_area, i.max_units ?? Infinity);
    return { residential_sqft, units };
  };

  // without a podium, the ground floor left after its stalls is housing when
  // a unit fits there
  const ground_stalls = parking
    ? stallsOn(
        Math.max(0, ground - loading_sqft - Math.max(retail_sqft, front_strip))
      )
    : 0;
  const groundLeft = (stalls: number) =>
    Math.max(
      0,
      ground - retail_sqft - loading_sqft - stalls * park.stall_sqft
    );
  const groundHousing = (stalls: number) =>
    groundLeft(stalls) >= i.unit_size / EFFICIENCY ? groundLeft(stalls) : 0;
  const fit = (sqft: number) =>
    Math.min(
      Math.floor((sqft * EFFICIENCY) / i.unit_size),
      i.max_units ?? Infinity
    );

  // units at a podium height: the fewer of what the floors hold and what
  // the stalls allow, settled since stalls take ground-floor housing
  const optionAt = (podium_levels: number, capacity: number) => {
    const room = (stalls: number) =>
      Math.max(
        0,
        Math.min(
          i.far_cap - retail_sqft,
          above[firstResidential(podium_levels)] +
            (podium_levels === 0 ? groundHousing(stalls) : 0)
        )
      );
    const by_stalls = unitsFor(capacity);
    // the most units whose stalls leave room for them; more units need more
    // stalls and so leave less room, so the test only fails above the answer
    const fits = (u: number) => fit(room(stallsFor(u))) >= u;
    let lo = 0;
    let hi = Math.min(fit(room(0)), by_stalls);
    if (fits(hi)) lo = hi;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    const units = lo;
    const sqft = room(stallsFor(units));
    const by_area = fit(sqft);
    return {
      units,
      // build only the floor area the parked units need
      residential_sqft:
        units < by_area
          ? Math.min(sqft, (units * i.unit_size) / EFFICIENCY)
          : sqft,
      stall_bound: units < by_area,
    };
  };

  // keep the podium that yields the most units
  let podium_levels = 0;
  let res = residentialAt(0);
  if (parking) {
    let capacity = ground_stalls;
    let best = -1;
    for (let k = 0; k < Math.max(1, floors); k++) {
      if (k > 0) capacity += stallsOn(plates[k]);
      const option = optionAt(k, capacity);
      if (option.units > best) {
        best = option.units;
        podium_levels = k;
        res = option;
      }
      // once stalls stop limiting units, a taller podium only loses floors
      if (!option.stall_bound) break;
    }
  }
  const stalls = stallsFor(res.units);
  const ground_housing =
    parking && podium_levels === 0 ? groundHousing(stalls) : 0;

  const ground_parking_sqft =
    Math.min(stalls, ground_stalls) * park.stall_sqft;
  // podium floors are built whole, however full the top one is
  const podium_sqft = parking
    ? above[Math.min(1, floors)] - above[firstResidential(podium_levels)]
    : 0;
  // ground floor too small for a unit: lobby, loading, circulation
  const lobby_sqft =
    parking && ground_housing === 0
      ? Math.max(0, ground - retail_sqft - loading_sqft - ground_parking_sqft)
      : 0;
  const parking_sqft = ground_parking_sqft + podium_sqft + loading_sqft;
  const gross_sqft =
    res.residential_sqft + retail_sqft + lobby_sqft + parking_sqft;

  const storeys = [
    ...(ground_housing > 0 ? [ground_housing] : []),
    ...plates.slice(firstResidential(podium_levels)),
  ];
  let living_stories = 0;
  for (
    let j = 0, filled = 0;
    j < storeys.length && filled < res.residential_sqft - 1e-9;
    j++
  ) {
    filled += storeys[j];
    living_stories++;
  }

  return {
    residential_sqft: res.residential_sqft,
    retail_sqft,
    lobby_sqft,
    units: res.units,
    stalls,
    surface_stalls: 0,
    ground_floor_stalls: Math.min(stalls, ground_stalls),
    podium_stalls: stalls - Math.min(stalls, ground_stalls),
    loading_spaces,
    bicycle_short_term: bicycle.short_term,
    bicycle_long_term: bicycle.long_term,
    podium_levels,
    parking_sqft,
    parking_cost: parking_sqft * park.cost_per_sqft,
    parking_share: gross_sqft > 0 ? parking_sqft / gross_sqft : 0,
    living_stories,
  };
}

// parking: calculate annual parking income
export function calcParkingIncome(
  stalls: number,
  loc: Locality = honolulu
): number {
  return stalls * loc.assumptions.market.parking.monthly_rent_per_stall * 12;
}

// bicycle parking: racks and lockers (their floor area is in the envelope)
export function calcBicycleParkingCost(
  short_term: number,
  long_term: number
): number {
  return (
    short_term * BICYCLE_COST_PER_SPACE.short_term +
    long_term * BICYCLE_COST_PER_SPACE.long_term
  );
}

// HHFDC affordable sale price lookup
export function getAffordablePrice(
  unit_type: string,
  ami: number,
  rate: number
): number {
  const table = HHFDC_TABLES[unit_type] ?? HHFDC_TABLES["two_bb"];
  // round AMI to nearest 10%, and the lowest is 50% AMI for sales
  const ami_key = `ami_${Math.max(50, Math.round(ami * 100))}`;

  // find closest rate
  const rate_idx = HHFDC_RATES.reduce(
    (best, r, i) =>
      Math.abs(r - rate) < Math.abs(HHFDC_RATES[best] - rate) ? i : best,
    0
  );
  const closest_rate = HHFDC_RATES[rate_idx];
  const price = table[closest_rate]?.[ami_key] ?? 0;
  return price;
}

// solve for IRR given a cash flow (monthly)
export function solveIRR(cashflows: number[], isMonthly: boolean): number {
  const hasPositive = cashflows.some((cf) => cf > 0);
  const hasNegative = cashflows.some((cf) => cf < 0);
  if (!hasPositive || !hasNegative) return NaN;

  // horner's method for evaluating the polynomial efficiently
  const n = cashflows.length;
  const npv = (r: number) => {
    const d = 1 / (1 + r);
    let acc = 0;
    for (let t = n - 1; t >= 0; t--) acc = acc * d + cashflows[t];
    return acc;
  };

  let lo = -0.95;
  let hi = isMonthly ? 1.0 : 10.0;

  let npvLo = npv(lo);
  let npvHi = npv(hi);

  if (!Number.isFinite(npvLo) || !Number.isFinite(npvHi)) return NaN;
  if (npvLo * npvHi > 0) return NaN;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);

    if (!Number.isFinite(npvMid)) return NaN;

    if (Math.abs(npvMid) < 1e-7 || (hi - lo) / 2 < 1e-10) {
      return isMonthly ? Math.pow(1 + mid, 12) - 1 : mid;
    }

    if (npvLo * npvMid < 0) {
      hi = mid;
      npvHi = npvMid;
    } else {
      lo = mid;
      npvLo = npvMid;
    }
  }
  return NaN;
}

// =========================================================
// SHARED PIPELINE FUNCTIONS
// =========================================================

// construction soft costs
export function calcSoftCosts(i: SoftCostInputs): SoftCostBreakdown {
  const loc = i.loc ?? honolulu;
  const fees = loc.rules.fees;
  const market_units = Math.max(0, i.max_units - i.affordable_units);

  // units charged for the three waivable city fees.
  const chargeable_units =
    i.waivable_fee_basis === "none"
      ? 0
      : i.waivable_fee_basis === "market_units"
        ? market_units
        : i.max_units;

  // the same toggle sets the BWS water charges, with the waiver capped per project
  const water_chargeable_units =
    i.waivable_fee_basis === "none"
      ? 0
      : i.waivable_fee_basis === "market_units"
        ? i.max_units - Math.min(i.affordable_units, loc.rules.water.waiver_unit_cap)
        : i.max_units;
  const water = calcWaterFees({
    max_units: i.max_units,
    water_chargeable_units,
    living_stories: i.living_stories,
    fu_per_unit: i.fu_per_unit,
    loc,
  });

  // permit and plan review scale with construction value per unit.
  const per_unit_cost = i.hard_cost / Math.max(i.max_units, 1);
  const permit_fee = buildingPermitFee(per_unit_cost, loc);
  const plan_fee = planReviewFee(permit_fee, loc);

  const cubic_yards = (i.lot_sqft * i.excavation_depth) / 27;

  // exempt = application fee only; in_lieu = application fee + FMV of park land
  const park_fee = fees.park_dedication.application_fee;
  const park_dedication =
    i.park === "none"
      ? 0
      : i.park === "exempt"
        ? park_fee.exempt
        : park_fee.in_lieu + i.park_area * i.land_cost_per_sqft;

  const b = {
    environmental: fees.environmental.ea + fees.environmental.eis,
    building_permit: chargeable_units * permit_fee,
    plan_review: chargeable_units * plan_fee,
    wastewater: wastewaterFee(i.max_units, chargeable_units, loc),
    wsfc: water.wsfc,
    water_meter: water.water_meter,
    temp_occupancy: fees.temp_occupancy_cert,
    park_dedication,
    escp: fees.escp,
    utilities: (fees.installation_trench + fees.service_connection) * i.max_units,
    grubbing: grubbingPermit(i.lot_sqft, loc),
    stockpiling: stockpilingPermit(cubic_yards, loc),
    grading: gradingPermit(cubic_yards, loc),
    impact: i.impact_fee_per_unit * i.max_units,
    construction_mgmt: i.hard_cost * CONSTRUCTION_MGMT_RATE,
    zoning_application: i.zoning_application_fee ?? 0,
    special_district: i.special_district_fee ?? 0,
  };

  return { ...b, total: Object.values(b).reduce((s, v) => s + v, 0) };
}

// pre-development equity, monthly equity outflows during permitting
export function calcPredevEquity(
  construct_cost: number,
  permitting_months: number,
  equity_amount: number
): {
  monthly_predev_spend: number;
  total_predev_cost: number;
  construction_equity: number;
} {
  const monthly_predev_spend = (construct_cost * FINANCING.cost_carried) / 12;
  const total_predev_cost = monthly_predev_spend * permitting_months;
  // equity left for closing once predev is funded; never negative, the loan
  // funds anything past the developer's equity (see equityFirstDraws)
  const construction_equity = Math.max(0, equity_amount - total_predev_cost);

  return {
    monthly_predev_spend,
    total_predev_cost,
    construction_equity,
  };
}

// equity-first draw schedule for a dev flip
export function equityFirstDraws(
  equity_amount: number,
  land_cost: number,
  monthly_predev_spend: number,
  permitting_months: number
): number[] {
  const draws: number[] = new Array(permitting_months + 1).fill(0);
  let remaining = Math.max(0, equity_amount);
  const take = (amount: number) => {
    const d = Math.min(amount, remaining);
    remaining -= d;
    return d;
  };
  draws[0] -= take(land_cost);
  for (let m = 0; m < permitting_months; m++) {
    draws[m] -= take(monthly_predev_spend);
  }
  // whatever is left is the construction equity at close
  draws[permitting_months] -= remaining;
  return draws;
}

// cumulative share of the construction loan drawn by progress point x (0-1)
export function drawCurve(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return 3 * t * t - 2 * t * t * t;
}

// construction interest on an S-curve draw schedule to distribute the cashflow realistically
export function calcConstructionInterest(
  loan_principal: number,
  const_months: number,
  annual_rate: number
): { total_interest: number; final_principal: number } {
  // no construction period: the loan is drawn with no time to accrue
  if (const_months <= 0)
    return { total_interest: 0, final_principal: loan_principal };

  const monthly_rate = (1 + annual_rate) ** (1 / 12) - 1;
  let running_principal = 0;
  let total_interest = 0;
  let drawn_share = 0;

  for (let month = 1; month <= const_months; month++) {
    // draws are non-negative at any term & sum to the loan principal
    const share = drawCurve(month / const_months);
    const draw_amount = (share - drawn_share) * loan_principal;
    drawn_share = share;

    const interest = monthly_rate * (draw_amount + running_principal);
    total_interest += interest;
    running_principal += draw_amount + interest;
  }

  return { total_interest, final_principal: running_principal };
}

// lease-up & sales carry
export function calcLeaseupCarry(
  principal: number,
  rental_units: number,
  sale_units: number,
  annual_rate: number,
  leaseup_override?: number
): {
  leaseup_months: number;
  sales_months: number;
  total_carry_months: number;
  carry_interest: number;
  final_principal: number;
} {
  let leaseup_months = 0;
  if (leaseup_override != null && leaseup_override > 0) {
    leaseup_months = leaseup_override; // ← user slider wins
  } else if (rental_units > 0) {
    // note: "else if" now
    const target_units = Math.ceil(rental_units * TIMING.target_occupancy);
    leaseup_months =
      Math.ceil(target_units / TIMING.absorption_units_per_month) +
      TIMING.stabilization;
  }

  const sales_months =
    sale_units > 0 ? Math.ceil(sale_units / TIMING.monthly_sale_cap) : 0;

  let total_carry_months = Math.max(leaseup_months, sales_months);
  if (total_carry_months === 0) {
    total_carry_months = TIMING.stabilization;
  }

  const monthly_rate = (1 + annual_rate) ** (1 / 12) - 1;
  let running_principal = principal;
  let carry_interest = 0;

  for (let month = 1; month <= total_carry_months; month++) {
    const interest = monthly_rate * running_principal;
    carry_interest += interest;
    running_principal += interest;
  }

  return {
    leaseup_months,
    sales_months,
    total_carry_months,
    carry_interest,
    final_principal: running_principal,
  };
}

// developer RLV, maximum supportable land price (static residual)
export function calcDevRLV(
  gdv: number,
  dev_cost: number,
  total_financing_cost: number,
  // grant cash by month (bill 7); empty for none
  grant_flows: number[],
  lot_sqft: number,
  total_months: number,
  land_rate: number = DEFAULT_TARGET_RETURN,
  profit_margin: number = DEFAULT_PROFIT_MARGIN
): {
  selling_costs: number;
  grants_pv: number;
  profit: number;
  project_cost: number;
  land_carry: number;
  rlv: number;
  rlv_sqft: number;
} {
  const selling_costs = gdv * FINANCING.disposition_cost;

  const project_cost = dev_cost + total_financing_cost;
  const profit = project_cost * profit_margin;

  const residual = gdv - selling_costs - project_cost - profit;

  // land carry: only the land is paid at t=0
  const land_carry = (1 + land_rate) ** (total_months / 12);
  // grants discounted from the month each is paid
  const grants_pv = grant_flows.reduce(
    (sum, g, m) => sum + g / (1 + land_rate) ** (m / 12),
    0
  );
  const rlv = residual / land_carry + grants_pv;
  const rlv_sqft = rlv / lot_sqft;

  return {
    selling_costs: Math.round(selling_costs),
    grants_pv: Math.round(grants_pv),
    profit: Math.round(profit),
    project_cost: Math.round(project_cost),
    land_carry,
    rlv: Math.round(rlv),
    rlv_sqft: Math.round(rlv_sqft * 100) / 100,
  };
}

// stabilized-year property tax (NOI is an after-tax figure)
// programs with exemptions (Bill 7, TOD) pay tax on land only while the exemption runs
export function calcPropertyTax(
  land_value: number,
  improvement_value: number,
  exempt_improvements: boolean = false,
  loc: Locality = honolulu
): number {
  const assessed = exempt_improvements
    ? land_value
    : land_value + improvement_value;
  return assessed * loc.rules.property_tax_rate;
}

// split a whole building tax bill across the residential and retail NOI lines
export function allocatePropertyTax(
  prop_tax: number,
  residential_egi: number,
  retail_egi: number
): { residential_tax: number; retail_tax: number } {
  const total = residential_egi + retail_egi;
  if (total <= 0) return { residential_tax: prop_tax, retail_tax: 0 };
  const retail_tax = (prop_tax * retail_egi) / total;
  return { residential_tax: prop_tax - retail_tax, retail_tax };
}

// permanent loan
// annual debt service per $1 borrowed at the permanent rate and amortization
export function calcAnnualLoanConstant(
  permanent_rate: number,
  amort_years: number
): number {
  const monthly_r = permanent_rate / 12;
  const n_pmts = amort_years * 12;
  if (n_pmts <= 0) return 0;
  if (monthly_r <= 0) return 1 / amort_years;
  return (
    (12 * (monthly_r * Math.pow(1 + monthly_r, n_pmts))) /
    (Math.pow(1 + monthly_r, n_pmts) - 1)
  );
}

// DSCR-implied take-out: the largest permanent loan whose annual debt service
// stabilized NOI covers at min_dscr
export function calcDscrMaxLoan(
  noi: number,
  permanent_rate: number,
  amort_years: number,
  min_dscr: number
): number {
  const annual_constant = calcAnnualLoanConstant(permanent_rate, amort_years);
  return noi > 0 && annual_constant > 0
    ? noi / (min_dscr * annual_constant)
    : 0;
}

// Construction-loan sizing:
// two loans, one for each framework the card reports
// loan A (RLV basis): sized on construction cost only
// loan B (deal basis): sized on construction cost plus land
// where the DSCR binds the two coincide; they differ only when LTC is binding
export function sizeConstructionLoan(
  amount_to_finance: number,
  equity_floor: number,
  ltc_stabilized_balance: number,
  take_out: number | null
): {
  loan_principal: number;
  equity_amount: number;
  equity_pct_realized: number;
  dscr_binds: boolean;
} {
  const ltc_principal = amount_to_finance * (1 - equity_floor);
  const balance_per_dollar =
    ltc_principal > 0 ? ltc_stabilized_balance / ltc_principal : 0;
  const take_out_principal =
    take_out == null || balance_per_dollar <= 0
      ? Infinity
      : take_out / balance_per_dollar;
  const dscr_binds = take_out_principal < ltc_principal;
  const loan_principal = Math.max(
    0,
    Math.min(ltc_principal, take_out_principal)
  );
  const equity_amount = Math.max(0, amount_to_finance - loan_principal);
  return {
    loan_principal,
    equity_amount,
    equity_pct_realized:
      amount_to_finance > 0 ? equity_amount / amount_to_finance : equity_floor,
    dscr_binds,
  };
}

export function calcPermanentLoan(
  loan_balance: number,
  noi: number,
  permanent_rate: number,
  hold_years: number,
  amort_years: number = HOLD.amort_years,
  min_dscr: number = 1.2
): {
  perm_principal: number;
  monthly_pmt: number;
  annual_debt_svc: number;
  dscr: number;
  is_bankable: boolean;
  remaining_bal: number;
  equity_gap: number;
} {
  const monthly_r = permanent_rate / 12;
  const n_pmts = amort_years * 12;

  // annual debt service per $1 of loan
  const annual_constant = calcAnnualLoanConstant(permanent_rate, amort_years);

  // DSCR constrained max loan
  const dscr_max_loan = calcDscrMaxLoan(
    noi,
    permanent_rate,
    amort_years,
    min_dscr
  );

  // actual permanent loan is the smaller of remins vs dscr constrained max loan
  const sized_loan = Math.max(0, Math.min(loan_balance, dscr_max_loan));

  // developer must fund with additional equity at refinance if short of $$
  const equity_gap = Math.max(0, loan_balance - sized_loan);

  const monthly_pmt = sized_loan * (annual_constant / 12);
  const annual_debt_svc = sized_loan * annual_constant;
  const dscr = annual_debt_svc > 0 ? noi / annual_debt_svc : Infinity;

  const pmts_made = hold_years * 12;
  const remaining_bal =
    sized_loan *
    ((Math.pow(1 + monthly_r, n_pmts) - Math.pow(1 + monthly_r, pmts_made)) /
      (Math.pow(1 + monthly_r, n_pmts) - 1));

  return {
    perm_principal: Math.round(sized_loan),
    monthly_pmt: Math.round(monthly_pmt),
    annual_debt_svc: Math.round(annual_debt_svc),
    dscr: Math.round(dscr * 1000) / 1000,
    // a DSCR-sized loan is set to exactly min_dscr, so the recomputed DSCR
    // is different by the 8~9th decimal place, so use a small tolerance
    is_bankable: dscr >= min_dscr - 1e-9,
    remaining_bal: Math.round(remaining_bal),
    equity_gap: Math.round(equity_gap),
  };
}

// zero output helper
export function zeroOutput(
  tmk: string,
  zone_class: string,
  lot_sqft: number,
  height_limit = 0
): ParcelOutput {
  return {
    tmk,
    zone_class,
    lot_sqft,
    height_limit,
    buildable_sqft: 0,
    net_residential_sqft: 0,
    net_commercial_sqft: 0,
    max_units: 0,
    parking_stalls: 0,
    podium_levels: 0,
    parking_sqft: 0,
    parking_share: 0,
    affordable_units: 0,
    afd_rent_units: 0,
    mkt_rent_units: 0,
    afd_sale_units: 0,
    mkt_sale_units: 0,
    hard_cost: 0,
    soft_cost: 0,
    dev_cost: 0,
    total_financing_cost: 0,
    rlv_financing_cost: 0,
    pre_construction_subsidy: 0,
    equity_amount: 0,
    loan_balance_at_stab: 0,
    permitting_months: 0,
    const_months: 0,
    leaseup_months: 0,
    sales_months: 0,
    total_carry_months: 0,
    total_months: 0,
    project_years: 0,
    pri: 0,
    pgi: 0,
    residential_egi: 0,
    retail_pgi: 0,
    retail_egi: 0,
    egi: 0,
    gross_sales: 0,
    afd_sales: 0,
    mkt_sales: 0,
    residential_opex: 0,
    retail_opex: 0,
    operating_expenses: 0,
    property_tax: 0,
    noi: 0,
    cap_rate: 0,
    gdv: 0,
    dev_strategy: "dev_flip",
    dev_hold_years: 0,
    dev_post_grant: 0,
    dev_land_cost: 0,
    dev_total_dev_cost: 0,
    dev_capital_subsidy: 0,
    dev_net_dev_cost: 0,
    dev_levered_irr: 0,
    dev_equity_multiple: 0,
    dev_profit: 0,
    dev_roc: 0,
    dev_equity_invested: 0,
    dev_equity_out: 0,
    dev_gdv: 0,
    dev_selling_costs: 0,
    dev_loan_payoff: 0,
    dev_perm_principal: null,
    dev_perm_rate: null,
    dev_annual_debt_svc: null,
    dev_dscr: null,
    dev_equity_pct_realized: 0,
    dev_dscr_binds: false,
    dev_is_bankable: null,
    dev_cash_on_cash: null,
    dev_entry_cap: null,
    dev_exit_cap: null,
    dev_yr1_prop_tax: null,
    dev_investment_spread: 0,
    dev_target_roc: 0,
    dev_is_feasible: false,
    total_predev_cost: 0,
    construction_equity: 0,
    rlv_selling_costs: 0,
    rlv_grants_pv: 0,
    rlv_land_carry: 1,
    rlv_profit: 0,
    rlv_project_cost: 0,
    rlv: 0,
    rlv_sqft: 0,
    dev_roi: 0,
  };
}

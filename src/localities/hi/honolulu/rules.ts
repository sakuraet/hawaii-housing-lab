// City and County of Honolulu: parking, loading, bicycle parking, fees,
// water charges, property tax and income limits. Values copied unchanged
// from @uhero/feasim 0.1.0 (calculations/calc-shared.ts);
// test/honolulu-config.test.ts checks every value against that code.

import type {
  BicycleRules,
  FeeRules,
  LoadingRules,
  ParkingRules,
  WaterRules,
} from "../../../core/locality";
import type { Schedule } from "../../../core/schedule";

// ── parking, loading and bicycle parking (ROH Ch. 21, Article 6) ────────

export const parking: ParkingRules = {
  // 1 stall per 1,000 sqft of private dwelling area, common areas excluded
  residential_sqft_per_stall: 1000,
  // Commercial 1 (retail and sales, eating and drinking, offices)
  retail_sqft_per_stall: 500,
  // housing and retail sharing the stalls and loading
  joint_use: 0.9,
  source: "ROH 21-6.20, Table 21-6.1; ROH 21-6.30(g), Table 21-6.2",
};

const MULTIFAMILY_LOADING: Schedule = {
  bands: [
    { upTo: 20, inclusive: false, base: 0 },
    { upTo: 150, inclusive: true, base: 1 },
    { upTo: 300, inclusive: true, base: 2 },
    // then one more per 200 units, a fraction of 0.5 or more rounding up
    { upTo: null, inclusive: true, base: 2, rate: 1, over: 300, step: 200, round: "half_up" },
  ],
  source: "ROH Table 21-6.5 (multifamily dwellings, by units)",
};

const RETAIL_LOADING: Schedule = {
  bands: [
    { upTo: 2000, inclusive: false, base: 0 },
    { upTo: 10000, inclusive: true, base: 1 },
    { upTo: 20000, inclusive: true, base: 2 },
    { upTo: 40000, inclusive: true, base: 3 },
    { upTo: 60000, inclusive: true, base: 4 },
    // then one more per 50,000 sqft, a fraction of 0.5 or more rounding up
    { upTo: null, inclusive: true, base: 4, rate: 1, over: 60000, step: 50000, round: "half_up" },
  ],
  source: "ROH Table 21-6.5 (retail, by floor area)",
};

export const loading: LoadingRules = {
  min_lot_sqft: 7500,
  multifamily_spaces: MULTIFAMILY_LOADING,
  retail_spaces: RETAIL_LOADING,
  // 19 ft x 8 ft 6 in
  small_space_sqft: 19 * 8.5,
  // 35 ft x 12 ft, for a third of the spaces when more than one is required
  large_space_sqft: 35 * 12,
  source: "ROH 21-6.110, Table 21-6.5; ROH 21-6.130",
};

export const bicycle: BicycleRules = {
  short_term: {
    // housing: 1 per 10 units; retail: 1 per 2,000 sqft or 1 per 10 vehicle
    // spaces, whichever is greater
    units_per_space: 10,
    retail_sqft_per_space: 2000,
    stalls_per_space: 10,
  },
  long_term: {
    // housing: 1 per 2 units; retail: 1 per 12,000 sqft or 1 per 30 vehicle
    // spaces, whichever is greater
    units_per_space: 2,
    retail_sqft_per_space: 12000,
    stalls_per_space: 30,
  },
  // 2 ft x 6 ft, plus 5 ft clear on the 2 ft access side
  sqft_per_space: 2 * 6 + 2 * 5,
  source: "ROH 21-6.40, Table 21-6.3; ROH 21-6.40(d)(1)",
};

// ── fees ────────────────────────────────────────────────────────────────

export const fees: FeeRules = {
  // on one unit's construction value
  building_permit: {
    bands: [
      { upTo: 500, inclusive: true, base: 20 },
      { upTo: 1000, inclusive: true, base: 8, rate: 2.5, per: 100 },
      { upTo: 20000, inclusive: true, base: 12, rate: 2.2, per: 100 },
      { upTo: 50000, inclusive: true, base: 82, rate: 18, per: 1000, over: 20000 },
      { upTo: 100000, inclusive: true, base: 286, rate: 14, per: 1000, over: 50000 },
      { upTo: 500000, inclusive: true, base: 700, rate: 10, per: 1000, over: 100000 },
      { upTo: 2000000, inclusive: true, base: 3200, rate: 5, per: 1000, over: 500000 },
      { upTo: null, inclusive: true, base: 4300, rate: 4.5, per: 1000, over: 2000000 },
    ],
    source: "ROH 18-7.5, Table 18-A",
  },
  // 10% of the building permit fee, at least $200 and at most $25,000
  plan_review: {
    bands: [{ upTo: null, inclusive: true, base: 0, rate: 0.1 }],
    min: 200,
    max: 25000,
    source: "ROH 18-6.1",
  },
  environmental: { ea: 600, eis: 1200 },
  temp_occupancy_cert: 200,
  escp: 250,
  installation_trench: 195,
  service_connection: 50,
  // by lot area, sqft
  grubbing: {
    bands: [
      { upTo: 15001, inclusive: false, base: 0 },
      { upTo: 16000, inclusive: true, base: 125 },
      { upTo: null, inclusive: true, base: 125, rate: 15, over: 16000, step: 1000 },
    ],
    source: "ROH 18A-2.4(b)",
  },
  // by excavated volume, cubic yards
  grading: {
    bands: [
      { upTo: 1000, inclusive: true, base: 505, rate: 55, step: 100 },
      { upTo: 10000, inclusive: false, base: 1000, rate: 55, over: 1000, step: 1000 },
      { upTo: null, inclusive: true, base: 1495, rate: 35, over: 10000, step: 1000 },
    ],
    source: "ROH 18A-2.4",
  },
  stockpiling: {
    bands: [
      { upTo: 101, inclusive: false, base: 0 },
      { upTo: 1100, inclusive: true, base: 70 },
      { upTo: null, inclusive: true, base: 70, rate: 15, over: 1100, step: 1000 },
    ],
    source: "ROH 18A-2.4(c)",
  },
  wastewater: {
    charge_per_esdu: 7539,
    // 0.7 ESDU per unit for projects of 5 or more units, else 1.0
    esdu_per_unit: {
      bands: [
        { upTo: 5, inclusive: false, base: 1.0 },
        { upTo: null, inclusive: true, base: 0.7 },
      ],
      source: "ROH 43-10.3, Appendix 43-C",
    },
  },
  park_dedication: {
    // lesser of 110 sqft per unit and 10% of floor area
    sqft_per_unit: 110,
    floor_area_fraction: 0.1,
    application_fee: { exempt: 0, in_lieu: 200 },
  },
  // HRS Ch. 302A; set to $0 for now instead of $1,836
  school_impact_per_unit: 0,
  source:
    "ROH 18-6.1, 18-7.5 (building); ROH 6-40.2(b) (EA, EIS); ROH 18A (site); ROH 14-2.1 (utilities); ROH 43-10.3 (wastewater); ROH 22-7.5 (parks); HRS 302A (school)",
};

// ── water: Board of Water Supply ────────────────────────────────────────

export const water: WaterRules = {
  // multi-family rates; flat, never escalated
  wsfc_per_fu: { low_rise: 271.27, high_rise: 204.12 },
  low_rise_max_stories: 3,
  min_fu: 20,
  // BWS's cap is 500 a year islandwide; the model applies it per project
  waiver_unit_cap: 500,
  fire_meter_charge: {
    "5/8": 500,
    "3/4": 600,
    "1": 700,
    "1.5": 1100,
    "2": 1700,
    "4": 5600,
    "6": 12100,
    "8": 21100,
  },
  source: "Board of Water Supply, Water System Facilities Charge and fire service connection charges",
};

// ── property tax and income limits ──────────────────────────────────────

// residential, share of assessed value per year
export const property_tax_rate = 0.0035;

// 2025 HHFDC Honolulu County income limits by AMI %, household sizes 1–8
// (median family income $129,300)
export const income_limits: Record<number, number[]> = {
  10: [10640, 12160, 13680, 15200, 16420, 17640, 18850, 20070],
  20: [21280, 24320, 27360, 30400, 32840, 35280, 37700, 40140],
  30: [31920, 36480, 41040, 45600, 49260, 52920, 56550, 60210],
  40: [42560, 48640, 54720, 60800, 65680, 70560, 75400, 80280],
  50: [53200, 60800, 68400, 76000, 82100, 88200, 94250, 100350],
  60: [63840, 72960, 82080, 91200, 98520, 105840, 113100, 120420],
  70: [74480, 85120, 95760, 106400, 114940, 123480, 131950, 140490],
  80: [85120, 97280, 109440, 121600, 131360, 141120, 150800, 160560],
  90: [95760, 109440, 123120, 136800, 147780, 158760, 169650, 180630],
  100: [106400, 121600, 136800, 152000, 164200, 176400, 188500, 200700],
  110: [117040, 133760, 150480, 167200, 180620, 194040, 207350, 220770],
  120: [127680, 145920, 164160, 182400, 197040, 211680, 226200, 240840],
  130: [138320, 158080, 177840, 197600, 213460, 229320, 245050, 260910],
  140: [148960, 170240, 191520, 212800, 229880, 246960, 263900, 280980],
};

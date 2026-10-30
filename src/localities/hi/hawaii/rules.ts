// County of Hawaiʻi: parking, loading, bicycle parking, fees, water charges,
// property tax and income limits.
//
// Parking and loading are from HCC Chapter 25 (Supp. 20, 7-2026); fees from
// Chapters 5 (building permits), 8 (park dedication), 10 (grading) and 21
// (sewers). The choices made in fitting these to the model are in
// docs/notes/HAWAII_COUNTY.md.

import type {
  BicycleRules,
  FeeRules,
  LoadingRules,
  ParkingRules,
  WaterRules,
} from "../../../core/locality";
import { flat } from "../../../core/schedule";

// ── parking, loading and bicycle parking (HCC 25-4-50 to 25-4-59.3) ─────

export const parking: ParkingRules = {
  // multiple-family dwellings: 1.25 stalls per unit, whatever its size
  // (25-4-51(a)(6)); the CDH district's 1 per unit is set on its zone
  residential_stalls_per_unit: 1.25,
  // a fraction of a stall is the next whole number (25-4-52(a))
  round_up: true,
  // commercial uses, including retail and office: 1 per 300 sqft of gross
  // floor area (25-4-51(a)(4))
  retail_sqft_per_stall: 300,
  // stalls may be shared only by uses at different times, sized to the
  // largest requirement (25-4-51(c)); not modeled, so no reduction
  joint_use: 1,
  source: "HCC 25-4-51(a)(4), (a)(6), (c); 25-4-52(a)",
};

export const loading: LoadingRules = {
  // loading applies to buildings of 5,000 sqft or more (25-4-56); the
  // schedules below need none below that size, so no lot threshold
  min_lot_sqft: 0,
  // multiple-family dwellings: 1 space for 20 to 150 units, 2 for 151 to
  // 300, and 1 more for each further 200 units or major fraction
  multifamily_spaces: {
    bands: [
      { upTo: 20, inclusive: false, base: 0 },
      { upTo: 150, inclusive: true, base: 1 },
      { upTo: 300, inclusive: true, base: 2 },
      { upTo: null, inclusive: true, base: 2, rate: 1, over: 300, step: 200, round: "half_up" },
    ],
    source: "HCC 25-4-56 (multiple-family dwellings)",
  },
  // commercial uses by floor area: 1 for 5,000 to 10,000 sqft, then 2, 3, 4
  // and 5 to 60,000, and 1 more for each further 50,000 or major fraction
  retail_spaces: {
    bands: [
      { upTo: 5000, inclusive: false, base: 0 },
      { upTo: 10000, inclusive: true, base: 1 },
      { upTo: 20000, inclusive: true, base: 2 },
      { upTo: 30000, inclusive: true, base: 3 },
      { upTo: 40000, inclusive: true, base: 4 },
      { upTo: 60000, inclusive: true, base: 5 },
      { upTo: null, inclusive: true, base: 5, rate: 1, over: 60000, step: 50000, round: "half_up" },
    ],
    source: "HCC 25-4-56 (commercial uses)",
  },
  // 12 ft x 50 ft for a single space in a building over 5,000 sqft, which
  // any building needing one is; the model's single space is its small
  // size, so both sizes are 12 x 50. The code lets half of several spaces be
  // 10 x 22 ft, so several are slightly overstated (25-4-58)
  small_space_sqft: 12 * 50,
  large_space_sqft: 12 * 50,
  source: "HCC 25-4-56, 25-4-58",
};

// no bicycle parking minimum (every zone sets bicycle_required: false, so
// these are not used); 5 bicycle stalls may replace 1 car stall (25-4-52(c))
export const bicycle: BicycleRules = {
  short_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  long_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  sqft_per_space: 0,
  source: "HCC 25-4-52(c) (no bicycle parking requirement)",
};

// ── fees ────────────────────────────────────────────────────────────────

export const fees: FeeRules = {
  // on one unit's construction value, as for Honolulu and Maui; "or
  // fraction thereof", so each step rounds up. No affordable-housing
  // exemption (only Habitat for Humanity and the Community College's model
  // home, 5-7-3(h)). The County values work from the ICC Building Valuation
  // Data (5-7-3(c)); the model uses its own hard cost
  building_permit: {
    bands: [
      { upTo: 500, inclusive: true, base: 10 },
      { upTo: 2000, inclusive: true, base: 10, rate: 1.5, over: 500, step: 100 },
      { upTo: 25000, inclusive: true, base: 32.5, rate: 7.5, over: 2000, step: 1000 },
      { upTo: 50000, inclusive: true, base: 205, rate: 6, over: 25000, step: 1000 },
      { upTo: null, inclusive: true, base: 355, rate: 3, over: 50000, step: 1000 },
    ],
    source: "HCC 5-7-3(b) (general construction)",
  },
  // 20% of the permit fee, at least $50 (5-7-1(a)); a third or later
  // resubmittal costs more (5-7-1(b)), not modeled
  plan_review: {
    bands: [{ upTo: null, inclusive: true, base: 0, rate: 0.2 }],
    min: 50,
    source: "HCC 5-7-1(a)",
  },
  // no County EA review fee found (Ch. 25 sets filing fees only for
  // variances, use permits and other discretionary actions)
  environmental: { ea: 0, eis: 0 },
  // $200 on issuing a temporary certificate of occupancy (5-7-6)
  temp_occupancy_cert: 200,
  // no separate erosion control plan fee; it is part of the grading permit
  // (Ch. 10)
  escp: 0,
  // the sewer lateral is billed at the County's cost against a deposit
  // (21-23), and the permit to connect is free (21-25(c)); neither is per
  // unit, so not modeled
  installation_trench: 0,
  service_connection: 0,
  // over 1 acre: $5, plus $2 for each further 5 acres or fraction (10-11(b)).
  // Read as $5 for up to 5 acres beyond the first, which the code leaves open;
  // no fee at 1 acre or less
  grubbing: {
    bands: [
      { upTo: 43560, inclusive: true, base: 0 },
      { upTo: 6 * 43560, inclusive: true, base: 5 },
      { upTo: null, inclusive: true, base: 5, rate: 2, over: 6 * 43560, step: 5 * 43560 },
    ],
    source: "HCC 10-11(b)",
  },
  // by the volume of excavation or fill, cubic yards (10-11(a)). The bases
  // are as written ($25 at 1,000 cu yd, $41 at 10,000), though the steps
  // below them reach $23 and $43
  grading: {
    bands: [
      { upTo: 100, inclusive: true, base: 5 },
      { upTo: 1000, inclusive: true, base: 5, rate: 2, over: 100, step: 100 },
      { upTo: 10000, inclusive: true, base: 25, rate: 2, over: 1000, step: 1000 },
      { upTo: null, inclusive: true, base: 41, rate: 2, over: 10000, step: 1000 },
    ],
    source: "HCC 10-11(a)",
  },
  // over 500 cu yd: $5, plus $2 for each further 1,000 cu yd or fraction
  // (10-11(c)), read as for grubbing
  stockpiling: {
    bands: [
      { upTo: 500, inclusive: true, base: 0 },
      { upTo: 1500, inclusive: true, base: 5 },
      { upTo: null, inclusive: true, base: 5, rate: 2, over: 1500, step: 1000 },
    ],
    source: "HCC 10-11(c)",
  },
  wastewater: {
    // no one-time County sewer charge: the permit to connect is free
    // (21-25(c)); monthly sewer charges (21-36.1) are operating costs. Much of
    // the island has no County sewer, and septic is not modeled
    charge_per_esdu: 0,
    esdu_per_unit: flat(0, "HCC 21-25(c) (no connection fee)"),
  },
  park_dedication: {
    // 2.1 persons per multiple-family unit (8-6(b)(2)) x 5 acres per 1,000
    // persons, 218 sqft per person (8-7(a)(3)): 457.8 sqft per unit, applied
    // at building permit (8-2(a)(1)). Projects of 6 or fewer units pay $150
    // per unit instead (8-7(c)), and districts already above 5 acres per
    // 1,000 residents are exempt (8-4(a)(1)); neither is modeled
    sqft_per_unit: 2.1 * 218,
    // no floor-area alternative; the per-unit area governs
    floor_area_fraction: 1,
    // the fee in lieu is the land's fair market value (8-8), which the model
    // takes as the parcel's land cost; no application fee
    application_fee: { exempt: 0, in_lieu: 0 },
  },
  // HRS 302A: the West Hawaiʻi school impact district was set up in 2010
  // but is reported as not collecting; $0, as for Honolulu and Maui
  school_impact_per_unit: 0,
  source: "HCC 5-7-1, 5-7-3, 5-7-6 (building); 10-11 (site work); 8-6 to 8-8 (park); 21-23, 21-25 (sewer); HRS 302A (school)",
};

// ── water ───────────────────────────────────────────────────────────────

// Department of Water Supply rates brochure (effective July 1, 2025; power
// cost charges through Oct 1, 2026), section G. The facilities charge is the
// larger of the meter-size charge and $6,095 per lot, dwelling unit or
// equivalent unit. Per unit is the larger above 16 units on a 4-inch meter
// ($97,518), 25 on a 6-inch ($152,372) and 50 on an 8-inch ($304,744); it is
// used at every size, so smaller projects on large meters are undercharged.
// The first 5/8-inch connection's lower $1,319 is not modeled
export const water: WaterRules = {
  // $6,095 per dwelling unit, at any height
  wsfc_per_fu: { low_rise: 6095, high_rise: 6095 },
  // one charge unit per dwelling, whatever its size
  demand_per_unit: { studio: 1, one_bb: 1, two_bb: 1, three_bb: 1, four_bb: 1 },
  // the rate does not change with height, so this only names the threshold
  low_rise_max_stories: 3,
  // no minimum charge
  min_fu: 0,
  // the brochure lists no affordable-housing waiver
  waiver_unit_cap: 0,
  // the brochure lists service lateral installation for meters of 2 inches
  // or less only; larger meters are not modeled
  fire_meter_charge: { "4": 0, "6": 0, "8": 0 },
  source: "DWS Water Rates brochure, eff. July 1, 2025, section G (facilities charges)",
};

// ── property tax and income limits ──────────────────────────────────────

// FY 2026–27 (Resolution 574-26, adopted May 21, 2026), per $1,000:
// Apartment $11.70, Long-Term Rental $7.75, Affordable Rental Housing $5.75.
// Land is classed by highest and best use, with zoning given major weight
// (19-53(e)(2)), so an apartment building is Apartment. Affordable Rental
// Housing needs every unit at affordable rents (19-53(h)), and Long-Term
// Rental excludes property "used for commercial or income-producing
// purposes" (19-53(k)(4)), so whether a rental building qualifies is unclear
export const property_tax_rate = 0.0117;

// 2025 HHFDC Hawaiʻi County income limits by AMI %, household sizes 1–8
// (median family income $98,800). The 2026 table (median $98,300) is out;
// 2025 is used to match Honolulu and Maui
export const income_limits: Record<number, number[]> = {
  10: [8470, 9680, 10890, 12090, 13060, 14030, 15000, 15960],
  20: [16940, 19360, 21780, 24180, 26120, 28060, 30000, 31920],
  30: [25410, 29040, 32670, 36270, 39180, 42090, 45000, 47880],
  40: [33880, 38720, 43560, 48360, 52240, 56120, 60000, 63840],
  50: [42350, 48400, 54450, 60450, 65300, 70150, 75000, 79800],
  60: [50820, 58080, 65340, 72540, 78360, 84180, 90000, 95760],
  70: [59290, 67760, 76230, 84630, 91420, 98210, 105000, 111720],
  80: [67760, 77440, 87120, 96720, 104480, 112240, 120000, 127680],
  90: [76230, 87120, 98010, 108810, 117540, 126270, 135000, 143640],
  100: [84700, 96800, 108900, 120900, 130600, 140300, 150000, 159600],
  110: [93170, 106480, 119790, 132990, 143660, 154330, 165000, 175560],
  120: [101640, 116160, 130680, 145080, 156720, 168360, 180000, 191520],
  130: [110110, 125840, 141570, 157170, 169780, 182390, 195000, 207480],
  140: [118580, 135520, 152460, 169260, 182840, 196420, 210000, 223440],
};

// HCC Chapter 11's affordable housing requirement (20% of units for 5 or
// more) applies to new rezonings only (11-4(a)), not to by-right projects,
// so there is no `inclusionary` rule

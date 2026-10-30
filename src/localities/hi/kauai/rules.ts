// County of Kauaʻi: parking, loading, bicycle parking, fees, water charges,
// property tax and income limits.
//
// Parking is from the CZO (Kauaʻi County Code Chapter 8); fees from Chapters
// 9 (park dedication), 12 (building permits), 22 (grading) and 25 (sewers);
// water from the Department of Water's Rules, Part 5 (rev. June 15, 2020);
// property tax from the FY 2026–27 rate notice (Resolution 2026-11) and
// Chapter 5A; income limits from HHFDC's 2025 Kauaʻi schedule. The choices
// made are in docs/notes/KAUAI.md.

import type {
  BicycleRules,
  FeeRules,
  LoadingRules,
  ParkingRules,
  WaterRules,
} from "../../../core/locality";
import { flat } from "../../../core/schedule";

// ── parking, loading and bicycle parking ────────────────────────────────

export const parking: ParkingRules = {
  // at least 2 off-street stalls per dwelling unit, whatever its size
  // (8-4.5(a)(5)); elderly housing may have 1 per 3 units, not modeled. The
  // commercial districts set no dwelling parking, so dwellings there are
  // taken the same way
  residential_stalls_per_unit: 2,
  // retail and services: 1 per 300 sqft of gross floor area, plus 1 per 3
  // employees (not modeled), at least 4 (8-6.3(e)(3)(A))
  retail_sqft_per_stall: 300,
  // no shared-parking reduction; stalls may be off-site within 200 ft
  // (8-6.3(e)(3)(G)), which does not reduce them
  joint_use: 1,
  source: "CZO 8-4.5(a)(5), 8-6.3(e)(3)",
};

// the CZO sets no off-street loading requirement
export const loading: LoadingRules = {
  min_lot_sqft: 0,
  multifamily_spaces: flat(0, "CZO Chapter 8 (no loading requirement)"),
  retail_spaces: flat(0, "CZO Chapter 8 (no loading requirement)"),
  small_space_sqft: 0,
  large_space_sqft: 0,
  source: "CZO Chapter 8 (no loading requirement)",
};

// no bicycle parking minimum in the CZO (every zone sets bicycle_required:
// false, so these are not used)
export const bicycle: BicycleRules = {
  short_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  long_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  sqft_per_space: 0,
  source: "CZO Chapter 8 (no bicycle parking requirement)",
};

// ── fees ────────────────────────────────────────────────────────────────

// earthwork cost per cubic yard the grading fee is taken on; assumed, not
// from the code (the County Engineer estimates it per project)
const GRADING_COST_PER_CU_YD = 30;

export const fees: FeeRules = {
  // Table 1-A, on one unit's construction value, as for the other counties;
  // "or fraction thereof", so each step rounds up. The code values the whole
  // permit's work (109.3), and the table's rate per $1,000 falls as value
  // rises, so per unit overstates the fee. Low-income housing is exempt and
  // gap-group housing pays half (109.2), which the fee toggle covers
  building_permit: {
    bands: [
      { upTo: 500, inclusive: true, base: 15 },
      { upTo: 2000, inclusive: true, base: 15, rate: 2, over: 500, step: 100 },
      { upTo: 25000, inclusive: true, base: 45, rate: 8, over: 2000, step: 1000 },
      { upTo: 50000, inclusive: true, base: 229, rate: 7, over: 25000, step: 1000 },
      { upTo: 100000, inclusive: true, base: 404, rate: 6, over: 50000, step: 1000 },
      { upTo: 1000000, inclusive: true, base: 704, rate: 5, over: 100000, step: 1000 },
      { upTo: 25000000, inclusive: true, base: 5204, rate: 4, over: 1000000, step: 1000 },
      { upTo: 50000000, inclusive: true, base: 101204, rate: 3, over: 25000000, step: 1000 },
      { upTo: null, inclusive: true, base: 176204, rate: 2, over: 50000000, step: 1000 },
    ],
    source: "KCC 12-1.3, Table 1-A",
  },
  // 15% of the building permit fee (109.5), rounded to the dollar (not
  // modeled); revised plans may cost up to that again, not modeled
  plan_review: {
    bands: [{ upTo: null, inclusive: true, base: 0, rate: 0.15 }],
    source: "KCC 12-1.3 (IBC 109.5 as amended)",
  },
  // no County EA or EIS review fee found
  environmental: { ea: 0, eis: 0 },
  // no certificate of occupancy fee in the Building Code
  temp_occupancy_cert: 0,
  // erosion control is part of the grading permit (22-7)
  escp: 0,
  // the lateral is built at the applicant's cost and credited against the
  // sewer connection charge (25-9.4); the sewer permit has no fee (25-10.1)
  installation_trench: 0,
  service_connection: 0,
  // grading, grubbing and stockpiling are one permit, its fee 0.5% of the
  // County Engineer's estimate of the work's cost (22-7.12(a)). Taken on the
  // excavation at an assumed $30 per cubic yard, $0.15 per cubic yard;
  // grubbing and stockpiling add nothing separate
  grading: {
    bands: [{ upTo: null, inclusive: true, base: 0, rate: 0.005 * GRADING_COST_PER_CU_YD }],
    source: `KCC 22-7.12(a) (0.5% of an assumed $${GRADING_COST_PER_CU_YD}/cu yd)`,
  },
  grubbing: flat(0, "KCC 22-7.12(a) (in the grading permit fee)"),
  stockpiling: flat(0, "KCC 22-7.12(a) (in the grading permit fee)"),
  wastewater: {
    // one-time charges per multi-family unit, effective July 1, 2023: sewer
    // connection charge $593 (25-11.1) plus wastewater treatment capacity
    // assessment $1,930 (25-12.1). Affordable housing is exempt and
    // gap-group housing pays half (25-11.2, 25-12.3), which the fee toggle
    // covers. Parcels outside the County sewer pay none, not modeled
    charge_per_esdu: 593 + 1930,
    esdu_per_unit: flat(1, "KCC 25-11.1, 25-12.1 (per multi-family unit)"),
  },
  park_dedication: {
    // 1.75 acres per 1,000 people at 2.1 people per multi-family unit
    // (9-2.8(d)): 160 sqft per unit, for all but one unit on a lot at
    // building permit (9-2.8(c)(2)(E)). The first six units of a building
    // subdivision pay $150 each instead (9-2.8(d)(4)), not modeled
    sqft_per_unit: (1.75 * 2.1 * 43560) / 1000,
    exempt_units: 1,
    floor_area_fraction: 1,
    // the fee in lieu is the raw land's value plus half its rise on
    // subdivision (9-2.8(e)), taken as the parcel's land cost
    application_fee: { exempt: 0, in_lieu: 0 },
  },
  // HRS 302A: no Kauaʻi school impact district; $0, as for the other counties
  school_impact_per_unit: 0,
  source:
    "KCC 12-1.3 (building); 22-7.12 (grading); 25-9.4, 25-11.1, 25-12.1 (sewer); 9-2.8 (park); HRS 302A (school)",
};

// ── water ───────────────────────────────────────────────────────────────

// Department of Water Rules, Part 5 (rev. June 15, 2020), Section III.3(b):
// multi-family development pays the larger of the approved meter's charge
// and $9,880 per unit. Per unit is the larger above 35 units on a 4-inch
// meter ($352,880) and 71 on a 6-inch ($705,750); it is used at every size,
// so smaller projects on large meters are undercharged. County Housing
// Agency affordable projects pay $4,940 per unit (III.3(d)), not modeled
export const water: WaterRules = {
  // $9,880 per dwelling unit, at any height
  wsfc_per_fu: { low_rise: 9880, high_rise: 9880 },
  // one charge per dwelling, whatever its size
  demand_per_unit: { studio: 1, one_bb: 1, two_bb: 1, three_bb: 1, four_bb: 1 },
  // the rate does not change with height, so this only names the threshold
  low_rise_max_stories: 3,
  min_fu: 0,
  // no affordable-housing waiver; collection may only be deferred (IV.8)
  waiver_unit_cap: 0,
  // monthly fire service charges are operating costs (Part 4); no one-time
  // fire meter charge
  fire_meter_charge: { "4": 0, "6": 0, "8": 0 },
  source: "Kauaʻi DOW Rules Part 5 (rev. June 15, 2020), Section III.3",
};

// ── property tax and income limits ──────────────────────────────────────

// FY 2026–27 (Resolution 2026-11; the same rates as FY 2025–26), per $1,000.
// Property is classed by actual use (5A-6.4(a)). A building of long-term
// rentals is Non-Owner-Occupied Residential, taxed in tiers of the parcel's
// value: $5.45 to $1.3 million, $6.05 to $2 million, $9.40 above. An
// apartment building's value is mostly above $2 million, so the top tier is
// used; at $8 million the blended rate is about $8.47. A building with
// retail has two uses and takes the higher rate, comparing tiered classes at
// their lowest tier (5A-6.4(d)): Commercial, $8.10. Long-Term Affordable
// Rental ($2.59) needs every dwelling on the parcel to qualify (5A-11A.1(b))
export const property_tax_rate = 0.0094;

// 2025 HHFDC Kauaʻi County income limits by AMI %, household sizes 1–8
// (median family income $132,900); 2025 to match the other counties
export const income_limits: Record<number, number[]> = {
  10: [9310, 10640, 11970, 13290, 14360, 15420, 16480, 17550],
  20: [18620, 21280, 23940, 26580, 28720, 30840, 32960, 35100],
  30: [27930, 31920, 35910, 39870, 43080, 46260, 49440, 52650],
  40: [37240, 42560, 47880, 53160, 57440, 61680, 65920, 70200],
  50: [46550, 53200, 59850, 66450, 71800, 77100, 82400, 87750],
  60: [55860, 63840, 71820, 79740, 86160, 92520, 98880, 105300],
  70: [65170, 74480, 83790, 93030, 100520, 107940, 115360, 122850],
  80: [74480, 85120, 95760, 106320, 114880, 123360, 131840, 140400],
  90: [83790, 95760, 107730, 119610, 129240, 138780, 148320, 157950],
  100: [93100, 106400, 119700, 132900, 143600, 154200, 164800, 175500],
  110: [102410, 117040, 131670, 146190, 157960, 169620, 181280, 193050],
  120: [111720, 127680, 143640, 159480, 172320, 185040, 197760, 210600],
  130: [121030, 138320, 155610, 172770, 186680, 200460, 214240, 228150],
  140: [130340, 148960, 167580, 186060, 201040, 215880, 230720, 245700],
};

// The Housing Policy (Chapter 7A) asks 20% workforce housing, for sale at
// 80–120% of median income, of projects of more than 10 units on a lot in a
// residential, resort or commercial district (7A-1.4.1(c)(2), 7A-2.1(a)).
// Multiple-family projects in residential or mixed-use districts of R-10
// density or more, outside visitor destination areas and SMAs, built at or
// above the maximum density, are exempt until October 2030 (7A-1.4.2(b)).
// The model builds R-10 and R-20 to the maximum density, so they qualify;
// R-1 to R-6 projects of more than 10 units, and CN and CG (commercial, not
// residential or mixed-use), may not. The engine's rule is county-wide, so
// there is no `inclusionary` rule; see docs/notes/KAUAI.md

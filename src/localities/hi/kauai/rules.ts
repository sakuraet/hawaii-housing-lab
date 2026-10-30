// County of Kauaʻi: parking, loading, bicycle parking, fees, water charges,
// property tax and income limits.
//
// Parking is from the CZO (Kauaʻi County Code Chapter 8); property tax from
// the FY 2026–27 rate notice (Resolution 2026-11); income limits from HHFDC's
// 2025 Kauaʻi schedule. Loading, fees and water are Maui's until Kauaʻi's
// (building permits, grading, sewer, park dedication, Department of Water
// facilities reserve charge) are read; each is marked "Maui's" below. The
// choices made are in docs/notes/KAUAI.md.

import type { BicycleRules, ParkingRules } from "../../../core/locality";
import * as maui from "../maui/rules";

// ── parking, loading and bicycle parking ────────────────────────────────

export const parking: ParkingRules = {
  // at least 2 off-street stalls per dwelling unit, whatever its size
  // (8-4.5(a)); the commercial districts' dwellings are taken the same way
  residential_stalls_per_unit: 2,
  // retail and services: 1 per 300 sqft of gross floor area, plus 1 per 3
  // employees (not modeled), at least 4 (8-6.3(e)(3))
  retail_sqft_per_stall: 300,
  // no shared-parking reduction found
  joint_use: 1,
  source: "CZO 8-4.5(a), 8-6.3(e)(3)",
};

// Maui's, pending Kauaʻi's loading rules
export const loading = maui.loading;

// no bicycle parking minimum found in the CZO (every zone sets
// bicycle_required: false, so these are not used)
export const bicycle: BicycleRules = {
  short_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  long_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  sqft_per_space: 0,
  source: "CZO Chapter 8 (no bicycle parking requirement found)",
};

// ── fees and water ──────────────────────────────────────────────────────

// Maui's, pending Kauaʻi's: building permit and plan review (Ch. 12),
// grading (Ch. 22), sewer connection charge and wastewater treatment
// capacity assessment (Ch. 25), park dedication (Ch. 9)
export const fees = maui.fees;

// Maui's, pending the Kauaʻi Department of Water's facilities reserve
// charge (Rules Part 5)
export const water = maui.water;

// ── property tax and income limits ──────────────────────────────────────

// FY 2026–27 (Resolution 2026-11; the same rates as FY 2025–26), per $1,000.
// Kauaʻi classes property by use. A building of long-term rentals is
// Non-Owner-Occupied Residential, taxed in tiers of the parcel's value:
// $5.45 to $1.3 million, $6.05 to $2 million, $9.40 above. An apartment
// building's value is mostly above $2 million, so the top tier is used; at
// $8 million the blended rate is about $8.47. Long-Term Affordable Rental
// is $2.59, not modeled
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

// The Housing Policy (Chapter 7A, as amended by Ord. 1081, 2020) asks 20%
// workforce housing of projects of more than 10 units in residential,
// resort and commercial districts, but exempts multiple-family projects in
// residential or mixed-use districts of R-10 density or more built at the
// maximum density, outside visitor destination areas and SMAs, until
// October 2030 (7A-1.4.2). The model builds to the maximum density, so there
// is no `inclusionary` rule; to be checked against the current Chapter 7A

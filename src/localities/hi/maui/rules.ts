// County of Maui: parking, loading, bicycle parking, fees, water charges,
// property tax and income limits.
//
// Loading, park dedication and the tax classes are from the code on Municode
// (version of Sep 14, 2026). The housing parking minimum is from Ordinance
// 5983 (Bill 47 CD1, effective Apr 20, 2026), which Municode's version did
// not yet include. The code leaves the fee amounts to the
// annual budget; they are from the County of Maui FY 2027 Appendix B,
// "Revenues - Fees, Rates, Assessments and Taxes" (July 1, 2026 to June 30,
// 2027), cited below as "FY27 App. B" with its page. Water charges are from
// the Department of Water Supply's own FY 2027 appendix. The choices made in
// fitting these to the model are listed in docs/notes/MAUI.md.

import type {
  BicycleRules,
  FeeRules,
  InclusionaryRules,
  LoadingRules,
  ParkingRules,
  WaterRules,
} from "../../../core/locality";
import { flat } from "../../../core/schedule";

// ── parking, loading and bicycle parking (MCC 19.36B) ───────────────────

export const parking: ParkingRules = {
  // by bedrooms per dwelling unit (Ord. 5983): studio and one-bedroom 1,
  // two- and three-bedroom 2, four or more 3 plus 1 for each bedroom over
  // four (the model's largest type has four). Before Ord. 5983 it went by
  // floor area: 2 stalls for any unit under 3,000 sqft
  residential_stalls_by_type: { studio: 1, one_bb: 1, two_bb: 2, three_bb: 2, four_bb: 3 },
  // general merchandising, general office, personal and business services:
  // 1 per 500 sqft, at least 3 (the minimum of 3 is not modeled; eating and
  // drinking places need 1 per 100 sqft of dining area)
  retail_sqft_per_stall: 500,
  // no joint-use reduction in the code; the director may reduce required
  // parking by up to 50% case by case (19.36B.110(A)), which is not modeled
  joint_use: 1,
  source: "MCC 19.36B.020 as amended by Ord. 5983 (2026); MCC 19.36B.110(A)",
};

export const loading: LoadingRules = {
  // no lot-size threshold; the requirement is by floor area
  min_lot_sqft: 0,
  // dwelling floor area is excluded, so housing needs no loading space
  multifamily_spaces: flat(0, "MCC 19.36B.030 (dwelling floor area excluded)"),
  // by non-dwelling floor area: 1 space for 2,000–10,000 sqft, 2 above.
  // The code also sets each space's size (small 2,000–5,000; medium
  // 5,001–10,000; small + medium to 20,000; medium + large to 50,000;
  // 2 large above); the model has small and large sizes only
  retail_spaces: {
    bands: [
      { upTo: 2000, inclusive: false, base: 0 },
      { upTo: 10000, inclusive: true, base: 1 },
      { upTo: null, inclusive: true, base: 2 },
    ],
    source: "MCC 19.36B.030",
  },
  // small 8.5 ft x 19 ft; large 12 ft x 35 ft
  small_space_sqft: 8.5 * 19,
  large_space_sqft: 12 * 35,
  source: "MCC 19.36B.030",
};

// Maui does not require bicycle parking (every Maui zone sets
// bicycle_required: false, so these are not used). Bicycle spaces may
// replace up to 2 required non-dwelling stalls (19.36B.110(C))
export const bicycle: BicycleRules = {
  short_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  long_term: { units_per_space: 0, retail_sqft_per_space: 0, stalls_per_space: 0 },
  // 2 ft wide, 5 ft clear of vehicle access (19.36B.110(C)); length not set
  sqft_per_space: 0,
  source: "MCC 19.36B (no bicycle parking requirement); MCC 19.36B.110(C)",
};

// ── fees ────────────────────────────────────────────────────────────────

const APP_B = "FY27 App. B";

export const fees: FeeRules = {
  // on one unit's construction value, as for Honolulu; "or fraction
  // thereof", so each step rounds up. Affordable housing under MCC 2.86 pays
  // 50%; 100% workforce housing projects are exempt
  building_permit: {
    bands: [
      { upTo: 500, inclusive: true, base: 30 },
      { upTo: 2000, inclusive: true, base: 30, rate: 3, over: 500, step: 100 },
      { upTo: 25000, inclusive: true, base: 75, rate: 10, over: 2000, step: 1000 },
      { upTo: 50000, inclusive: true, base: 305, rate: 9, over: 25000, step: 1000 },
      { upTo: 100000, inclusive: true, base: 530, rate: 7, over: 50000, step: 1000 },
      { upTo: 500000, inclusive: true, base: 880, rate: 5, over: 100000, step: 1000 },
      { upTo: 1000000, inclusive: true, base: 2880, rate: 6, over: 500000, step: 1000 },
      { upTo: null, inclusive: true, base: 5880, rate: 10, over: 1000000, step: 1000 },
    ],
    source: `${APP_B} p. 36 (MCC 16.25.109)`,
  },
  // building plan review: 35% of the building permit fee. Fire plan review
  // (17.5% of the building permit fee, MCC 16.04E.060, App. B p. 20) is not
  // included, as Honolulu's config includes no fire review fee
  plan_review: {
    bands: [{ upTo: null, inclusive: true, base: 0, rate: 0.35 }],
    source: `${APP_B} p. 50 (MCC 16.25.109.2.1)`,
  },
  // Planning Department review of a nonexempt environmental assessment (HRS
  // 343); App. B lists no separate EIS fee
  environmental: { ea: 1895, eis: 0 },
  // certificate of occupancy issuance fee
  temp_occupancy_cert: 50,
  // no separate erosion control plan fee; it is part of the grading permit
  escp: 0,
  // Maui charges utility trenching in County roads per permit, not per unit
  // (County highways permit, MCC 12.04.025: $250 plus $200 for up to 100
  // lineal feet), which the per-unit fields cannot express; not modeled
  installation_trench: 0,
  service_connection: 0,
  // by lot area: $100 for an acre, $50 for each further acre or fraction
  grubbing: {
    bands: [
      { upTo: 43560, inclusive: true, base: 100 },
      { upTo: null, inclusive: true, base: 100, rate: 50, over: 43560, step: 43560 },
    ],
    source: `${APP_B} p. 48 (MCC 12.04.025, 20.08.090)`,
  },
  // by the volume of excavation or fill, cubic yards, per 100 or fraction
  grading: {
    bands: [
      { upTo: 500, inclusive: true, base: 0, rate: 60, step: 100 },
      { upTo: 10000, inclusive: true, base: 300, rate: 25, over: 500, step: 100 },
      { upTo: null, inclusive: true, base: 2675, rate: 8, over: 10000, step: 100 },
    ],
    source: `${APP_B} p. 48 (MCC 20.08.090)`,
  },
  // no separate stockpiling permit; fill is counted in the grading volume
  stockpiling: flat(0, `${APP_B} p. 48 (no stockpiling fee; MCC 20.08.090)`),
  wastewater: {
    // facility expansion assessment, $ per gallon of project flow:
    // Wailuku-Kahului $4.57 (MCC 14.35.060), Kīhei $4.65 (MCC 14.34.060);
    // other service areas have none. The model has one rate per county, so
    // it takes Wailuku-Kahului, the central Maui system
    charge_per_esdu: 4.57,
    // project flow, gallons per day per dwelling unit (the field is named for
    // Honolulu's ESDU). The code leaves residential flow to the Wastewater
    // Reclamation Division's standards (MCC 14.35.030); its flow standards
    // give 255 gpd for an apartment or condominium unit, whatever the size.
    // That table is dated 2006 and has not been confirmed as current
    esdu_per_unit: flat(255, "County of Maui WWRD, Wastewater Flow Standards (apartment/condo)"),
  },
  park_dedication: {
    // 500 sqft per unit in excess of 3 (250 sqft for residential workforce
    // housing units, not modeled); paid in lieu at the average assessed land
    // value per sqft of non-owner-occupied and apartment land in the
    // community plan area, which the model takes as the parcel's land cost
    sqft_per_unit: 500,
    exempt_units: 3,
    // Maui has no floor-area alternative; 1 means the per-unit area governs
    floor_area_fraction: 1,
    // App. B lists no park assessment application fee
    application_fee: { exempt: 0, in_lieu: 0 },
  },
  // HRS Ch. 302A; set to $0 for now, as for Honolulu
  school_impact_per_unit: 0,
  source: `${APP_B} pp. 11 (wastewater), 30 (parks), 31 (EA), 36–37 (building, occupancy), 48 (site), 50 (plan review); MCC 18.16.320; HRS 302A (school)`,
};

// ── water: Department of Water Supply ───────────────────────────────────

// From the Department of Water Supply's FY 2027 Appendix B, "Water Fund -
// Water Rates and Fees" (cited as "DWS FY27 App. B"), and its Water Use
// Calculation Method (Ord. 5759, for permits applied for from Jan 1, 2026).
//
// Maui charges its water system development fee per equivalent single
// dwelling (ESD, 300 gallons a day), not per fixture unit as Honolulu's BWS
// does. ESDs per dwelling come from its bedrooms and bathrooms:
//   ESDs = [1.15 x baths^1.3 + beds + 3] / 10
// rounded to 0.1 as in DWS's table. The beds and baths are the model's for
// each unit type (BATHS_BY_UNIT_TYPE); a studio counts as 0 bedrooms.
// The model multiplies the charge per unit by these instead of fixture units.
const DWS = "DWS FY27 App. B p. 64 (MCC 14.07)";

export const water: WaterRules = {
  // $3,541 source + $900 transmission + $1,050 storage per ESD, at any height
  wsfc_per_fu: { low_rise: 5491, high_rise: 5491 },
  demand_per_unit: {
    studio: 0.4, // 0 beds, 1 bath: 0.415
    one_bb: 0.5, // 1 bed, 1 bath: 0.515
    two_bb: 0.7, // 2 beds, 1.5 baths: 0.695
    three_bb: 0.9, // 3 beds, 2 baths: 0.883
    four_bb: 1.0, // 4 beds, 2 baths: 0.983
  },
  // the rate does not change with height, so this only names the threshold
  low_rise_max_stories: 3,
  // no minimum charge
  min_fu: 0,
  // no affordable-housing waiver of the fee in the appendix (MCC 14.07.080
  // allows only those "set forth in the annual budget")
  waiver_unit_cap: 0,
  // Maui has no fixed charge for a new service connection: DWS bills meter
  // installation at actual cost, against a $1,000 deposit for a meter over
  // 1 inch (DWS App. B pp. 57–60), which is not modeled. Its fixed one-time
  // charge for a project is the $1,250 building permit review fee for a
  // non-single-family building, carried here so it is counted
  fire_meter_charge: { "4": 1250, "6": 1250, "8": 1250 },
  source: `${DWS}; DWS Water Use Calculation Method (Ord. 5759)`,
};

// ── residential workforce housing (MCC 2.96) ────────────────────────────

// A project creating 10 or more dwelling units must provide workforce
// housing units equal to 25% of its market-rate units, rounded up
// (2.96.030(A), 2.96.040(A)), so about a fifth of all units. Applied at
// building permit, so by-right projects are covered; 201H projects too
// (2.96.030(E)). Rental units are split in thirds: 80% AMI or less, over 80
// to 100%, over 100 to 120% (2.96.040(C)(2)); each rents at its band's cap.
// Not modeled: the 20% share for units conveyed to a qualified housing
// provider in perpetuity, the in-lieu fee (2.96.040(B)(4)), the Wailuku
// redevelopment area exemption, and Hāna, Lānaʻi and Molokaʻi's adjusted AMI
export const inclusionary: InclusionaryRules = {
  min_units: 10,
  share_of_market: 0.25,
  rent_ami: [80, 100, 120],
  source: "MCC 2.96.030(A), 2.96.040(A), (C)(2) (Ord. 5875, 2025)",
};

// ── property tax and income limits ──────────────────────────────────────

// a building of 5 or more dwellings that are not vacation rentals is
// classed "apartment" (MCC 3.48.305(B)(3)): $3.50 per $1,000 in FY 2027
// (App. B p. 12). Units granted a long-term rental exemption are classed
// "long-term rental" instead ($2.90 to $1.5M, $5.00 to $3M, $8.50 above),
// which is not modeled
export const property_tax_rate = 0.0035;

// 2026 HHFDC Maui County income limits by AMI %, household sizes 1–8
// (median family income $121,400)
export const income_limits: Record<number, number[]> = {
  10: [10360, 11840, 13320, 14800, 15990, 17170, 18360, 19540],
  20: [20720, 23680, 26640, 29600, 31980, 34340, 36720, 39080],
  30: [31080, 35520, 39960, 44400, 47970, 51510, 55080, 58620],
  40: [41440, 47360, 53280, 59200, 63960, 68680, 73440, 78160],
  50: [51800, 59200, 66600, 74000, 79950, 85850, 91800, 97700],
  60: [62160, 71040, 79920, 88800, 95940, 103020, 110160, 117240],
  70: [72520, 82880, 93240, 103600, 111930, 120190, 128520, 136780],
  80: [82880, 94720, 106560, 118400, 127920, 137360, 146880, 156320],
  90: [93240, 106560, 119880, 133200, 143910, 154530, 165240, 175860],
  100: [103600, 118400, 133200, 148000, 159900, 171700, 183600, 195400],
  110: [113960, 130240, 146520, 162800, 175890, 188870, 201960, 214940],
  120: [124320, 142080, 159840, 177600, 191880, 206040, 220320, 234480],
  130: [134680, 153920, 173160, 192400, 207870, 223210, 238680, 254020],
  140: [145040, 165760, 186480, 207200, 223860, 240380, 257040, 273560],
};

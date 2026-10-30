// County of Kauaʻi: zoning districts that allow multiple-family dwellings
// (Kauaʻi County Code Chapter 8, the Comprehensive Zoning Ordinance, "CZO"),
// with each zone's `current` rules as its current zoning, the only pathway
// the county runs.
//
// Density is dwelling units per acre, not FAR: a residential district's
// number is its units per acre (R-20 = 20 per acre, 2,178 sqft of land per
// unit; 8-4.2), and a fractional unit of 65% or more counts as a whole one
// (8-4.6). The commercial districts take a residential district's density:
// CN R-10's, or an adjoining residential district's where higher (not
// modeled); CG R-20's (8-6.6).
//
// Coverage counts buildings and pavement together (8-4.3(d)(3), 8-6.3(g)),
// as the model's coverage does buildings and parking.
//
// Height is not set here; it comes from each parcel's `height`. Multiple-
// family buildings: 4 stories and 40 ft to the wall plate, and no more than
// 10 ft above a residence within 30 ft (8-4.5(b)(2)); CN 35 ft and 2 stories, CG
// 50 ft (8-6.3(f)).
//
// Multiple-family dwellings are permitted in every residential district
// R-1 to R-20 (Table 8-2.4(b)), in CN (8-2.4(j)(9)) and in CG (8-2.4(k)(22)).
//
// Not listed, so a parcel in them stops with an error:
//   R-40         not in Table 8-2.4 or 8-4.3(d)(3)'s coverage limits, so its
//                uses and standards are not set
//   RR-10, RR-20 resort districts: multiple-family is not among their uses
//                (8-2.4(h), (i))
//   the Līhuʻe, Kōloa, Kalāheo and Kapaʻa-Wailua form-based districts
//                (Chapter 10), with their own codes and standards
//   IL, IG, A, O industrial, agriculture, open
// Constraint and special treatment overlays (S-, ST-) are not modeled.

import type { YardRules, ZoneRules } from "../../../core/locality";
import { flat } from "../../../core/schedule";

const ACRE_SQFT = 43560;

// a fractional unit of 65% or more of a unit counts as a whole unit (8-4.6(f))
const ROUND_UP_AT = 0.65;

// front 10 ft from the street; side and rear 5 ft or half the height of the
// nearest building wall, whichever is greater (8-4.3(b)). The front yard is
// also kept from driveways and parking lots serving more than 3 units, not
// modeled
const RESIDENTIAL_YARDS: YardRules = {
  front_ft: 10,
  rear_ft: 5,
  side_ft: 5,
  side_rear_height_fraction: 0.5,
};

// 5 ft from a street (15 ft where vehicles enter the building from that
// side, not modeled); no side or rear yard next to a commercial district
// (8-6.3(b)). Next to a residential district the residential side yard and
// a 10 ft rear yard apply; the parcel data has no neighboring zone, so a
// commercial neighbor is assumed
const COMMERCIAL_YARDS: YardRules = { front_ft: 5, rear_ft: 0, side_ft: 0 };

// a residential district: R-20 is 20 units per acre
function residential(units_per_acre: number, coverage: number): ZoneRules {
  return {
    name: `Residential R-${units_per_acre}`,
    current: {
      lot_area_per_unit: flat(ACRE_SQFT / units_per_acre, `CZO 8-4.2 (${units_per_acre} units per acre)`),
      units_round_up_at: ROUND_UP_AT,
      lot_coverage: flat(coverage, "CZO 8-4.3(d)(3) (buildings and pavement)"),
      yards: RESIDENTIAL_YARDS,
    },
    commercial_coverage: 0,
    // no bicycle parking minimum found in the CZO
    bicycle_required: false,
    residential_permitted: true,
    source: "CZO Table 8-2.4(b); 8-4.2, 8-4.3, 8-4.5, 8-4.6(f)",
  };
}

// a commercial district, at a residential district's density
function commercial(
  name: string,
  units_per_acre: number,
  coverage: number,
  density_source: string
): ZoneRules {
  return {
    name,
    current: {
      lot_area_per_unit: flat(ACRE_SQFT / units_per_acre, density_source),
      units_round_up_at: ROUND_UP_AT,
      lot_coverage: flat(coverage, "CZO 8-6.3(g) (buildings and pavement)"),
      yards: COMMERCIAL_YARDS,
    },
    // commercial uses are permitted; no share is required
    commercial_coverage: 1,
    bicycle_required: false,
    residential_permitted: true,
    source: `${density_source}, 8-6.3`,
  };
}

export const zones: Record<string, ZoneRules> = {
  // residential districts (CZO Article 4): coverage 60% in R-1 to R-6, 80%
  // in R-10, 90% in R-20
  "R-1": residential(1, 0.6),
  "R-2": residential(2, 0.6),
  "R-4": residential(4, 0.6),
  "R-6": residential(6, 0.6),
  "R-10": residential(10, 0.8),
  "R-20": residential(20, 0.9),
  // commercial districts (CZO Article 6)
  CN: commercial("Neighborhood Commercial", 10, 0.8, "CZO 8-2.4(j)(9), 8-6.6(a) (R-10 density)"),
  CG: commercial("General Commercial", 20, 0.9, "CZO 8-2.4(k)(22), 8-6.6(b) (R-20 density)"),
};

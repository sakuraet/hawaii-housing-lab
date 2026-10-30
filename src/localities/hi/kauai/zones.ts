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
// Coverage counts buildings and pavement together (8-4.3(d), 8-6.3(g)), as
// the model's coverage does buildings and parking.
//
// Height is not set here; it comes from each parcel's `height`. Multiple-
// family buildings: 4 stories and 40 ft to the wall plate, and no more than
// 10 ft above a residence within 30 ft (8-4.5); CN 35 ft and 2 stories, CG
// 50 ft (8-6.3(f)).
//
// Read from a mirror of the CZO (current to Ord. 1173, May 2025), pending a
// check against the County's text and Table 8-2.4 (uses by district).
//
// Not listed, so a parcel in them stops with an error:
//   R-1 to R-6   single-family; multiple-family not confirmed in Table 8-2.4
//   R-40         no coverage limit in 8-4.3(d); its standards not yet found
//   RR-10, RR-20 resort districts: hotel standards, visitor destination
//                areas and the resort workforce housing rule (7A-2.1(b))
//   the Līhuʻe, Kōloa, Kalāheo and Kapaʻa-Wailua form-based districts
//                (Chapter 10), with their own codes and standards
//   IL, IG, A, O industrial, agriculture, open
// Constraint and special treatment overlays (S-, ST-) are not modeled.

import type { YardRules, ZoneRules } from "../../../core/locality";
import { flat } from "../../../core/schedule";

const ACRE_SQFT = 43560;

// a fractional unit of 65% or more of a unit counts as a whole unit (8-4.6)
const ROUND_UP_AT = 0.65;

// front 10 ft from the street; side and rear 5 ft or half the height of the
// nearest building wall, whichever is greater (8-4.3(b))
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
      lot_coverage: flat(coverage, "CZO 8-4.3(d) (buildings and pavement)"),
      yards: RESIDENTIAL_YARDS,
    },
    commercial_coverage: 0,
    // no bicycle parking minimum found in the CZO
    bicycle_required: false,
    residential_permitted: true,
    source: "CZO 8-4.2, 8-4.3, 8-4.5, 8-4.6",
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
  // residential districts (CZO Article 4): coverage 80% in R-10, 90% in R-20
  "R-10": residential(10, 0.8),
  "R-20": residential(20, 0.9),
  // commercial districts (CZO Article 6)
  CN: commercial("Neighborhood Commercial", 10, 0.8, "CZO 8-6.6 (R-10 density)"),
  CG: commercial("General Commercial", 20, 0.9, "CZO 8-6.6 (R-20 density)"),
};

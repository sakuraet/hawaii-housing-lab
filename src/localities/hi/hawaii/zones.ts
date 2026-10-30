// County of Hawaiʻi: zoning districts that allow multiple-family dwellings
// by right (HCC Chapter 25, Supp. 20, 7-2026), with each zone's `current`
// rules as its current zoning, the only pathway the county runs.
//
// Density is land area per unit, not FAR: none of these districts has an
// FAR. An RM, RCX or V code's number is the land area per unit in thousands
// of sqft (RM-2 = 2,000 sqft per unit). A CN, CG or CV code's number is the
// minimum building site in thousands of sqft (not modeled); their density is
// a flat 1,250 sqft per unit. The codes are the ones on the County GIS zoning
// definitions list (rev. April 22, 2020). RCX counts commercial units against
// its density too (25-5-41(a)); no commercial is modeled there, so it doesn't
// bind.
//
// None of these districts caps lot coverage. RM, RCX and V must landscape
// 20% of the site, not counting parking, so buildings and parking can cover
// at most 80%, taken here as the lot coverage; the commercial districts
// landscape only their front yards (25-5-107), so they take 100%.
//
// Height is not set here: it varies within a district (RM, V and CG: 45 ft,
// 120 ft in the City of Hilo; V at Keauhou and Kahaluʻu Bays 90 ft), so it
// comes from each parcel's `height`.
//
// Not listed, so a parcel in them stops with an error:
//   MCX        multiple-family dwellings need a use permit (25-5-132(b))
//   V, CV,     bare codes with no number on the GIS list, so no density
//   MCX
//   RS, RD, RA single-family and duplex
// Planned unit developments (25-5-38(d)) can relax height, site and yards
// with Planning Commission approval; not modeled.

import type { YardRules, ZoneRules } from "../../../core/locality";
import { flat } from "../../../core/schedule";

// front and rear 20 ft; side 8 ft for one story plus 2 ft for each added
// story (25-5-36, 25-5-46, 25-5-96)
const RESIDENTIAL_YARDS: YardRules = {
  front_ft: 20,
  rear_ft: 20,
  side_ft: 8,
  side_ft_per_added_story: 2,
};

// front and rear 15 ft; no side yard except next to a residential district,
// which is not modeled (25-5-106, 25-5-116, 25-5-126)
const COMMERCIAL_YARDS: YardRules = { front_ft: 15, rear_ft: 15, side_ft: 0 };

// a residential district: RM-2 is 2,000 sqft of land per unit
function residential(
  name: string,
  designation: number,
  sections: { density: string; yards: string; landscaping: string }
): ZoneRules {
  return {
    name,
    current: {
      lot_area_per_unit: flat(designation * 1000, sections.density),
      lot_coverage: flat(0.8, `${sections.landscaping} (20% landscaped, parking excluded)`),
      yards: RESIDENTIAL_YARDS,
    },
    // RCX allows commercial uses, but no floor may hold both dwellings and
    // commercial (25-5-48(b)), so no ground-floor retail under housing
    commercial_coverage: 0,
    // no bicycle parking minimum (bike stalls only reduce car stalls, 25-4-52(c))
    bicycle_required: false,
    residential_permitted: true,
    source: `${sections.density}, ${sections.yards}, ${sections.landscaping}`,
  };
}

// a commercial district: multiple-family dwellings at most 1 per 1,250 sqft
function commercial(name: string, uses: string, yards: string): ZoneRules {
  return {
    name,
    current: {
      lot_area_per_unit: flat(1250, uses),
      lot_coverage: flat(1, `${yards} (no coverage limit)`),
      yards: COMMERCIAL_YARDS,
    },
    // commercial uses are permitted throughout; no share is required
    commercial_coverage: 1,
    bicycle_required: false,
    residential_permitted: true,
    source: `${uses}, ${yards}`,
  };
}

const RM = { density: "HCC 25-5-31", yards: "25-5-36", landscaping: "25-5-37" };
const RCX = { density: "HCC 25-5-41", yards: "25-5-46", landscaping: "25-5-47" };
const V = { density: "HCC 25-5-91", yards: "25-5-96", landscaping: "25-5-97" };

// designations on the County GIS zoning definitions list. RM-1.25 and
// RM-14.5 are not among 25-5-31(d)'s steps but are mapped
const RM_DESIGNATIONS = ["0.75", "1", "1.25", "1.5", "2", "2.5", "3", "3.5", "4", "5", "5.5", "6", "7", "8", "10", "14.5", "15", "20"];
const RCX_DESIGNATIONS = ["2", "10", "20"];
// V-1.0 and V-2.0 are written both ways on the list; V-25 is as listed
const V_DESIGNATIONS = ["0.75", "1", "1.0", "1.25", "1.5", "1.75", "2", "2.0", "2.25", "4", "6.0", "7", "25"];

// the zone code as the parcel data writes it: "RM-.75", not "RM-0.75"
const code = (district: string, designation: string) =>
  `${district}-${designation.replace(/^0\./, ".")}`;

export const zones: Record<string, ZoneRules> = {
  // RM multiple-family residential (25-5-30 to 25-5-38)
  ...Object.fromEntries(
    RM_DESIGNATIONS.map((d) => [
      code("RM", d),
      residential(`Multiple-Family Residential ${code("RM", d)}`, Number(d), RM),
    ])
  ),
  // RCX residential-commercial mixed use (25-5-40 to 25-5-49)
  ...Object.fromEntries(
    RCX_DESIGNATIONS.map((d) => [
      code("RCX", d),
      residential(`Residential-Commercial Mixed Use ${code("RCX", d)}`, Number(d), RCX),
    ])
  ),
  // V resort-hotel (25-5-90 to 25-5-98): dwellings and multiple-family
  // dwellings are permitted uses (25-5-92(a)(12), (13))
  ...Object.fromEntries(
    V_DESIGNATIONS.map((d) => [
      code("V", d),
      residential(`Resort-Hotel ${code("V", d)}`, Number(d), V),
    ])
  ),
  // commercial districts: multiple-family dwellings permitted at 1,250 sqft
  // of land per unit
  ...Object.fromEntries(
    ["7.5", "10", "20", "40"].map((d) => [
      `CN-${d}`,
      commercial(`Neighborhood Commercial CN-${d}`, "HCC 25-5-102(a)(14)", "25-5-106"),
    ])
  ),
  ...Object.fromEntries(
    ["7.5", "10", "20"].map((d) => [
      `CG-${d}`,
      commercial(`General Commercial CG-${d}`, "HCC 25-5-112(a)(24)", "25-5-116"),
    ])
  ),
  ...Object.fromEntries(
    ["7.5", "10", "15", "20"].map((d) => [
      `CV-${d}`,
      commercial(`Village Commercial CV-${d}`, "HCC 25-5-122(a)(18)", "25-5-126"),
    ])
  ),
  // downtown Hilo commercial (25-7-20 to 25-7-27): 500 sqft of land per
  // unit, no yards except as set at plan approval, height 120 ft. Housing
  // parking is 1 stall per unit when denser than 1,000 sqft per unit
  // (25-4-51(a)(6), 25-7-27(b)), which a project at the district's density
  // is; inside the downtown core none is required (25-4-59.2(2)), which the
  // parcel's `parking_exempt` carries
  CDH: {
    name: "Downtown Hilo Commercial",
    current: {
      lot_area_per_unit: flat(500, "HCC 25-7-22(a)(17)"),
      lot_coverage: flat(1, "HCC 25-7-26 (no coverage limit)"),
      yards: { front_ft: 0, rear_ft: 0, side_ft: 0 },
      residential_stalls_per_unit: 1,
    },
    commercial_coverage: 1,
    bicycle_required: false,
    residential_permitted: true,
    source: "HCC 25-7-22, 25-7-26, 25-7-27; 25-4-51(a)(6)",
  },
};

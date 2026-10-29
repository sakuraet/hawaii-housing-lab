// TEMPLATE: the county's zoning districts that allow multifamily housing.
// One entry per district, keyed by the code exactly as the parcel data writes
// it (for example "A-2"). Fill in every TODO; replace "TODO" sources with the
// code section, for example "MCC 19.12.030".
//
// Each district's `current` rules are its current zoning. Density is set
// the way the county's code sets it, one or both of:
//   far                maximum floor area ratio (Maui A-2: 0.9)
//   lot_area_per_unit  lot area required per dwelling unit, sqft (a code
//                      that says "one unit per 3,000 sqft of lot area")
// Leave out a limit the code doesn't set; with neither, the building is
// bounded by height, lot coverage and setbacks alone.
//
// FAR, lot area per unit and lot coverage are schedules: a list of bands by
// lot size (sqft). A flat figure is one band:
//   { bands: [{ upTo: null, inclusive: true, base: 2.0 }], source: "..." }
// A figure that changes with lot size has one band per range, smallest first,
// the last with upTo: null:
//   { bands: [
//       { upTo: 10000, inclusive: false, base: 0.5 },   // lots under 10,000 sqft
//       { upTo: null, inclusive: true, base: 0.4 },     // 10,000 sqft and over
//     ], source: "..." }
// See src/core/schedule.ts for rates (a value that grows with lot size).
//
// Other counties run the current-zoning pathway only. Maui's zones.ts is a
// worked example with FAR.

import type { ZoneRules } from "../../../core/locality";

// every number starts as TODO; the completeness test fails until each is set
const TODO = NaN;

export const zones: Record<string, ZoneRules> = {
  // TODO: copy this entry once per district and rename the key
  "TODO-ZONE": {
    // the district's official name, if the code above is shorthand (optional)
    name: "TODO",
    current: {
      // maximum floor area ratio; delete if the code sets none
      far: { bands: [{ upTo: null, inclusive: true, base: TODO }], source: "TODO" },
      // lot area required per dwelling unit (sqft); delete if the code sets none
      lot_area_per_unit: { bands: [{ upTo: null, inclusive: true, base: TODO }], source: "TODO" },
      // maximum building area as a share of the lot, 0 to 1 (60% = 0.6); 1
      // if the code sets no limit
      lot_coverage: { bands: [{ upTo: null, inclusive: true, base: TODO }], source: "TODO" },
    },
    // ground-floor commercial as a share of lot area, 0 to 1; 0 if the
    // district does not allow ground-floor retail
    commercial_coverage: TODO,
    // optional: an open-space FAR bonus ceiling, if the district has one
    // open_space_far_ceiling: TODO,
    // optional: a share of the lot that must stay open, by FAR
    // open_space: { bands: [...], source: "TODO" },
    // optional: a height step-back ("wedding cake") above a trigger height
    // step_back: { trigger_ft: TODO, above_ft: TODO, ft_per_10ft: TODO },
    // bicycle parking required in this district
    bicycle_required: true,
    // multi-unit dwellings allowed by right
    residential_permitted: true,
    // where the district's rules are
    source: "TODO",
  },
};

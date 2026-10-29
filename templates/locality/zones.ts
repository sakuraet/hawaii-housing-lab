// TEMPLATE: the county's zoning districts that allow multifamily housing.
// One entry per district, keyed by the code exactly as the parcel data writes
// it (for example "A-2"). Fill in every TODO; replace "TODO" sources with the
// code section, for example "MCC 19.12.030".
//
// FAR and lot coverage are schedules: a list of bands by lot size (sqft). A
// flat figure is one band:
//   { bands: [{ upTo: null, inclusive: true, base: 2.0 }], source: "..." }
// A figure that changes with lot size has one band per range, smallest first,
// the last with upTo: null:
//   { bands: [
//       { upTo: 10000, inclusive: false, base: 0.5 },   // lots under 10,000 sqft
//       { upTo: null, inclusive: true, base: 0.4 },     // 10,000 sqft and over
//     ], source: "..." }
// See src/core/schedule.ts for rates (a value that grows with lot size).
//
// Only `bill6` (current zoning) is needed: other counties run that pathway
// only. Honolulu's zones.ts is a full worked example.

import type { ZoneRules } from "../../../core/locality";

// every number starts as TODO; the completeness test fails until each is set
const TODO = NaN;

export const zones: Record<string, ZoneRules> = {
  // TODO: copy this entry once per district and rename the key
  "TODO-ZONE": {
    // the district's official name, if the code above is shorthand (optional)
    name: "TODO",
    far: {
      // maximum floor area ratio under current zoning
      bill6: { bands: [{ upTo: null, inclusive: true, base: TODO }], source: "TODO" },
    },
    lot_coverage: {
      // maximum building area as a share of the lot, 0 to 1 (60% = 0.6)
      bill6: { bands: [{ upTo: null, inclusive: true, base: TODO }], source: "TODO" },
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

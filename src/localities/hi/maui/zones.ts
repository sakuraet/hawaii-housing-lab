// County of Maui: zoning districts that allow multifamily housing by right
// (MCC Title 19, Article II), from the code as published on Municode,
// version of Sep 14, 2026. Only `bill6` (current zoning) is set: other
// counties run that pathway only.
//
// Height is not set here: it varies within a district by community plan
// area (B-2: 90 ft on Maui island, 45 ft in West Maui, Hāna and on Lānaʻi,
// 35 ft on Molokaʻi), so it comes from each parcel's `height`.
//
// Not listed, so a parcel in them stops with an error:
//   B-1, B-CT  no FAR or lot coverage limit (the envelope is set by height
//              and setbacks alone), which the engine cannot run yet. B-1
//              allows dwellings only above or below a business use
//              (MCC 19.16.030); B-CT allows multifamily except on Lānaʻi and
//              Molokaʻi (MCC 19.15.020)
//   SBR        single-family and duplex only (MCC 19.11.020)
//   R, D       single-family and duplex only

import type { ZoneRules } from "../../../core/locality";
import { flat, type Schedule } from "../../../core/schedule";

const MCC_19_12 = "MCC 19.12.050";
const MCC_19_14 = "MCC 19.14.050";

// A-1: 50% FAR on lots under 3 acres, 40% on 3 acres (130,680 sqft) or more
const FAR_A1: Schedule = {
  bands: [
    { upTo: 3 * 43560, inclusive: false, base: 0.5 },
    { upTo: null, inclusive: true, base: 0.4 },
  ],
  source: MCC_19_12,
};

// a district that allows apartments, with no ground-floor retail
function district(
  name: string,
  far: Schedule,
  coverage: number,
  source: string
): ZoneRules {
  return {
    name,
    far: { bill6: far },
    lot_coverage: { bill6: flat(coverage, source) },
    commercial_coverage: 0,
    // Maui does not require bicycle parking (MCC 19.36B)
    bicycle_required: false,
    residential_permitted: true,
    source,
  };
}

export const zones: Record<string, ZoneRules> = {
  // apartment districts (MCC 19.12): apartment houses, townhouses, bungalow
  // and apartment courts (19.12.020)
  "A-1": district("Apartment District A-1", FAR_A1, 0.25, MCC_19_12),
  "A-2": district("Apartment District A-2", flat(0.9, MCC_19_12), 0.35, MCC_19_12),

  // hotel districts (MCC 19.14): any use permitted in the apartment
  // districts (19.14.020(A)). Shops are accessory to hotels only, so no
  // ground-floor retail is modeled
  "H-1": district("Hotel District H-1", flat(0.5, MCC_19_14), 0.25, MCC_19_14),
  "H-M": district("Hotel District H-M", flat(1.0, MCC_19_14), 0.3, MCC_19_14),
  "H-2": district("Hotel District H-2", flat(1.5, MCC_19_14), 0.35, MCC_19_14),
  // the code's table heads this column "H-2 & Hotel"
  Hotel: district("Hotel District", flat(1.5, MCC_19_14), 0.35, MCC_19_14),

  // business districts: multifamily dwellings are a permitted use
  // (19.18.020, 19.20.020). There is no lot coverage limit and no front
  // setback, so coverage is 100%. Retail is allowed but not required; like
  // Honolulu's B-2, no ground-floor retail is assumed
  "B-2": district(
    "B-2 Community Business District",
    flat(2.0, "MCC 19.18.050"),
    1.0,
    "MCC 19.18.020, 19.18.050"
  ),
  "B-3": district(
    "B-3 Central Business District",
    flat(4.0, "MCC 19.20.050"),
    1.0,
    "MCC 19.20.020, 19.20.050"
  ),
};

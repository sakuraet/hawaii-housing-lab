// calc-shared.ts — the Policy Gauge's own parcel data types.
//
// The model (pro forma, pathway rules, inputs/outputs types, feasibility
// verdict) comes from feasim-challenge. What the gauge adds is its
// map data: each parcel's envelope plus where it is (ParcelRow), which
// calcParcel accepts as a parcel.

// the part of oahu the parcel is in
export type Region = "south" | "east" | "north" | "central" | "west";

// One parcel of the gauge's map data (the physical envelope)
export interface ParcelRow {
  /** the county's locality id; Honolulu if unset */
  locality?: string;
  tmk: string;
  zone_class: string;
  lot_sqft: number;
  height: number;
  lat: number;
  lng: number;
  /** Oʻahu only: the part of the island the parcel is in */
  region?: Region;
  /** other counties: the island the parcel is on */
  island?: string;
  address?: string;
  parking_exempt?: boolean;
  // ── TOD pathway only ───────────────────────────────────────────────────
  /** absent = no transit permit available */
  tod_regime?: "pdt" | "ipdt";
  /** § 21-9.100-5(b)(4) */
  slu_urban?: boolean;
  /** PD-T only: parenthetical bonus height from the TOD zoning map */
  tod_map_bonus_height?: number;
  /** key into TOD_PLAN_STANDARDS */
  station_area?: string;
  /** "core" = TOD Precinct (<= 1/4 mi); "tiz" = 1/4 to 1/2 mi */
  tod_precinct?: "core" | "tiz";
}

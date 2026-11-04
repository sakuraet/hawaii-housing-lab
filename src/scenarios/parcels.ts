// The statewide parcel table the scenario layer runs on: one row per parcel
// in any county, with what the scenarios need beyond the engine's Parcel
// (assessed values, what is on the lot now, distance to transit). Rows come
// from a CSV with the columns in PARCEL_COLUMNS; data/sample/parcels.csv is a
// small made-up example. See docs/notes/SCENARIO_LAYER.md.

import { localityIds } from "../localities";
import type { Parcel } from "../parcels";

/** what is on the lot now */
export type ExistingUse =
  | "vacant"
  | "single_family"
  | "multi_family"
  | "commercial"
  | "other";

export const EXISTING_USES: readonly ExistingUse[] = [
  "vacant",
  "single_family",
  "multi_family",
  "commercial",
  "other",
];

/** one parcel of the statewide table */
export interface StatewideParcel {
  /** the county whose rules apply, a locality id such as "hi-maui" */
  locality: string;
  tmk: string;
  lot_sqft: number;
  zone_class: string;
  /** ft; 0 = unknown (the pathway's default) */
  height: number;
  // the rest may be blank in the CSV and are then absent: not known
  /** assessed land value, $ */
  land_value?: number;
  /** assessed value of the buildings on the lot, $ (0 when vacant) */
  building_value?: number;
  existing_use?: ExistingUse;
  /** dwelling units on the lot now */
  existing_units?: number;
  /** miles to the nearest major transit stop */
  transit_distance_mi?: number;
  /** no off-street parking required (Honolulu § 21-6.20(a)) */
  parking_exempt?: boolean;
}

/** the CSV's columns; the first five must be filled in, the rest may be
 *  blank. Other columns are allowed and ignored */
export const PARCEL_COLUMNS = [
  "locality",
  "tmk",
  "lot_sqft",
  "zone_class",
  "height",
  "land_value",
  "building_value",
  "existing_use",
  "existing_units",
  "transit_distance_mi",
  "parking_exempt",
] as const;

/** what a pro forma pays for the lot:
 *  "land"  = the assessed land value, for a vacant or underused lot;
 *  "total" = land and buildings, for a lot whose buildings are torn down
 *            (missing middle on a lot with a house) */
export type LandBasis = "land" | "total";

/** the land cost per sqft of lot the engine takes as `land_cost`, from the
 *  parcel's assessed values. Every calculator multiplies `land_cost` by the
 *  lot area, so this gives the parcel's own price without an engine change.
 *  Undefined when the values needed are not known, so the engine's default
 *  land cost applies */
export function landCostPerSqft(p: StatewideParcel, basis: LandBasis = "land"): number | undefined {
  if (p.land_value === undefined) return undefined;
  if (basis === "land") return p.land_value / p.lot_sqft;
  if (p.building_value === undefined) return undefined;
  return (p.land_value + p.building_value) / p.lot_sqft;
}

/** the engine's Parcel for a row */
export function toParcel(p: StatewideParcel): Parcel {
  const parcel: Parcel = {
    locality: p.locality,
    tmk: p.tmk,
    lot_sqft: p.lot_sqft,
    zone_class: p.zone_class,
    height: p.height,
  };
  if (p.parking_exempt !== undefined) parcel.parking_exempt = p.parking_exempt;
  return parcel;
}

export interface ParcelTable {
  parcels: StatewideParcel[];
  /** rows left out, one line each: "row 12: lot_sqft: must be more than 0" */
  problems: string[];
}

/** Read the parcel CSV. A row with a problem is left out and named in
 *  `problems`, so one bad row does not stop a statewide run. Fields may not
 *  be quoted or contain commas. */
export function parseParcelCsv(text: string): ParcelTable {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "" && !l.startsWith("#"));
  if (lines.length === 0) return { parcels: [], problems: ["no header row"] };

  const header = lines[0].split(",").map((h) => h.trim());
  const missing = PARCEL_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) return { parcels: [], problems: [`header: missing ${missing.join(", ")}`] };
  const col = Object.fromEntries(header.map((h, i) => [h, i])) as Record<string, number>;

  const known = new Set(localityIds());
  const parcels: StatewideParcel[] = [];
  const problems: string[] = [];

  lines.slice(1).forEach((line, i) => {
    // row numbers count the header as row 1, as a spreadsheet does
    const row = `row ${i + 2}`;
    if (line.includes('"')) {
      problems.push(`${row}: quoted fields are not supported`);
      return;
    }
    const cells = line.split(",").map((c) => c.trim());
    if (cells.length !== header.length) {
      problems.push(`${row}: ${cells.length} fields, the header has ${header.length}`);
      return;
    }
    const cell = (name: (typeof PARCEL_COLUMNS)[number]) => cells[col[name]];
    const errors: string[] = [];

    const num = (name: (typeof PARCEL_COLUMNS)[number], min: number, strict: boolean) => {
      const raw = cell(name);
      const v = Number(raw);
      if (raw === "" || !Number.isFinite(v)) errors.push(`${name}: "${raw}" is not a number`);
      else if (strict ? v <= min : v < min)
        errors.push(`${name}: must be ${strict ? "more than" : "at least"} ${min}`);
      return v;
    };
    // a column that may be left blank: undefined when it is
    const optional = (name: (typeof PARCEL_COLUMNS)[number]) =>
      cell(name) === "" ? undefined : num(name, 0, false);

    const locality = cell("locality");
    if (!known.has(locality)) errors.push(`locality: unknown "${locality}"`);
    const tmk = cell("tmk");
    if (tmk === "") errors.push("tmk: missing");
    const zone_class = cell("zone_class");
    if (zone_class === "") errors.push("zone_class: missing");
    const lot_sqft = num("lot_sqft", 0, true);
    const height = num("height", 0, false);
    const land_value = optional("land_value");
    const building_value = optional("building_value");
    const existing_units = optional("existing_units");
    if (existing_units !== undefined && Number.isFinite(existing_units) && !Number.isInteger(existing_units))
      errors.push("existing_units: must be a whole number");
    const use = cell("existing_use");
    const existing_use = use === "" ? undefined : (use as ExistingUse);
    if (existing_use !== undefined && !EXISTING_USES.includes(existing_use))
      errors.push(`existing_use: "${use}" is not one of ${EXISTING_USES.join(", ")}`);
    const transit_distance_mi = optional("transit_distance_mi");
    let parking_exempt: boolean | undefined;
    const exempt = cell("parking_exempt");
    if (exempt === "true") parking_exempt = true;
    else if (exempt === "false") parking_exempt = false;
    else if (exempt !== "") errors.push(`parking_exempt: "${exempt}" is not true, false or blank`);

    if (errors.length > 0) {
      problems.push(...errors.map((e) => `${row}: ${e}`));
      return;
    }
    const p: StatewideParcel = { locality, tmk, lot_sqft, zone_class, height };
    if (land_value !== undefined) p.land_value = land_value;
    if (building_value !== undefined) p.building_value = building_value;
    if (existing_use !== undefined) p.existing_use = existing_use;
    if (existing_units !== undefined) p.existing_units = existing_units;
    if (transit_distance_mi !== undefined) p.transit_distance_mi = transit_distance_mi;
    if (parking_exempt !== undefined) p.parking_exempt = parking_exempt;
    parcels.push(p);
  });

  return { parcels, problems };
}

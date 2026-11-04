// Runs the parcel table through the engine on current zoning: each parcel's
// result, or why it was not run, and totals by county. The scenarios build on
// this; see docs/notes/SCENARIO_LAYER.md.

import type { ParcelOutput, SliderInputs } from "../calculations";
import { zoneKey } from "../core/zoning";
import { overallLevel, type Level } from "../feasibility";
import { getLocality } from "../localities";
import { calcParcel } from "../parcels";
import { landCostPerSqft, toParcel, type LandBasis, type StatewideParcel } from "./parcels";

/** run: the engine ran; not_modeled: the zone has no rules in the county's
 *  config, or does not allow multi-family housing; error: the engine
 *  stopped (a config gap to fix) */
export type RunStatus = "run" | "not_modeled" | "error";

export interface ParcelRun {
  tmk: string;
  locality: string;
  /** the zone as the parcel table writes it */
  zone_label: string;
  /** the config's zone it was matched to (zoneKey) */
  zone_class: string;
  status: RunStatus;
  /** why it was not run, or the engine's error */
  reason?: string;
  /** "assessed" = the parcel's own land value; "default" = the engine's
   *  default land cost, used where the value is not known */
  land_cost_source: "assessed" | "default";
  output?: ParcelOutput;
  /** the feasibility verdict on the output */
  level?: Level;
}

export interface RunOptions {
  /** levers for every parcel, on top of the pathway defaults */
  levers?: Partial<SliderInputs>;
  /** which assessed values make the land cost; default "land" */
  land_basis?: LandBasis;
}

/** one parcel on current zoning */
export function runParcel(p: StatewideParcel, opts: RunOptions = {}): ParcelRun {
  const loc = getLocality(p.locality);
  const zone_class = zoneKey(loc, p.zone_class);
  const land_cost = landCostPerSqft(p, opts.land_basis);
  const run: ParcelRun = {
    tmk: p.tmk,
    locality: p.locality,
    zone_label: p.zone_class,
    zone_class,
    status: "run",
    land_cost_source: land_cost === undefined ? "default" : "assessed",
  };
  const zone = loc.rules.zones[zone_class];
  if (!zone) return { ...run, status: "not_modeled", reason: `no rules for zone "${p.zone_class}"` };
  if (!zone.residential_permitted)
    return { ...run, status: "not_modeled", reason: `multi-family housing is not permitted in ${zone_class}` };
  try {
    const levers = land_cost === undefined ? opts.levers : { ...opts.levers, land_cost };
    const output = calcParcel("current", { ...toParcel(p), zone_class }, levers);
    return { ...run, output, level: overallLevel(output) };
  } catch (e) {
    return { ...run, status: "error", reason: e instanceof Error ? e.message : String(e) };
  }
}

/** every parcel on current zoning */
export function runParcels(parcels: StatewideParcel[], opts: RunOptions = {}): ParcelRun[] {
  return parcels.map((p) => runParcel(p, opts));
}

/** a county's totals */
export interface RunSummary {
  locality: string;
  parcels: number;
  run: number;
  not_modeled: number;
  error: number;
  /** parcels run on the engine's default land cost */
  default_land_cost: number;
  /** units the run parcels could hold under current zoning */
  units: number;
  /** units on parcels whose verdict is "strong" */
  strong_units: number;
}

/** totals by county, in the order counties first appear */
export function summarizeRuns(runs: ParcelRun[]): RunSummary[] {
  const by = new Map<string, RunSummary>();
  for (const r of runs) {
    let s = by.get(r.locality);
    if (!s) {
      s = {
        locality: r.locality,
        parcels: 0,
        run: 0,
        not_modeled: 0,
        error: 0,
        default_land_cost: 0,
        units: 0,
        strong_units: 0,
      };
      by.set(r.locality, s);
    }
    s.parcels += 1;
    s[r.status] += 1;
    if (r.status !== "run" || !r.output) continue;
    if (r.land_cost_source === "default") s.default_land_cost += 1;
    s.units += r.output.max_units;
    if (r.level === "strong") s.strong_units += r.output.max_units;
  }
  return [...by.values()];
}

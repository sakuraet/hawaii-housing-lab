// default lever values for each scenario. Kept apart from levers.ts (which
// has React hooks).

import {
  countyLeverDefaults,
  pathwayEnvelope,
  scenarioOf,
  scenarioSetup,
  type ScenarioId,
  type Envelope,
  type ProgramId,
  type SliderInputs,
} from "feasim-challenge";

import type { ParcelRow } from "@/lib/parcels";

// the model's levers, plus the two the citywide view adds: changes to each
// parcel's own height (ft) and FAR, in place of one value for every parcel
export interface GaugeInputs extends SliderInputs {
  /** the scenario the levers start from; it picks the pathway (`program`) */
  scenario?: ScenarioId;
  height_delta?: number;
  far_delta?: number;
}

// Honolulu's two pathways the scenarios run: Standard (bill6, current zoning,
// the baseline) and TOD. The tool starts every scenario from one of them;
// Bill 7, 201H and the pre-Ord. 26-7 rules stay in the engine but aren't in
// the tool

export const BILL6_DEFAULTS: GaugeInputs = {
  program: "bill6",
  scenario: "baseline",
  height_delta: 0,
  far_delta: 0,
  unit_type: "studio50_1br50",
  affordable_ami: "ami_80",
  market_ami: "ami_120",
  include_retail: false,
  retail_rent: 5,
  retail_share: 0.1,
  hard_cost_per_sqft: 450,
  // the original model's; each county's own default replaces it (defaultsFor)
  land_cost: 130,
  opex_ratio: 0.3,
  waivable_fee_basis: "market_units",
  park: "in_lieu",
  setback: 10,
  parking_ratio: 0.95,
  // every development fee at today's level; the fee scenario lowers it
  fee_scale: 1,
  permitting_months: 18,
  const_months: 12,
  leaseup_months: 9,
  equity: 0.3,
  permanent_rate: 0.0675,
  hold_years: 8,
  amort_years: 30,
  min_dscr: 1.2,
  target_return: 0.115,
};

const TOD_DEFAULTS: GaugeInputs = {
  ...BILL6_DEFAULTS,
  program: "tod",
  floor_height: 10,
  parking_ratio: 0.85,
};

export const PROGRAM_DEFAULTS: Record<string, GaugeInputs> = {
  bill6: BILL6_DEFAULTS,
  tod: TOD_DEFAULTS,
};

/**
 * a scenario's lever defaults in a county: the pathway it runs (Honolulu's
 * Standard or TOD), the county's own lever defaults (land: Honolulu $170, Maui
 * $75, Hawaiʻi $55, Kauaʻi $50; Maui's unit mix), outside Honolulu no fixed
 * parking (the county's legal minimum applies, which follows the unit mix),
 * then the scenario's own levers (parking 0.5, fees halved)
 */
export function defaultsFor(scenario: string, county?: string): GaugeInputs {
  const { id } = scenarioOf(scenario);
  const setup = scenarioSetup(id, county);
  const base = PROGRAM_DEFAULTS[setup.pathway] ?? BILL6_DEFAULTS;
  const local =
    county === undefined || county === "hi-honolulu"
      ? countyLeverDefaults("hi-honolulu")
      : { ...countyLeverDefaults(county), parking_ratio: undefined };
  return { ...base, ...local, ...setup.levers, scenario: id };
}

// TOD parcels with no housing or no recorded height have no limit to change
const hasNoLimits = (envelope: Envelope) =>
  envelope.status === "not_applicable" || envelope.status === "not_modeled";

/** the FAR the pathway gives a parcel, with the Max FAR lever's change */
export const maxFarFor = (envelope: Envelope, far_delta = 0) =>
  hasNoLimits(envelope)
    ? envelope.max_far
    : Math.max(0, envelope.max_far + far_delta);

/**
 * the model's levers for one parcel: the height and FAR changes applied to its
 * own limits, which stop at 0
 */
export function parcelLevers(
  pathway: ProgramId,
  parcel: ParcelRow,
  inputs: GaugeInputs,
  opts: Parameters<typeof pathwayEnvelope>[2] = {}
): SliderInputs {
  const { height_delta = 0, far_delta = 0, ...levers } = inputs;
  if (height_delta === 0 && far_delta === 0) return levers;
  const envelope = pathwayEnvelope(pathway, parcel, opts);
  if (hasNoLimits(envelope)) return levers;
  return {
    ...levers,
    ...(height_delta !== 0 && {
      height_limit: Math.max(0, envelope.height_limit + height_delta),
    }),
    ...(far_delta !== 0 && { max_far: maxFarFor(envelope, far_delta) }),
  };
}

// An unknown program falls back to Bill 6, Honolulu's baseline pathway.
const PATHWAYS: string[] = ["bill6", "tod"];
export const pathwayOf = (program: string): ProgramId =>
  PATHWAYS.includes(program) ? (program as ProgramId) : "bill6";

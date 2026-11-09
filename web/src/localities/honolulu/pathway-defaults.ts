// default lever values for each pathway. Kept apart from levers.ts (which
// has React hooks) so the server pages can read them for project links.

import {
  pathwayEnvelope,
  type Envelope,
  type ProgramId,
  type SliderInputs,
} from "feasim-challenge";

import type { ParcelRow } from "@/lib/parcels";

// the model's levers, plus the two the citywide view adds: changes to each
// parcel's own height (ft) and FAR, in place of one value for every parcel
export interface GaugeInputs extends SliderInputs {
  height_delta?: number;
  far_delta?: number;
}

// each program only lists the sliders it uses

const BILL7_DEFAULTS: GaugeInputs = {
  program: "bill7",
  height_delta: 0,
  far_delta: 0,
  // revenue
  unit_type: "studio50_1br50",
  affordable_ami: "ami_80",
  market_ami: "ami_100",
  include_retail: false,
  retail_rent: 3,
  retail_share: 0.1,
  building_area_per_unit: 800,
  // grants
  grant_type: "post_construct",
  grant_amount: 12000,
  // costs
  hard_cost_per_sqft: 450,
  land_cost: 130,
  opex_ratio: 0.19,
  waivable_fee_basis: "none",
  park: "exempt",
  setback: 10,
  parking_ratio: 0.5,
  // timing
  permitting_months: 18,
  const_months: 12,
  leaseup_months: 9,
  // finance
  equity: 0.3,
  permanent_rate: 0.07,
  hold_years: 10,
  amort_years: 30,
  min_dscr: 1.15,
  target_return: 0.115,
};

const STANDARD_DEFAULTS: GaugeInputs = {
  program: "standard",
  height_delta: 0,
  far_delta: 0,
  unit_type: "studio50_1br50",
  affordable_ami: "ami_80",
  market_ami: "ami_120",
  include_retail: false,
  retail_rent: 5,
  retail_share: 0.1,
  hard_cost_per_sqft: 450,
  land_cost: 130,
  opex_ratio: 0.3,
  waivable_fee_basis: "market_units",
  park: "in_lieu",
  setback: 10,
  parking_ratio: 0.95,
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
  ...STANDARD_DEFAULTS,
  program: "tod",
  floor_height: 10,
  parking_ratio: 0.85,
};

const H201_DEFAULTS: GaugeInputs = {
  ...STANDARD_DEFAULTS,
  program: "h201",
  affordable_ami: "ami_80",
  market_ami: "ami_120",
  // 201H projects are GET-exempt, so opex matches Bill 7
  opex_ratio: 0.19,
  affordability: 0.51,
};

export const BILL6_DEFAULTS: GaugeInputs = {
  ...STANDARD_DEFAULTS,
  program: "bill6",
};

export const PROGRAM_DEFAULTS: Record<string, GaugeInputs> = {
  bill6: BILL6_DEFAULTS,
  bill7: BILL7_DEFAULTS,
  standard: STANDARD_DEFAULTS,
  tod: TOD_DEFAULTS,
  h201: H201_DEFAULTS,
};

export const defaultsFor = (program: string) =>
  PROGRAM_DEFAULTS[program] ?? BILL6_DEFAULTS;

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

// An unknown program falls back to Bill 6 (shown as "Standard"), the pathway
// the gauge opens on.
const PATHWAYS: string[] = ["bill6", "bill7", "standard", "tod", "h201"];
export const pathwayOf = (program: string): ProgramId =>
  PATHWAYS.includes(program) ? (program as ProgramId) : "bill6";

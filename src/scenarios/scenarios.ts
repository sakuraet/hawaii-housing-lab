// The four scenarios the tool and the statewide runs compare: the baseline
// and the three benchmark policies the challenge asks for. A scenario says,
// for a county, which pathway the engine runs and which levers it starts
// from; a lever the user sets still wins. See docs/notes/SCENARIO_LAYER.md.
//
// In Honolulu the baseline is the Standard pathway (bill6, which is current
// zoning there) and TOD is Honolulu's own TOD pathway (PD-T / IPD-T). Every
// other county runs its current zoning. Bill 7, 201H and the pre-Ord. 26-7
// rules stay in the engine but are not scenarios.

import type { ProgramId, SliderInputs } from "../calculations";
import type { TodTier } from "../parcels";

export type ScenarioId = "baseline" | "tod" | "parking" | "fees";

/** what a scenario runs in one county */
export interface ScenarioSetup {
  /** the engine pathway */
  pathway: ProgramId;
  /** levers the scenario sets, on top of the pathway defaults */
  levers: Partial<SliderInputs>;
  /** TOD only: the permit tier it starts at */
  tod_tier?: TodTier;
  /** false: not defined for this county yet, so it runs the baseline */
  available: boolean;
  /** why it isn't available, or what is still a draft */
  note?: string;
}

export interface Scenario {
  id: ScenarioId;
  /** the button label */
  label: string;
  /** what it changes, for a policymaker */
  description: string;
  setup(locality: string): ScenarioSetup;
}

const HONOLULU = "hi-honolulu";
const isHonolulu = (locality?: string) => (locality ?? HONOLULU) === HONOLULU;

/** the baseline pathway: Honolulu's Standard pathway, current zoning elsewhere */
export const baselinePathway = (locality?: string): ProgramId =>
  isHonolulu(locality) ? "bill6" : "current";

// Draft scenario settings, to be decided (see SCENARIO_LAYER.md, "Decisions
// to make"). Each is a lever value, so the tool's lever can still move it.

/** parking: minimums removed, so developers build what the market wants;
 *  stalls per unit, every county. Draft */
export const SCENARIO_PARKING_RATIO = 0.5;

/** TOD: the permit tier, in PD-T and IPD-T districts alike. Approval is the
 *  full bonus; Base is the underlying zoning, so it would change no policy */
export const SCENARIO_TOD_TIER: TodTier = "with_benefits";

/** fees: every development fee times this. Draft (half, as the design's
 *  "Hawaiʻi fees" version) */
export const SCENARIO_FEE_SCALE = 0.5;

/** the challenge's comparability assumption: development fees total
 *  $50,000 per unit. It is a fee source, not a scenario: set as the
 *  `fee_per_unit` lever on the baseline and the fee scenario alike, so the
 *  scenario's 50% cut is $25,000 per unit. Unset, every county's own fee
 *  schedules apply (about $19,000 to $33,000 per unit) */
export const BENCHMARK_FEE_PER_UNIT = 50000;

export type FeeSource = "county" | "benchmark";

/** the levers a fee source sets, for any scenario */
export const feeSourceLevers = (source: FeeSource): Partial<SliderInputs> =>
  source === "benchmark" ? { fee_per_unit: BENCHMARK_FEE_PER_UNIT } : {};

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "baseline",
    label: "Baseline",
    description:
      "Today's zoning and fees in each county. In Honolulu, the Standard Development Pathway (Ord. 26-7).",
    setup: (locality) => ({ pathway: baselinePathway(locality), levers: {}, available: true }),
  },
  {
    id: "tod",
    label: "TOD",
    description:
      "More height and density near frequent transit. In Honolulu, the city's TOD rules around rail stations, at full approval (PD-T and IPD-T).",
    setup: (locality) =>
      isHonolulu(locality)
        ? {
            pathway: "tod",
            levers: {},
            tod_tier: SCENARIO_TOD_TIER,
            available: true,
            note: "Approval needs a 20,000 sq ft lot; smaller lots keep their zoning, which bars most housing on industrial land. Community benefits are not priced.",
          }
        : {
            pathway: baselinePathway(locality),
            levers: {},
            available: false,
            note: "Needs each parcel's distance to a frequent bus stop; runs the baseline until then.",
          },
  },
  {
    id: "parking",
    label: "Parking",
    description:
      "No parking minimums: developers build the parking the market wants, assumed here to be 0.5 stalls per unit (draft).",
    setup: (locality) => ({
      pathway: baselinePathway(locality),
      levers: { parking_ratio: SCENARIO_PARKING_RATIO },
      available: true,
      note: "Draft: the market parking ratio is a placeholder.",
    }),
  },
  {
    id: "fees",
    label: "Developer Fees",
    description:
      "Development fees cut in half: permits, plan review, sewer, water, park dedication, grading and the rest. On each county's own fees, or on the challenge's $50,000 per unit (so $25,000).",
    setup: (locality) => ({
      pathway: baselinePathway(locality),
      levers: { fee_scale: SCENARIO_FEE_SCALE },
      available: true,
      note: "The cut is the challenge's 50%.",
    }),
  },
];

export const DEFAULT_SCENARIO: ScenarioId = "baseline";

/** a scenario by id; an unknown id is the baseline */
export const scenarioOf = (id: string): Scenario =>
  SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];

/** a scenario's pathway and levers in a county */
export const scenarioSetup = (id: string, locality?: string): ScenarioSetup =>
  scenarioOf(id).setup(locality ?? HONOLULU);

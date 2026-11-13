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

export type ScenarioId = "baseline" | "tod" | "parking" | "fees";

/** what a scenario runs in one county */
export interface ScenarioSetup {
  /** the engine pathway */
  pathway: ProgramId;
  /** levers the scenario sets, on top of the pathway defaults */
  levers: Partial<SliderInputs>;
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

/** fees: every development fee times this. Draft (half, as the design's
 *  "Hawaiʻi fees" version) */
export const SCENARIO_FEE_SCALE = 0.5;

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
      "More height and density near frequent transit. In Honolulu, the city's TOD rules (PD-T and IPD-T) around rail stations.",
    setup: (locality) =>
      isHonolulu(locality)
        ? { pathway: "tod", levers: {}, available: true }
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
      "Development fees cut in half: permits, plan review, sewer, water, park dedication, grading and the rest (draft).",
    setup: (locality) => ({
      pathway: baselinePathway(locality),
      levers: { fee_scale: SCENARIO_FEE_SCALE },
      available: true,
      note: "Draft: the size of the cut is a placeholder.",
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

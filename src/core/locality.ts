// The form every place fills out. A Locality is whoever zones the parcel (a
// county in Hawaiʻi, a city or county elsewhere); a StateRules holds what
// state law and statewide agencies set. The engine reads rules and
// assumptions from these objects instead of hard-coding them, so adding a
// county means writing a new config, not changing the engine.
//
// Rules are law or published schedules, each with a source. Assumptions are
// estimates we chose, kept apart so they can be varied in sensitivity runs.
// Values that are the same everywhere (finance terms, BTC construction
// factors) stay in the engine. See docs/notes/VARIABLE_CLASSIFICATION.md.

import type { Schedule } from "./schedule";

/** a pathway's program id; matches ProgramId in calculations/calc-shared.
 *  "current" is current zoning in any county; "bill6" is Honolulu's name for
 *  its current zoning (Ord. 26-7), and the two run the same there */
export type PathwayId = "current" | "bill6" | "standard" | "bill7" | "tod" | "h201";

/** height step-back ("wedding cake") above a trigger height */
export interface StepBackRule {
  trigger_ft: number;
  above_ft: number;
  ft_per_10ft: number;
  /** applies to the front yard too, not only side and rear */
  front?: boolean;
}

// ── zoning ──────────────────────────────────────────────────────────────

/** minimum yards (ft) */
export interface YardRules {
  front_ft: number;
  rear_ft: number;
  side_ft: number;
  /** side yard added for each story above the first (Hawaiʻi County RM: 2) */
  side_ft_per_added_story?: number;
  /** side and rear yards are at least this share of the building's height,
   *  where that is more (Kauaʻi residential: 1/2) */
  side_rear_height_fraction?: number;
}

/** a district's current zoning, in whichever terms its code sets density.
 *  A limit the code doesn't set is left out: a district with neither `far`
 *  nor `lot_area_per_unit` is bounded by height, coverage and setbacks only */
export interface CurrentZoningRules {
  /** maximum floor area ratio, by lot size (Maui A-2: 0.9) */
  far?: Schedule;
  /** lot area required per dwelling unit (sqft), by lot size; the unit
   *  count is the lot area over this, rounded down (see units_round_up_at) */
  lot_area_per_unit?: Schedule;
  /** a fractional unit at or above this share counts as a whole unit
   *  (Kauaʻi: 0.65); absent = always rounded down */
  units_round_up_at?: number;
  /** maximum building area as a share of the lot, by lot size; 1 where the
   *  code sets no limit */
  lot_coverage: Schedule;
  /** minimum yards; absent = the setback lever (10 ft unless set) */
  yards?: YardRules;
  /** housing parking minimum in this zone, stalls per unit, in place of the
   *  locality's (Hawaiʻi County CDH: 1) */
  residential_stalls_per_unit?: number;
}

/** one zoning district's rules */
export interface ZoneRules {
  /** the official district name, where the code is shorthand */
  name?: string;
  /** current zoning; every county but Honolulu sets it. Honolulu's comes
   *  from `far.bill6` and `lot_coverage.bill6` instead */
  current?: CurrentZoningRules;
  /** FAR by Honolulu pathway, as a function of lot size. A pathway not
   *  listed either sets its own FAR whatever the zone (Bill 7's statutory
   *  4.0) or has no FAR in this zone (0) */
  far?: Partial<Record<PathwayId, Schedule>>;
  /** maximum building area as a share of the lot, by Honolulu pathway */
  lot_coverage?: Partial<Record<PathwayId, Schedule>>;
  /** ground-floor commercial as a share of lot area; 0 = not permitted */
  commercial_coverage: number;
  /** open-space bonus FAR ceiling; absent = no bonus */
  open_space_far_ceiling?: number;
  /** required open space as a share of the lot, by FAR (special districts) */
  open_space?: Schedule;
  step_back?: StepBackRule;
  /** bicycle parking required in this district */
  bicycle_required: boolean;
  /** multi-unit dwellings allowed by right */
  residential_permitted: boolean;
  source: string;
}

// ── parking, loading and bicycle parking ────────────────────────────────

export interface ParkingRules {
  // the housing minimum is one of these two, whichever the code uses
  /** minimum stalls: 1 per this many sqft of private dwelling area (Honolulu) */
  residential_sqft_per_stall?: number;
  /** minimum stalls per dwelling unit, whatever its size (Maui: 2) */
  residential_stalls_per_unit?: number;
  /** a fraction of a stall always rounds up (Hawaiʻi County); otherwise
   *  0.5 or more rounds up (Honolulu) */
  round_up?: boolean;
  /** minimum stalls: 1 per this many sqft of retail */
  retail_sqft_per_stall: number;
  /** share of the summed requirement when housing and retail share stalls */
  joint_use: number;
  source: string;
}

export interface LoadingRules {
  /** lots of this size or less need no loading space */
  min_lot_sqft: number;
  /** spaces required, by number of dwelling units */
  multifamily_spaces: Schedule;
  /** spaces required, by retail floor area */
  retail_spaces: Schedule;
  small_space_sqft: number;
  large_space_sqft: number;
  source: string;
}

export interface BicycleTerm {
  units_per_space: number;
  retail_sqft_per_space: number;
  stalls_per_space: number;
}

export interface BicycleRules {
  short_term: BicycleTerm;
  long_term: BicycleTerm;
  sqft_per_space: number;
  source: string;
}

// ── fees ────────────────────────────────────────────────────────────────

export interface FeeRules {
  /** building permit fee for one unit, by construction value */
  building_permit: Schedule;
  /** plan review fee, by building permit fee */
  plan_review: Schedule;
  environmental: { ea: number; eis: number };
  temp_occupancy_cert: number;
  /** erosion and sediment control plan */
  escp: number;
  /** utility permits, per unit */
  installation_trench: number;
  service_connection: number;
  /** site permits, by lot area (grubbing) or cubic yards (grading, stockpiling) */
  grubbing: Schedule;
  grading: Schedule;
  stockpiling: Schedule;
  wastewater: {
    charge_per_esdu: number;
    /** ESDU per unit, by number of units in the project */
    esdu_per_unit: Schedule;
  };
  park_dedication: {
    sqft_per_unit: number;
    /** units not counted, for example the first 3 (Maui); default 0 */
    exempt_units?: number;
    floor_area_fraction: number;
    application_fee: { exempt: number; in_lieu: number };
  };
  /** school impact fee per dwelling (a state assessment, HRS Ch. 302A) */
  school_impact_per_unit: number;
  source: string;
}

export interface WaterRules {
  /** water system facilities charge per fixture unit, or per demand unit
   *  where `demand_per_unit` is set */
  wsfc_per_fu: { low_rise: number; high_rise: number };
  /** demand units per dwelling by unit type (studio, one_bb, ...), used in
   *  place of the fixture-unit count where the charge is by projected use
   *  (Maui: equivalent single dwellings) */
  demand_per_unit?: Record<string, number>;
  /** living stories at or below which the low-rise rate applies */
  low_rise_max_stories: number;
  min_fu: number;
  /** most affordable units whose charge can be waived, per project */
  waiver_unit_cap: number;
  /** fire service connection charge by meter size (inches) */
  fire_meter_charge: Record<string, number>;
  source: string;
}

// ── required affordable units ───────────────────────────────────────────

/** a set-aside every project of some size must provide under current
 *  zoning (Maui: residential workforce housing, MCC 2.96) */
export interface InclusionaryRules {
  /** projects with at least this many units must comply */
  min_units: number;
  /** required units as a share of the market-rate units, rounded up */
  share_of_market: number;
  /** rental units' AMI caps (%), one equal share each; each unit rents at
   *  the top of its band */
  rent_ami: number[];
  source: string;
}

// ── assumptions ─────────────────────────────────────────────────────────

/** per-zone estimates: how deep projects dig */
export interface ZoneAssumptions {
  excavation_depth_ft: number;
}

/** how long projects take in this place, every zone and pathway */
export interface TimingAssumptions {
  permitting_months: number;
  construction_months: number;
}

/** market estimates that can differ by place */
export interface MarketAssumptions {
  /** market cap rate */
  cap_rate: number;
  vacancy: { residential: number; retail: number };
  /** annual construction cost escalation, as a multiplier (1.056 = 5.6%) */
  cost_inflation: number;
  /** annual AMI growth, as a multiplier */
  ami_escalation: number;
  annual_rent_growth: number;
  annual_opex_growth: number;
  annual_assessment_growth: number;
  parking: {
    stall_sqft: number;
    cost_per_sqft: number;
    surface_stall_sqft: number;
    surface_cost_per_sqft: number;
    monthly_rent_per_stall: number;
  };
  source: string;
}

// ── the forms ───────────────────────────────────────────────────────────

/** what state law and statewide agencies set */
export interface StateRules {
  /** two-letter state code, for example "hi" */
  id: string;
  name: string;
  /** affordable rent as a share of household income (HHFDC: 30%) */
  affordable_rent_income_share: number;
  /** HRS 201H: affordable share of units must be more than this */
  h201_min_affordable_frac: number;
  source: string;
}

/** whoever zones the parcel: a county in Hawaiʻi */
export interface Locality {
  /** state code + place, for example "hi-honolulu" */
  id: string;
  name: string;
  state: StateRules;
  /** pathways this place has; every place has "current", Honolulu all six */
  pathways: PathwayId[];
  /** what a zone missing from `rules.zones` gets: "fallback" keeps the
   *  original model's behavior (no FAR, 60% coverage) and is for Honolulu;
   *  "error" stops the run, so a missing rule is noticed in a new county */
  unknown_zone: "fallback" | "error";

  rules: {
    zones: Record<string, ZoneRules>;
    parking: ParkingRules;
    loading: LoadingRules;
    bicycle: BicycleRules;
    fees: FeeRules;
    water: WaterRules;
    /** real property tax, share of assessed value per year */
    property_tax_rate: number;
    /** income limits by AMI % (10–140), each a row for household sizes 1–8 */
    income_limits: Record<number, number[]>;
    /** affordable units every project must provide; absent = none (Honolulu) */
    inclusionary?: InclusionaryRules;
  };

  assumptions: {
    /** permitting and construction months; a slider setting overrides them */
    timing: TimingAssumptions;
    zones: Record<string, ZoneAssumptions>;
    /** used for a zone with no entry in `zones` */
    default_zone: ZoneAssumptions;
    market: MarketAssumptions;
  };
}

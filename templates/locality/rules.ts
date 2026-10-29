// TEMPLATE: the county's parking, loading, bicycle parking, fees, water
// charges, property tax and income limits. Every value is law or a published
// schedule; replace each "TODO" source with where it comes from. Honolulu's
// rules.ts is a full worked example.

import type {
  BicycleRules,
  FeeRules,
  LoadingRules,
  ParkingRules,
  WaterRules,
} from "../../../core/locality";
import type { Schedule } from "../../../core/schedule";

// every number starts as TODO; the completeness test fails until each is set
const TODO = NaN;

// a one-value schedule to start from; replace with bands if the figure
// changes with the quantity (see zones.ts)
const todoSchedule = (): Schedule => ({
  bands: [{ upTo: null, inclusive: true, base: TODO }],
  source: "TODO",
});

// ── parking, loading and bicycle parking ────────────────────────────────

export const parking: ParkingRules = {
  // housing minimum: set the one the code uses and delete the other
  // 1 stall per this many sqft of dwelling area (Honolulu: 1,000)
  residential_sqft_per_stall: TODO,
  // stalls per dwelling unit, whatever its size (Maui: 2)
  residential_stalls_per_unit: TODO,
  // minimum stalls: 1 per this many sqft of retail
  retail_sqft_per_stall: TODO,
  // share of the summed requirement when housing and retail share stalls; 1
  // if the code has no joint-use reduction
  joint_use: TODO,
  source: "TODO",
};

export const loading: LoadingRules = {
  // lots of this size or less need no loading space
  min_lot_sqft: TODO,
  // spaces required by number of dwelling units
  multifamily_spaces: todoSchedule(),
  // spaces required by retail floor area (sqft)
  retail_spaces: todoSchedule(),
  // area of one small and one large loading space (sqft)
  small_space_sqft: TODO,
  large_space_sqft: TODO,
  source: "TODO",
};

export const bicycle: BicycleRules = {
  short_term: { units_per_space: TODO, retail_sqft_per_space: TODO, stalls_per_space: TODO },
  long_term: { units_per_space: TODO, retail_sqft_per_space: TODO, stalls_per_space: TODO },
  // area of one bicycle space (sqft)
  sqft_per_space: TODO,
  source: "TODO",
};

// ── fees ────────────────────────────────────────────────────────────────

export const fees: FeeRules = {
  // building permit fee for one unit, by construction value ($)
  building_permit: todoSchedule(),
  // plan review fee, by the building permit fee ($); can have a min and max
  plan_review: todoSchedule(),
  // environmental assessment and impact statement fees
  environmental: { ea: TODO, eis: TODO },
  temp_occupancy_cert: TODO,
  // erosion and sediment control plan
  escp: TODO,
  // utility permits, per unit
  installation_trench: TODO,
  service_connection: TODO,
  // grubbing by lot area (sqft); grading and stockpiling by cubic yards
  grubbing: todoSchedule(),
  grading: todoSchedule(),
  stockpiling: todoSchedule(),
  wastewater: {
    // charge per equivalent single-family dwelling unit (ESDU)
    charge_per_esdu: TODO,
    // ESDU per unit, by the number of units in the project
    esdu_per_unit: todoSchedule(),
  },
  park_dedication: {
    // land required: the lesser of this many sqft per unit ...
    sqft_per_unit: TODO,
    // ... and this share of floor area
    floor_area_fraction: TODO,
    // application fee when exempt, and when paying in lieu
    application_fee: { exempt: TODO, in_lieu: TODO },
  },
  // school impact fee per unit (HRS Ch. 302A); Honolulu's config uses 0
  school_impact_per_unit: TODO,
  source: "TODO",
};

// ── water ───────────────────────────────────────────────────────────────

export const water: WaterRules = {
  // water system facilities charge per fixture unit
  wsfc_per_fu: { low_rise: TODO, high_rise: TODO },
  // living stories at or below which the low-rise rate applies
  low_rise_max_stories: TODO,
  // minimum fixture units per application
  min_fu: TODO,
  // most affordable units whose charge can be waived, per project
  waiver_unit_cap: TODO,
  // new meter (fire service connection) charge by meter size, inches; the
  // model uses "4", "6" and "8"
  fire_meter_charge: { "4": TODO, "6": TODO, "8": TODO },
  source: "TODO",
};

// ── property tax and income limits ──────────────────────────────────────

// residential real property tax, share of assessed value per year (0.35% = 0.0035)
export const property_tax_rate = TODO;

// HHFDC income limits for this county by AMI %, household sizes 1–8
// TODO: the current year's HHFDC table for the county
export const income_limits: Record<number, number[]> = Object.fromEntries(
  [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140].map((ami) => [
    ami,
    [TODO, TODO, TODO, TODO, TODO, TODO, TODO, TODO],
  ])
);

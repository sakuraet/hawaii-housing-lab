// County of Maui: estimates we chose (not law). Where no Maui figure has
// been found, the value is Honolulu's, marked "Honolulu's" below, so the
// model runs; each is a choice to revisit (see docs/notes/MAUI.md). AMI growth
// and hold-period rent growth are Maui's own.

import type {
  LeverDefaults,
  MarketAssumptions,
  TimingAssumptions,
  ZoneAssumptions,
} from "../../../core/locality";

// permitting and construction months, every zone; a slider setting
// overrides them. Honolulu's
export const timing: TimingAssumptions = {
  permitting_months: 18,
  construction_months: 12,
};

// excavation depth (ft) by zone; assumed, not from the code. Honolulu's
// depths for districts of like density
const zone = (excavation_depth_ft: number): ZoneAssumptions => ({ excavation_depth_ft });

export const default_zone = zone(4);

export const zones: Record<string, ZoneAssumptions> = {
  // low density (FAR 0.5 or less)
  "A-1": zone(3),
  "H-1": zone(3),
  // medium density (FAR 0.9 to 2.0)
  "A-2": zone(5),
  "H-M": zone(5),
  "H-2": zone(5),
  Hotel: zone(5),
  "B-2": zone(5),
  // high density (FAR 4.0)
  "B-3": zone(9),
};

// Maui's own defaults for the land cost ($ per sqft of lot) and unit mix
// levers (Honolulu's: $170, and half studios, half one-bedrooms). Team
// estimates (Nov. 2026); the land cost is in line with Title Guaranty and
// QPub land sales, see docs/notes/LAND_COST.md
export const lever_defaults: LeverDefaults = {
  land_cost: 75,
  unit_type: "studio_100",
  source:
    "team estimate (Nov. 2026); median land sale price per sqft in A-1, A-2, H-1, H-M, H-2, B-2 and B-3, 2020–2025: Title Guaranty $72.70 (34 sales), QPub $81.37 (68) (sales of $10,000 or more on lots of 1,000 sqft or more, UHERO's housing database)",
};

export const market: MarketAssumptions = {
  // Honolulu's
  cap_rate: 0.051,
  vacancy: { residential: 0.074, retail: 0.126 },
  // Honolulu's (RLB Honolulu construction cost escalation)
  cost_inflation: 1.056,
  // 3.9%/yr: HHFDC Maui County 100% AMI for 4 people, $84,900 (2013) to
  // $134,600 (2025)
  ami_escalation: 1.039,
  // affordable rent caps track the income limits (3.9%/yr, as above);
  // Maui market rent growth has not been checked
  annual_rent_growth: 0.039,
  // Honolulu's
  annual_opex_growth: 0.035,
  annual_assessment_growth: 0.02,
  // Honolulu's (Ulupono 2020; RLB Q2 2026 Honolulu parking cost)
  parking: {
    stall_sqft: 330,
    cost_per_sqft: 190,
    surface_stall_sqft: 360,
    surface_cost_per_sqft: 30,
    monthly_rent_per_stall: 100,
  },
  source:
    "HHFDC 2013 and 2025 Maui County income schedules (AMI growth); otherwise Honolulu's assumptions.ts, pending Maui figures",
};

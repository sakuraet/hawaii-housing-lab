// County of Hawaiʻi: estimates we chose (not law). Where no Hawaiʻi County
// figure has been found, the value is Honolulu's, marked "Honolulu's"
// below, so the model runs; each is a choice to revisit (see
// docs/notes/HAWAII_COUNTY.md). AMI growth and hold-period rent growth are
// the county's own.

import type {
  MarketAssumptions,
  TimingAssumptions,
  ZoneAssumptions,
} from "../../../core/locality";

// permitting and construction months, every zone; a slider setting
// overrides them. Honolulu's (the team's rule sheet expects permitting to be
// longer here; not researched)
export const timing: TimingAssumptions = {
  permitting_months: 18,
  construction_months: 12,
};

// excavation depth (ft); assumed, not from the code. Honolulu's default for
// every zone: the districts are set by land area per unit, not FAR, so
// Honolulu's depths by FAR don't map onto them
export const default_zone: ZoneAssumptions = { excavation_depth_ft: 4 };

export const zones: Record<string, ZoneAssumptions> = {};

export const market: MarketAssumptions = {
  // Honolulu's
  cap_rate: 0.051,
  vacancy: { residential: 0.074, retail: 0.126 },
  // Honolulu's (RLB Honolulu construction cost escalation)
  cost_inflation: 1.056,
  // 4.7%/yr: HHFDC Hawaiʻi County 100% AMI for 4 people, $69,800 (2013) to
  // $120,900 (2025)
  ami_escalation: 1.047,
  // affordable rent caps track the income limits (4.7%/yr, as above); market
  // rent growth has not been checked
  annual_rent_growth: 0.047,
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
    "HHFDC 2013 and 2025 Hawaiʻi County income schedules (AMI growth); otherwise Honolulu's assumptions.ts, pending county figures",
};

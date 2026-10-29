// TEMPLATE: the county's estimates (not law): timing, excavation depth and
// market figures. Say where each comes from in `source`. Honolulu's
// assumptions.ts is a full worked example.

import type {
  MarketAssumptions,
  TimingAssumptions,
  ZoneAssumptions,
} from "../../../core/locality";

// every number starts as TODO; the completeness test fails until each is set
const TODO = NaN;

// permitting and construction months for a typical project in this county
export const timing: TimingAssumptions = {
  permitting_months: TODO,
  construction_months: TODO,
};

// excavation depth (ft) for a zone with no entry below
export const default_zone: ZoneAssumptions = { excavation_depth_ft: TODO };

// optional: excavation depth for zones that dig deeper or shallower
export const zones: Record<string, ZoneAssumptions> = {
  // "TODO-ZONE": { excavation_depth_ft: TODO },
};

export const market: MarketAssumptions = {
  // market cap rate (5.1% = 0.051)
  cap_rate: TODO,
  // vacancy, share of potential income
  vacancy: { residential: TODO, retail: TODO },
  // construction cost escalation per year, as a multiplier (5.6% = 1.056)
  cost_inflation: TODO,
  // AMI growth per year, as a multiplier (4% = 1.04)
  ami_escalation: TODO,
  // per year, during the hold
  annual_rent_growth: TODO,
  annual_opex_growth: TODO,
  annual_assessment_growth: TODO,
  parking: {
    // gross sqft per structured stall, including drive aisles
    stall_sqft: TODO,
    // structured parking construction cost, $ per sqft
    cost_per_sqft: TODO,
    // surface lot sqft per stall and cost per sqft
    surface_stall_sqft: TODO,
    surface_cost_per_sqft: TODO,
    // monthly rent per stall
    monthly_rent_per_stall: TODO,
  },
  source: "TODO",
};

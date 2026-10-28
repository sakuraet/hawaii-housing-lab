// City and County of Honolulu: estimates we chose (not law). Values from
// @uhero/feasim 0.1.0 (calculations/calc-shared.ts), with two changes made
// later in the package by the team (see test/honolulu-config.test.ts):
// one permitting and construction time for every zone, and 4% rent growth.

import type {
  MarketAssumptions,
  TimingAssumptions,
  ZoneAssumptions,
} from "../../../core/locality";

// permitting and construction months, every zone and pathway; a slider
// setting overrides them
export const timing: TimingAssumptions = {
  permitting_months: 18,
  construction_months: 12,
};

// excavation depth (ft) by zone; assumed, not from the code
const zone = (excavation_depth_ft: number): ZoneAssumptions => ({ excavation_depth_ft });

export const default_zone = zone(4);

export const zones: Record<string, ZoneAssumptions> = {
  // low density
  "R-5": zone(3),
  "A-1": zone(3),
  "AMX-1": zone(3),
  // medium density
  "A-2": zone(5),
  "AMX-2": zone(5),
  "B-2": zone(5),
  // high density and Waikiki
  "A-3": zone(9),
  "AMX-3": zone(9),
  Apart: zone(9),
  ApartMix: zone(9),
  "BMX-4": zone(9),
};

export const market: MarketAssumptions = {
  // the same for every zone
  cap_rate: 0.051,
  vacancy: { residential: 0.074, retail: 0.126 },
  // 5.6%/yr construction hard-cost escalation, to the construction midpoint
  cost_inflation: 1.056,
  // 4%/yr AMI growth (2015–2026 Honolulu median family income growth)
  ami_escalation: 1.04,
  // hold-period rent growth for all units: affordable caps track AMI (4%/yr,
  // Honolulu MFI 2015-2025), and market rents grew about as fast (Zillow
  // Honolulu 3.6%/yr since 2016, 4.2%/yr over the last 5 years)
  annual_rent_growth: 0.04,
  annual_opex_growth: 0.035,
  annual_assessment_growth: 0.02,
  parking: {
    // gross sqft per structured stall incl. drive aisles (Ulupono 2020)
    stall_sqft: 330,
    // RLB Q2 2026 Honolulu above-ground parking, low end of $190–245
    cost_per_sqft: 190,
    // on-grade (Ulupono 2020, adjusted to 2026 plus a margin)
    surface_stall_sqft: 360,
    surface_cost_per_sqft: 30,
    monthly_rent_per_stall: 100,
  },
  source: "Pro-forma Variables V3; Policy Simulator Documentation, Pro Forma Logic",
};

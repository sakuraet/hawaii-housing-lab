// City and County of Honolulu: estimates we chose (not law). Values copied
// unchanged from @uhero/feasim 0.1.0 (calculations/calc-shared.ts);
// test/honolulu-config.test.ts checks every value against that code.

import type { MarketAssumptions, ZoneAssumptions } from "../../../core/locality";

// permitting time in days, converted to whole months (days / 30, rounded)
const months = (days: number) => Math.round(days / 30);

// permitting months, construction months and excavation depth (ft) by zone
function zone(
  permitting_months: number,
  construction_months: number,
  excavation_depth_ft: number
): ZoneAssumptions {
  return { permitting_months, construction_months, excavation_depth_ft };
}

export const default_zone = zone(14, 18, 4);

export const zones: Record<string, ZoneAssumptions> = {
  "R-5": zone(months(353), 18, 3),
  "A-1": zone(months(425), 18, 3),
  "AMX-1": zone(months(425), 18, 3),
  "A-2": zone(months(535), 24, 5),
  "AMX-2": zone(months(535), 24, 5),
  "A-3": zone(months(535), 36, 9),
  "AMX-3": zone(months(535), 36, 9),
  Apart: zone(months(535), 36, 9),
  ApartMix: zone(months(535), 36, 9),
  "B-1": default_zone,
  "B-2": zone(months(454), 24, 5),
  "BMX-3": zone(months(454), 36, 4),
  "BMX-4": zone(months(454), 36, 9),
  // Bill 7 placeholders, used when a lot has no zone: by height, up to 30 ft
  // and above 30 ft
  low_rise: zone(months(425), 18, 4),
  mid_rise: zone(months(535), 24, 4),
};

export const market: MarketAssumptions = {
  // the same for every zone
  cap_rate: 0.051,
  vacancy: { residential: 0.074, retail: 0.126 },
  // 5.6%/yr construction hard-cost escalation, to the construction midpoint
  cost_inflation: 1.056,
  // 4%/yr AMI growth (2015–2026 Honolulu median family income growth)
  ami_escalation: 1.04,
  // blended: affordable 4%, market 3.2% (Apartments.com Honolulu)
  annual_rent_growth: 0.035,
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

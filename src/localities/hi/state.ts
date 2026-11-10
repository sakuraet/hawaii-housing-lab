// State of Hawaiʻi: rules set by state law or statewide agencies, shared by
// every county. Values as in @uhero/feasim 0.1.0.

import type { StateRules } from "../../core/locality";

export const hawaii: StateRules = {
  id: "hi",
  name: "Hawaiʻi",
  // affordable rent = 30% of household income, utilities included
  affordable_rent_income_share: 0.3,
  // HRS 201H: at least floor(units x 0.5) + 1 affordable units
  h201_min_affordable_frac: 0.5,
  // HRS § 247-2, per $100 of the whole price; a whole rental building takes
  // the general rate
  conveyance_tax: [
    { below: 600_000, general: 0.1, condo_sfr: 0.15 },
    { below: 1_000_000, general: 0.2, condo_sfr: 0.25 },
    { below: 2_000_000, general: 0.3, condo_sfr: 0.4 },
    { below: 4_000_000, general: 0.5, condo_sfr: 0.6 },
    { below: 6_000_000, general: 0.7, condo_sfr: 0.85 },
    { below: 10_000_000, general: 0.9, condo_sfr: 1.1 },
    { below: null, general: 1.0, condo_sfr: 1.25 },
  ],
  source: "HHFDC rent guidelines; HRS Ch. 201H; HRS § 247-2",
};

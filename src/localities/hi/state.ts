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
  source: "HHFDC rent guidelines; HRS Ch. 201H",
};

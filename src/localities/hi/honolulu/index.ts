// City and County of Honolulu: the Locality the engine reads for Oʻahu
// parcels. Rules are in zones.ts and rules.ts, estimates in assumptions.ts.

import type { Locality } from "../../../core/locality";
import { hawaii } from "../state";
import * as assumptions from "./assumptions";
import * as rules from "./rules";
import { zones } from "./zones";

export const honolulu: Locality = {
  id: "hi-honolulu",
  name: "City and County of Honolulu",
  state: hawaii,
  pathways: ["bill6", "standard", "bill7", "tod", "h201"],
  rules: {
    zones,
    parking: rules.parking,
    loading: rules.loading,
    bicycle: rules.bicycle,
    fees: rules.fees,
    water: rules.water,
    property_tax_rate: rules.property_tax_rate,
    income_limits: rules.income_limits,
  },
  assumptions: {
    zones: assumptions.zones,
    default_zone: assumptions.default_zone,
    market: assumptions.market,
  },
};

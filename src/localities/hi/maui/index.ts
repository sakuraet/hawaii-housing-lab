// County of Maui: the Locality the engine reads for Maui, Molokaʻi and Lānaʻi
// parcels. Rules are in zones.ts and rules.ts, estimates in assumptions.ts.
// Current zoning (bill6) only; a zone not in zones.ts stops the run.

import type { Locality } from "../../../core/locality";
import { hawaii } from "../state";
import * as assumptions from "./assumptions";
import * as rules from "./rules";
import { zones } from "./zones";

export const maui: Locality = {
  id: "hi-maui",
  name: "County of Maui",
  state: hawaii,
  pathways: ["bill6"],
  unknown_zone: "error",
  rules: {
    zones,
    parking: rules.parking,
    loading: rules.loading,
    bicycle: rules.bicycle,
    fees: rules.fees,
    water: rules.water,
    property_tax_rate: rules.property_tax_rate,
    income_limits: rules.income_limits,
    inclusionary: rules.inclusionary,
  },
  assumptions: {
    timing: assumptions.timing,
    zones: assumptions.zones,
    default_zone: assumptions.default_zone,
    market: assumptions.market,
  },
};

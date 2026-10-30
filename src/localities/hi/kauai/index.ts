// County of Kauaʻi: the Locality the engine reads for Kauaʻi parcels. Rules
// are in zones.ts and rules.ts, estimates in assumptions.ts. Current zoning
// only; a zone not in zones.ts stops the run. The choices made are in
// docs/notes/KAUAI.md.

import type { Locality } from "../../../core/locality";
import { hawaii } from "../state";
import * as assumptions from "./assumptions";
import * as rules from "./rules";
import { zones } from "./zones";

export const kauai: Locality = {
  id: "hi-kauai",
  name: "County of Kauaʻi",
  state: hawaii,
  pathways: ["current"],
  // stop with an error on a zone this config does not list, so a missing
  // rule is noticed rather than silently given no density limit
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
  },
  assumptions: {
    timing: assumptions.timing,
    zones: assumptions.zones,
    default_zone: assumptions.default_zone,
    market: assumptions.market,
  },
};

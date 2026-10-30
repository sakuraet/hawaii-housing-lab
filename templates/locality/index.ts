// TEMPLATE: a new county's Locality. Copy this folder to
// src/localities/hi/<county>/ (for example src/localities/hi/maui/) and fill
// in every TODO. See docs/notes/ADDING_A_COUNTY.md.
//
// Rules (law, with a source) go in zones.ts and rules.ts; estimates go in
// assumptions.ts.

import type { Locality } from "../../../core/locality";
import { hawaii } from "../state";
import * as assumptions from "./assumptions";
import * as rules from "./rules";
import { zones } from "./zones";

// TODO: rename `county` to the county's name, for example `maui`
export const county: Locality = {
  // TODO: "hi-" plus the county, lowercase, for example "hi-maui"
  id: "hi-TODO",
  // TODO: the county's official name, for example "County of Maui"
  name: "TODO",
  state: hawaii,
  // other counties have current zoning only for now
  pathways: ["current"],
  // stop with an error on a zone this config does not list, so a missing
  // rule is noticed rather than silently given no FAR
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

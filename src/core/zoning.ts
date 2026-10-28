// Reading a locality's zoning rules: the lookups the engine calls instead of
// hard-coded zone tables.

import type { Locality, PathwayId, ZoneAssumptions, ZoneRules } from "./locality";
import { evaluateSchedule } from "./schedule";

/** a zone's rules; undefined for an unlisted zone under the "fallback"
 *  policy, an error under "error" */
export function zoneRules(loc: Locality, zone_class: string): ZoneRules | undefined {
  const zone = loc.rules.zones[zone_class];
  if (!zone && loc.unknown_zone === "error") {
    throw new Error(`${loc.name} (${loc.id}): no zoning rules for zone "${zone_class}"`);
  }
  return zone;
}

/** lot coverage the original model gives a zone with no coverage rule */
export const FALLBACK_LOT_COVERAGE = 0.6;

/** a pathway's maximum lot coverage for a zone and lot. With no rule for it:
 *  FALLBACK_LOT_COVERAGE under the "fallback" policy, an error under "error" */
export function zoneCoverage(
  loc: Locality,
  zone_class: string,
  pathway: PathwayId,
  lot_sqft: number
): number {
  const schedule = zoneRules(loc, zone_class)?.lot_coverage[pathway];
  if (schedule) return evaluateSchedule(schedule, lot_sqft);
  if (loc.unknown_zone === "error") {
    throw new Error(
      `${loc.name} (${loc.id}): no ${pathway} lot coverage for zone "${zone_class}"`
    );
  }
  return FALLBACK_LOT_COVERAGE;
}

/** a pathway's FAR for a zone and lot; 0 where the pathway has none */
export function zoneFar(
  loc: Locality,
  zone_class: string,
  pathway: PathwayId,
  lot_sqft: number
): number {
  const schedule = zoneRules(loc, zone_class)?.far[pathway];
  return schedule ? evaluateSchedule(schedule, lot_sqft) : 0;
}

/** a zone's timing and excavation estimates; the locality's default for a
 *  zone with none of its own */
export function zoneAssumptions(loc: Locality, zone_class: string): ZoneAssumptions {
  return loc.assumptions.zones[zone_class] ?? loc.assumptions.default_zone;
}

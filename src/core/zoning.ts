// Reading a locality's zoning rules: the lookups the engine calls instead of
// hard-coded zone tables.

import type { Locality, PathwayId, YardRules, ZoneAssumptions, ZoneRules } from "./locality";
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
  const schedule = zoneRules(loc, zone_class)?.lot_coverage?.[pathway];
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
  const schedule = zoneRules(loc, zone_class)?.far?.[pathway];
  return schedule ? evaluateSchedule(schedule, lot_sqft) : 0;
}

/** what current zoning allows on a lot */
export interface CurrentLimits {
  /** maximum FAR; Infinity where the code sets none */
  far: number;
  /** most dwelling units by lot area per unit; absent where the code sets none */
  max_units?: number;
  /** maximum building area as a share of the lot */
  lot_coverage: number;
  /** minimum yards; absent where the zone sets none (the setback lever) */
  yards?: YardRules;
  /** the zone's own housing parking minimum, stalls per unit */
  residential_stalls_per_unit?: number;
}

/** current zoning's limits for a zone and lot: the zone's `current` rules,
 *  or for a zone without them (Honolulu), its bill6 (Ord. 26-7) FAR and
 *  coverage */
export function currentLimits(
  loc: Locality,
  zone_class: string,
  lot_sqft: number
): CurrentLimits {
  const current = zoneRules(loc, zone_class)?.current;
  if (!current) {
    return {
      far: zoneFar(loc, zone_class, "bill6", lot_sqft),
      lot_coverage: zoneCoverage(loc, zone_class, "bill6", lot_sqft),
    };
  }
  const per_unit = current.lot_area_per_unit;
  return {
    far: current.far ? evaluateSchedule(current.far, lot_sqft) : Infinity,
    ...(per_unit && {
      max_units: Math.floor(lot_sqft / evaluateSchedule(per_unit, lot_sqft) + 1e-9),
    }),
    lot_coverage: evaluateSchedule(current.lot_coverage, lot_sqft),
    ...(current.yards && { yards: current.yards }),
    ...(current.residential_stalls_per_unit != null && {
      residential_stalls_per_unit: current.residential_stalls_per_unit,
    }),
  };
}

/** a zone's timing and excavation estimates; the locality's default for a
 *  zone with none of its own */
export function zoneAssumptions(loc: Locality, zone_class: string): ZoneAssumptions {
  return loc.assumptions.zones[zone_class] ?? loc.assumptions.default_zone;
}

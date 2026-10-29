// Checks that a locality's config is complete and plausible: every value
// filled in (no TODO or NaN left from the template), every rule sourced,
// schedules well formed, shares between 0 and 1. Each problem names the
// value's path, for example `rules.zones.A-2.far.bill6.bands[0].base`.

import type { Locality } from "./locality";

const INCOME_LIMIT_AMIS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140];

function isSchedule(v: unknown): v is { bands: { upTo: number | null; base: number }[] } {
  return typeof v === "object" && v !== null && Array.isArray((v as { bands?: unknown }).bands);
}

/** every problem with the locality's config; empty when it is complete */
export function checkLocality(loc: Locality): string[] {
  const problems: string[] = [];
  const add = (path: string, problem: string) => problems.push(`${loc.id} ${path}: ${problem}`);

  // every value filled in, every source given, every schedule well formed
  const walk = (v: unknown, path: string): void => {
    if (typeof v === "number") {
      if (!Number.isFinite(v)) add(path, "not filled in");
    } else if (typeof v === "string") {
      if (v.includes("TODO")) add(path, "still says TODO");
    } else if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if ("source" in obj && (typeof obj.source !== "string" || obj.source.trim() === "")) {
        add(`${path}.source`, "no source given");
      }
      if (isSchedule(v)) {
        const bands = v.bands;
        if (bands.length === 0) add(`${path}.bands`, "a schedule needs at least one band");
        else if (bands[bands.length - 1].upTo !== null)
          add(`${path}.bands`, "the last band needs upTo: null, so every value is covered");
        const edges = bands.map((b) => b.upTo).filter((u): u is number => u !== null);
        if (edges.some((u, i) => i > 0 && u <= edges[i - 1]))
          add(`${path}.bands`, "band upTo values must go up, smallest first");
      }
      for (const [key, child] of Object.entries(obj)) {
        // the state rules are checked once, on their own
        if (path === "" && key === "state") continue;
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };
  walk(loc, "");
  walk(loc.state, "state");

  // identity and pathways
  if (!/^[a-z]{2}-[a-z0-9-]+$/.test(loc.id)) add("id", 'should be a state code and a place, like "hi-maui"');
  if (!loc.pathways.includes("bill6")) add("pathways", "every locality needs bill6 (current zoning)");

  // a strict locality needs current-zoning FAR and coverage for every zone
  const zones = Object.entries(loc.rules.zones);
  if (zones.length === 0) add("rules.zones", "no zoning districts listed");
  if (loc.unknown_zone === "error") {
    for (const [zone, z] of zones) {
      if (!z.far.bill6) add(`rules.zones.${zone}.far.bill6`, "missing");
      if (!z.lot_coverage.bill6) add(`rules.zones.${zone}.lot_coverage.bill6`, "missing");
    }
  }

  // shares must be between 0 and 1
  const share = (path: string, v: number) => {
    if (Number.isFinite(v) && (v < 0 || v > 1)) add(path, `${v} is a share, so it must be 0 to 1`);
  };
  for (const [zone, z] of zones) {
    share(`rules.zones.${zone}.commercial_coverage`, z.commercial_coverage);
    for (const [pathway, s] of Object.entries(z.lot_coverage)) {
      s?.bands.forEach((b, i) => share(`rules.zones.${zone}.lot_coverage.${pathway}.bands[${i}].base`, b.base));
    }
    z.open_space?.bands.forEach((b, i) => share(`rules.zones.${zone}.open_space.bands[${i}].base`, b.base));
  }
  share("rules.parking.joint_use", loc.rules.parking.joint_use);
  share("rules.fees.park_dedication.floor_area_fraction", loc.rules.fees.park_dedication.floor_area_fraction);
  share("assumptions.market.vacancy.residential", loc.assumptions.market.vacancy.residential);
  share("assumptions.market.vacancy.retail", loc.assumptions.market.vacancy.retail);

  // values that must be more than 0
  const positive = (path: string, v: number) => {
    if (Number.isFinite(v) && v <= 0) add(path, "must be more than 0");
  };
  positive("assumptions.timing.permitting_months", loc.assumptions.timing.permitting_months);
  positive("assumptions.timing.construction_months", loc.assumptions.timing.construction_months);
  positive("assumptions.market.cap_rate", loc.assumptions.market.cap_rate);
  positive("rules.parking.residential_sqft_per_stall", loc.rules.parking.residential_sqft_per_stall);
  positive("rules.parking.retail_sqft_per_stall", loc.rules.parking.retail_sqft_per_stall);

  // income limits: every AMI level the model uses, 8 household sizes each
  for (const ami of INCOME_LIMIT_AMIS) {
    const row = loc.rules.income_limits[ami];
    if (!row) add(`rules.income_limits.${ami}`, "missing");
    else if (row.length !== 8) add(`rules.income_limits.${ami}`, `needs 8 household sizes, has ${row.length}`);
  }

  return problems;
}

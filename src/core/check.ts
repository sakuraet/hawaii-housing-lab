// Checks that a locality's config is complete and plausible: every value
// filled in (no TODO or NaN left from the template), every rule sourced,
// schedules well formed, shares between 0 and 1. Each problem names the
// value's path, for example `rules.zones.A-2.current.far.bands[0].base`.

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
  if (!loc.pathways.includes("current")) add("pathways", "every locality needs current (current zoning)");

  // a strict locality needs current zoning for every zone: its `current`
  // rules, or Honolulu's form (a bill6 FAR and coverage)
  const zones = Object.entries(loc.rules.zones);
  if (zones.length === 0) add("rules.zones", "no zoning districts listed");
  if (loc.unknown_zone === "error") {
    for (const [zone, z] of zones) {
      if (z.current || z.far?.bill6 || z.lot_coverage?.bill6) {
        if (!z.current && !z.far?.bill6) add(`rules.zones.${zone}.far.bill6`, "missing");
        if (!z.current && !z.lot_coverage?.bill6) add(`rules.zones.${zone}.lot_coverage.bill6`, "missing");
      } else {
        add(`rules.zones.${zone}.current`, "missing");
      }
    }
  }

  // shares must be between 0 and 1
  const share = (path: string, v: number) => {
    if (Number.isFinite(v) && (v < 0 || v > 1)) add(path, `${v} is a share, so it must be 0 to 1`);
  };
  for (const [zone, z] of zones) {
    share(`rules.zones.${zone}.commercial_coverage`, z.commercial_coverage);
    for (const [pathway, s] of Object.entries(z.lot_coverage ?? {})) {
      s?.bands.forEach((b, i) => share(`rules.zones.${zone}.lot_coverage.${pathway}.bands[${i}].base`, b.base));
    }
    z.current?.lot_coverage.bands.forEach((b, i) =>
      share(`rules.zones.${zone}.current.lot_coverage.bands[${i}].base`, b.base)
    );
    // lot area per unit is a divisor, so it must be more than 0
    z.current?.lot_area_per_unit?.bands.forEach((b, i) => {
      if (Number.isFinite(b.base) && b.base <= 0 && !b.rate)
        add(`rules.zones.${zone}.current.lot_area_per_unit.bands[${i}].base`, "must be more than 0");
    });
    if (z.current?.units_round_up_at != null)
      share(`rules.zones.${zone}.current.units_round_up_at`, z.current.units_round_up_at);
    if (z.current?.yards?.side_rear_height_fraction != null)
      share(`rules.zones.${zone}.current.yards.side_rear_height_fraction`, z.current.yards.side_rear_height_fraction);
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
  // the housing parking minimum: by floor area or per unit, exactly one
  const { residential_sqft_per_stall: per_sqft, residential_stalls_per_unit: per_unit } =
    loc.rules.parking;
  if ((per_sqft == null) === (per_unit == null)) {
    add(
      "rules.parking",
      "set one of residential_sqft_per_stall and residential_stalls_per_unit"
    );
  }
  if (per_sqft != null) positive("rules.parking.residential_sqft_per_stall", per_sqft);
  if (per_unit != null && Number.isFinite(per_unit) && per_unit < 0) {
    add("rules.parking.residential_stalls_per_unit", "must be 0 or more");
  }
  positive("rules.parking.retail_sqft_per_stall", loc.rules.parking.retail_sqft_per_stall);

  // a required set-aside: a share, rents at AMI levels the income table has
  const inc = loc.rules.inclusionary;
  if (inc) {
    share("rules.inclusionary.share_of_market", inc.share_of_market);
    positive("rules.inclusionary.min_units", inc.min_units);
    if (inc.rent_ami.length === 0) add("rules.inclusionary.rent_ami", "needs at least one AMI level");
    for (const ami of inc.rent_ami) {
      if (!INCOME_LIMIT_AMIS.includes(ami)) {
        add("rules.inclusionary.rent_ami", `${ami} is not an AMI level in the income limits`);
      }
    }
  }

  // income limits: every AMI level the model uses, 8 household sizes each
  for (const ami of INCOME_LIMIT_AMIS) {
    const row = loc.rules.income_limits[ami];
    if (!row) add(`rules.income_limits.${ami}`, "missing");
    else if (row.length !== 8) add(`rules.income_limits.${ami}`, `needs 8 household sizes, has ${row.length}`);
  }

  return problems;
}

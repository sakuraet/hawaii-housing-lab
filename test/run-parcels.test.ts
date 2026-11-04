// Matching parcel data's zone names to a county's config (zoneKey) and
// running the parcel table on current zoning (src/scenarios/run.ts).

import { describe, expect, it } from "vitest";

import sample from "../data/sample/parcels.csv?raw";
import { checkLocality } from "../src/core/check";
import type { Locality } from "../src/core/locality";
import { zoneKey } from "../src/core/zoning";
import { getLocality, registerLocality } from "../src/localities";
import { kauai } from "../src/localities/hi/kauai";
import { maui } from "../src/localities/hi/maui";
import { calcParcel } from "../src/parcels";
import { parseParcelCsv, type StatewideParcel } from "../src/scenarios/parcels";
import { runParcel, runParcels, summarizeRuns } from "../src/scenarios/run";

describe("zone names in parcel data", () => {
  it("a listed zone is itself", () => {
    expect(zoneKey(kauai, "R-20")).toBe("R-20");
    expect(zoneKey(getLocality("hi-hawaii"), "RM-.75")).toBe("RM-.75");
  });

  it("Kauaʻi: overlays after the base district are dropped", () => {
    expect(zoneKey(kauai, "R-10/ST-P")).toBe("R-10");
    expect(zoneKey(kauai, "R-6/PD")).toBe("R-6");
    expect(zoneKey(kauai, "CG/ST-P")).toBe("CG");
  });

  it("Maui: the map's H is the Hotel district", () => {
    expect(zoneKey(maui, "H")).toBe("Hotel");
  });

  it("a zone with no match stays as written, for the lookup to report", () => {
    expect(zoneKey(kauai, "R-8")).toBe("R-8");
    expect(zoneKey(kauai, "PD/ST-CE")).toBe("PD/ST-CE");
    expect(zoneKey(maui, "R-3")).toBe("R-3");
  });

  it("an alias to a zone the config does not list is a config problem", () => {
    const loc: Locality = { ...maui, zone_names: { aliases: { X: "Nowhere" }, source: "test" } };
    expect(checkLocality(loc)).toContain('hi-maui zone_names.aliases.X: "Nowhere" is not a listed zone');
  });
});

const parcel = (p: Partial<StatewideParcel>): StatewideParcel => ({
  locality: "hi-kauai",
  tmk: "T-1",
  lot_sqft: 20000,
  zone_class: "R-20",
  height: 40,
  ...p,
});

describe("running a parcel", () => {
  it("an overlay parcel runs on its base district's rules", () => {
    const r = runParcel(parcel({ zone_class: "R-20/ST-P", land_value: 900000 }));
    expect(r.status).toBe("run");
    expect(r.zone_label).toBe("R-20/ST-P");
    expect(r.zone_class).toBe("R-20");
    expect(r.output).toEqual(
      calcParcel("current", { locality: "hi-kauai", tmk: "T-1", lot_sqft: 20000, zone_class: "R-20", height: 40 }, {
        land_cost: 45,
      })
    );
    expect(r.land_cost_source).toBe("assessed");
    expect(r.level).toMatch(/poor|marginal|strong/);
  });

  it("without a land value, the engine's default land cost, and the run says so", () => {
    const r = runParcel(parcel({}));
    expect(r.land_cost_source).toBe("default");
    expect(r.output).toEqual(calcParcel("current", { locality: "hi-kauai", tmk: "T-1", lot_sqft: 20000, zone_class: "R-20", height: 40 }));
  });

  it("a zone the config does not list is not modeled, not an error", () => {
    const r = runParcel(parcel({ zone_class: "A" }));
    expect(r.status).toBe("not_modeled");
    expect(r.reason).toBe('no rules for zone "A"');
    expect(r.output).toBeUndefined();
  });

  it("a zone that does not allow multi-family housing is not modeled", () => {
    const r = runParcel(parcel({ locality: "hi-honolulu", zone_class: "I-2", height: 60 }));
    expect(r.status).toBe("not_modeled");
    expect(r.reason).toMatch(/not permitted in I-2/);
  });

  it("an engine error is caught and reported, and the rest still run", () => {
    // a county whose R-20 is listed but has no current zoning: the engine
    // falls back to a bill6 coverage the zone does not have, and stops
    const broken: Locality = JSON.parse(JSON.stringify(kauai));
    broken.id = "zz-broken";
    delete broken.rules.zones["R-20"].current;
    registerLocality(broken);
    const runs = runParcels([parcel({ locality: "zz-broken" }), parcel({})]);
    expect(runs[0].status).toBe("error");
    expect(runs[0].reason).toMatch(/no bill6 lot coverage for zone "R-20"/);
    expect(runs[1].status).toBe("run");
  });
});

describe("the sample table", () => {
  const { parcels } = parseParcelCsv(sample);
  const runs = runParcels(parcels);

  it("every row is run or named as not modeled", () => {
    expect(runs.filter((r) => r.status === "error")).toEqual([]);
    // the single-family zones the configs do not list yet
    expect(runs.filter((r) => r.status === "not_modeled").map((r) => r.zone_label).sort()).toEqual(["R-3", "RS-10"]);
  });

  it("totals by county add up", () => {
    const summary = summarizeRuns(runs);
    expect(summary.map((s) => s.locality)).toEqual(["hi-honolulu", "hi-maui", "hi-hawaii", "hi-kauai"]);
    for (const s of summary) {
      expect(s.run + s.not_modeled + s.error).toBe(s.parcels);
      expect(s.strong_units).toBeLessThanOrEqual(s.units);
    }
    expect(summary.reduce((n, s) => n + s.parcels, 0)).toBe(parcels.length);
    const units = runs.reduce((n, r) => n + (r.output?.max_units ?? 0), 0);
    expect(summary.reduce((n, s) => n + s.units, 0)).toBe(units);
  });
});

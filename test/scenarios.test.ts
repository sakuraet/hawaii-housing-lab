// The four scenarios (src/scenarios/scenarios.ts): what each runs in each
// county, the fee lever the fee scenario uses, and the parcel runner with a
// scenario.

import { describe, expect, it } from "vitest";

import sample from "../data/sample/parcels.csv?raw";
import { calcParcel, countyLeverDefaults, DEFAULT_INPUTS, parcelInputs } from "../src/parcels";
import { parseParcelCsv } from "../src/scenarios/parcels";
import { runParcels, summarizeRuns } from "../src/scenarios/run";
import {
  SCENARIOS,
  SCENARIO_FEE_SCALE,
  SCENARIO_PARKING_RATIO,
  baselinePathway,
  scenarioOf,
  scenarioSetup,
} from "../src/scenarios/scenarios";

const COUNTIES = ["hi-honolulu", "hi-maui", "hi-hawaii", "hi-kauai"];

describe("the scenarios", () => {
  it("baseline, TOD, parking and fees, in that order", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["baseline", "tod", "parking", "fees"]);
  });

  it("an unknown id is the baseline", () => {
    expect(scenarioOf("bill7").id).toBe("baseline");
  });

  it("Honolulu's baseline is the Standard pathway; the others' is current zoning", () => {
    expect(scenarioSetup("baseline", "hi-honolulu")).toEqual({ pathway: "bill6", levers: {}, available: true });
    for (const c of COUNTIES.slice(1)) expect(scenarioSetup("baseline", c).pathway).toBe("current");
  });

  it("TOD runs Honolulu's TOD pathway; elsewhere it isn't defined yet and runs the baseline", () => {
    expect(scenarioSetup("tod", "hi-honolulu")).toMatchObject({ pathway: "tod", available: true });
    for (const c of COUNTIES.slice(1)) {
      const s = scenarioSetup("tod", c);
      expect(s.available).toBe(false);
      expect(s.pathway).toBe("current");
      expect(s.levers).toEqual({});
    }
  });

  it("parking and fees run the baseline pathway with one lever each, in every county", () => {
    for (const c of COUNTIES) {
      const base = scenarioSetup("baseline", c).pathway;
      expect(scenarioSetup("parking", c)).toMatchObject({
        pathway: base,
        levers: { parking_ratio: SCENARIO_PARKING_RATIO },
      });
      expect(scenarioSetup("fees", c)).toMatchObject({
        pathway: base,
        levers: { fee_scale: SCENARIO_FEE_SCALE },
      });
    }
  });
});

describe("the fee lever", () => {
  const parcel = { lot_sqft: 20000, zone_class: "A-2", height: 60 };

  it("1 changes nothing", () => {
    expect(calcParcel("bill6", parcel, { fee_scale: 1 })).toEqual(calcParcel("bill6", parcel));
  });

  it("0.5 halves every fee line but construction management", () => {
    const full = calcParcel("bill6", parcel).soft_cost_breakdown;
    const half = calcParcel("bill6", parcel, { fee_scale: 0.5 }).soft_cost_breakdown;
    for (const [k, v] of Object.entries(full)) {
      if (k === "total") continue;
      const expected = k === "construction_mgmt" ? v : v * 0.5;
      expect(half[k as keyof typeof half], k).toBeCloseTo(expected, 6);
    }
  });

  it("lower fees never lower the return", () => {
    for (const locality of COUNTIES) {
      const p =
        locality === "hi-honolulu"
          ? parcel
          : { locality, lot_sqft: 20000, zone_class: locality === "hi-kauai" ? "R-20" : locality === "hi-hawaii" ? "RM-2" : "A-2", height: 45 };
      const pathway = scenarioSetup("baseline", locality).pathway;
      expect(calcParcel(pathway, p, { fee_scale: 0.5 }).dev_roc).toBeGreaterThanOrEqual(
        calcParcel(pathway, p).dev_roc
      );
    }
  });
});

describe("each county's land cost default", () => {
  it("Honolulu $170, Maui $75, Hawaiʻi $55, Kauaʻi $50; a lever setting still wins", () => {
    const expected = { "hi-honolulu": 170, "hi-maui": 75, "hi-hawaii": 55, "hi-kauai": 50 };
    // a multi-family zone in each county
    const zone: Record<string, string> = { "hi-honolulu": "A-2", "hi-maui": "A-2", "hi-hawaii": "RM-2", "hi-kauai": "R-20" };
    for (const [locality, land] of Object.entries(expected)) {
      expect(countyLeverDefaults(locality).land_cost, locality).toBe(land);
      const p = { locality, lot_sqft: 20000, zone_class: zone[locality], height: 45 };
      expect(parcelInputs(baselinePathway(locality), p).land_cost, locality).toBe(land);
      expect(parcelInputs(baselinePathway(locality), p, { land_cost: 99 }).land_cost).toBe(99);
    }
    // a parcel with no locality is Honolulu's
    expect(parcelInputs("bill6", { lot_sqft: 20000, zone_class: "A-2", height: 60 }).land_cost).toBe(170);
  });

  it("the pathway defaults keep the original model's $130", () => {
    expect(DEFAULT_INPUTS.bill6.land_cost).toBe(130);
  });
});

describe("the parcel runner with a scenario", () => {
  const { parcels } = parseParcelCsv(sample);
  const base = runParcels(parcels);

  it("the baseline is the default", () => {
    expect(runParcels(parcels, { scenario: "baseline" })).toEqual(base);
  });

  it("parking: 0.5 stalls per unit on every parcel run", () => {
    for (const r of runParcels(parcels, { scenario: "parking" })) {
      if (r.status !== "run" || !r.output) continue;
      // whole stalls, rounded up
      expect(r.output.parking_stalls).toBe(Math.ceil(r.output.max_units * SCENARIO_PARKING_RATIO));
    }
  });

  it("fees: a higher return and never fewer units", () => {
    // in Honolulu, cheaper fees can make the open-space bonus worth taking,
    // so a few parcels build more
    const fees = runParcels(parcels, { scenario: "fees" });
    fees.forEach((r, i) => {
      if (r.status !== "run" || !r.output || !base[i].output) return;
      expect(r.output.max_units).toBeGreaterThanOrEqual(base[i].output!.max_units);
      expect(r.output.dev_roc).toBeGreaterThanOrEqual(base[i].output!.dev_roc);
    });
  });

  it("fees: lower fees can make the open-space bonus pay", () => {
    const p = { lot_sqft: 9374.1, zone_class: "BMX-4", height: 40 };
    // at $130 land, this lot takes the open-space bonus at 85% of fees, but
    // not at 90%
    const at = (fee_scale: number) => calcParcel("bill6", p, { land_cost: 130, fee_scale }).max_units;
    expect(at(0.9)).toBe(at(1));
    expect(at(0.85)).toBeGreaterThan(at(1));
  });

  it("TOD: parcels outside a TOD district (all of the table, for now) keep the baseline", () => {
    const tod = runParcels(parcels, { scenario: "tod" });
    expect(summarizeRuns(tod)).toEqual(summarizeRuns(base));
  });

  it("a lever set for the run still wins over the scenario's", () => {
    const runs = runParcels(parcels, { scenario: "parking", levers: { parking_ratio: 1 } });
    for (const r of runs) {
      if (r.status !== "run" || !r.output) continue;
      expect(r.output.parking_stalls).toBeGreaterThanOrEqual(r.output.max_units - 1);
    }
  });
});

// End-to-end tests for running a parcel under another county's config
// (src/localities): a parcel names its county with `locality`, the bill6
// pathway reads every rule and estimate from that county, and pathways the
// county does not have are refused.

import { describe, expect, it } from "vitest";

import {
  calcParcel,
  calcSingle,
  DEFAULT_INPUTS,
  parcelInputs,
  type Parcel,
} from "../src";
import type { Locality } from "../src/core/locality";
import { flat } from "../src/core/schedule";
import { getLocality, localityIds, registerLocality } from "../src/localities";
import { honolulu } from "../src/localities/hi/honolulu";

// a test county: Honolulu's rules and market under another id, with only
// the bill6 pathway, as the neighbor-island counties will be set up
function testCounty(id: string, change: (loc: Locality) => Locality = (l) => l): Locality {
  const base: Locality = {
    // a deep copy, so a test can change it without touching Honolulu's
    ...(JSON.parse(JSON.stringify(honolulu)) as Locality),
    id,
    name: `Test County (${id})`,
    pathways: ["bill6"],
  };
  return change(base);
}

const parcel: Parcel = { lot_sqft: 20000, zone_class: "A-2", height: 60 };
const honoluluResult = calcParcel("bill6", parcel);

// run the parcel under a county that differs from Honolulu in one way
function runChanged(id: string, change: (loc: Locality) => Locality) {
  registerLocality(testCounty(id, change));
  return calcParcel("bill6", { ...parcel, locality: id });
}

describe("choosing the county", () => {
  it("a parcel with no locality runs on Honolulu, unchanged", () => {
    expect(parcelInputs("bill6", parcel)).not.toHaveProperty("locality");
    expect(calcParcel("bill6", { ...parcel, locality: "hi-honolulu" })).toEqual(honoluluResult);
  });

  it("an exact copy of Honolulu's config gives Honolulu's results", () => {
    registerLocality(testCounty("test-copy"));
    expect(calcParcel("bill6", { ...parcel, locality: "test-copy" })).toEqual(honoluluResult);
    expect(parcelInputs("bill6", { ...parcel, locality: "test-copy" }).locality).toBe("test-copy");
  });

  it("an unknown locality id is an error", () => {
    expect(() => getLocality("hi-nowhere")).toThrow(/Unknown locality "hi-nowhere"/);
    expect(() => calcParcel("bill6", { ...parcel, locality: "hi-nowhere" })).toThrow();
  });

  it("registered localities are listed", () => {
    registerLocality(testCounty("test-listed"));
    expect(localityIds()).toEqual(expect.arrayContaining(["hi-honolulu", "test-listed"]));
  });
});

describe("pathways a county does not have are refused", () => {
  registerLocality(testCounty("test-bill6-only"));
  const there = { ...parcel, locality: "test-bill6-only" };

  it.each(["standard", "bill7", "tod", "h201"] as const)("%s", (program) => {
    expect(() => calcParcel(program, there)).toThrow(/has no "\w+" pathway/);
    expect(() => calcSingle({ ...DEFAULT_INPUTS[program], program, locality: "test-bill6-only" })).toThrow(
      /has no "\w+" pathway/
    );
  });

  it("bill6 runs", () => {
    expect(calcParcel("bill6", there).max_units).toBeGreaterThan(0);
  });
});

describe("a strict county stops on a zone it has no rules for", () => {
  it("refuses an unlisted zone", () => {
    registerLocality(testCounty("test-strict", (l) => ({ ...l, unknown_zone: "error" })));
    expect(() => calcParcel("bill6", { ...parcel, zone_class: "XYZ", locality: "test-strict" })).toThrow(
      /no zoning rules for zone "XYZ"/
    );
  });
});

// One change per rule group. If the bill6 path still read Honolulu's value
// anywhere, that change would not reach the result and the test would fail.
describe("the bill6 pathway reads every group from the parcel's county", () => {
  const zoneA2 = (l: Locality, edit: (z: Locality["rules"]["zones"][string]) => void) => {
    edit(l.rules.zones["A-2"]);
    return l;
  };

  const cases: [string, (l: Locality) => Locality, (r: ReturnType<typeof calcParcel>) => void][] = [
    [
      "zoning FAR",
      (l) => zoneA2(l, (z) => { z.far.bill6 = flat(1.5, "test"); }),
      (r) => expect(r.buildable_sqft).toBeLessThan(honoluluResult.buildable_sqft),
    ],
    [
      "lot coverage",
      (l) => zoneA2(l, (z) => { z.lot_coverage.bill6 = flat(0.3, "test"); }),
      (r) => expect(r).not.toEqual(honoluluResult),
    ],
    [
      "parking minimum",
      (l) => { l.rules.parking.residential_sqft_per_stall = 250; return l; },
      (r) => expect(r.parking_stalls).toBeGreaterThan(honoluluResult.parking_stalls),
    ],
    [
      "loading",
      (l) => { l.rules.loading.multifamily_spaces = flat(5, "test"); return l; },
      (r) => expect(r.loading_spaces).toBeGreaterThan(honoluluResult.loading_spaces ?? 0),
    ],
    [
      "bicycle parking",
      (l) => { l.rules.bicycle.long_term.units_per_space = 1; return l; },
      (r) => expect(r.bicycle_long_term).toBeGreaterThan(honoluluResult.bicycle_long_term ?? 0),
    ],
    [
      "building permit fee",
      (l) => { l.rules.fees.building_permit = flat(50000, "test"); return l; },
      (r) => expect(r.soft_cost_breakdown!.building_permit).toBeGreaterThan(honoluluResult.soft_cost_breakdown!.building_permit),
    ],
    [
      "water charges",
      (l) => { l.rules.water.wsfc_per_fu = { low_rise: 1000, high_rise: 1000 }; return l; },
      (r) => expect(r.soft_cost_breakdown!.wsfc).toBeGreaterThan(honoluluResult.soft_cost_breakdown!.wsfc),
    ],
    [
      "school impact fee",
      (l) => { l.rules.fees.school_impact_per_unit = 5000; return l; },
      (r) => expect(r.soft_cost_breakdown!.impact).toBeGreaterThan(honoluluResult.soft_cost_breakdown!.impact),
    ],
    [
      "property tax",
      (l) => { l.rules.property_tax_rate = 0.01; return l; },
      (r) => expect(r.property_tax).toBeGreaterThan(honoluluResult.property_tax),
    ],
    [
      "income limits (rents)",
      (l) => {
        l.rules.income_limits = Object.fromEntries(
          Object.entries(l.rules.income_limits).map(([ami, row]) => [ami, row.map((v) => v * 1.2)])
        );
        return l;
      },
      (r) => expect(r.pri).toBeGreaterThan(honoluluResult.pri),
    ],
    [
      "cap rate",
      (l) => { l.assumptions.market.cap_rate = 0.07; return l; },
      (r) => expect(r.cap_rate).toBe(0.07),
    ],
    [
      "vacancy",
      (l) => { l.assumptions.market.vacancy.residential = 0.2; return l; },
      (r) => expect(r.residential_egi).toBeLessThan(honoluluResult.residential_egi),
    ],
    [
      "cost inflation",
      (l) => { l.assumptions.market.cost_inflation = 1.2; return l; },
      (r) => expect(r.hard_cost).toBeGreaterThan(honoluluResult.hard_cost),
    ],
    [
      "AMI growth",
      (l) => { l.assumptions.market.ami_escalation = 1.1; return l; },
      (r) => expect(r.pri).toBeGreaterThan(honoluluResult.pri),
    ],
    [
      "hold-period growth",
      (l) => { l.assumptions.market.annual_rent_growth = 0.08; return l; },
      (r) => expect(r).not.toEqual(honoluluResult),
    ],
    [
      "parking cost",
      (l) => { l.assumptions.market.parking.cost_per_sqft = 400; return l; },
      (r) => expect(r).not.toEqual(honoluluResult),
    ],
  ];

  it.each(cases)("%s", (name, change, check) => {
    const id = `test-${name.replace(/\W+/g, "-")}`;
    check(runChanged(id, change));
  });

  // DEFAULT_INPUTS sets permitting and construction months for every
  // pathway, so a parcel run uses those; the zone's estimates apply when the
  // inputs leave them unset
  it("permitting and construction months, when the inputs leave them unset", () => {
    registerLocality(
      testCounty("test-timing", (l) => {
        l.assumptions.zones["A-2"].permitting_months = 36;
        l.assumptions.zones["A-2"].construction_months = 40;
        return l;
      })
    );
    const inputs = { program: "bill6" as const, lot_sqft: 20000, zone_class: "A-2", height_limit: 60 };
    const r = calcSingle({ ...inputs, locality: "test-timing" });
    expect(r.permitting_months).toBe(36);
    expect(r.const_months).toBe(40);
    expect(calcSingle(inputs).permitting_months).toBe(18);
  });
});

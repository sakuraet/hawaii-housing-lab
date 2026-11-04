// The statewide parcel table (src/scenarios/parcels.ts): reading the CSV,
// the rows it leaves out, the land cost it gives the engine, and the sample
// in data/sample/parcels.csv running end to end in every county.

import { describe, expect, it } from "vitest";

import sample from "../data/sample/parcels.csv?raw";
import { calcParcel } from "../src/parcels";
import {
  landCostPerSqft,
  PARCEL_COLUMNS,
  parseParcelCsv,
  toParcel,
  type StatewideParcel,
} from "../src/scenarios/parcels";

const HEADER = PARCEL_COLUMNS.join(",");
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");
const GOOD = "hi-maui,T-1,15000,A-2,45,1400000,100000,vacant,0,0.5,false";

describe("reading the CSV", () => {
  it("reads a row into a parcel", () => {
    const { parcels, problems } = parseParcelCsv(csv(GOOD));
    expect(problems).toEqual([]);
    expect(parcels).toEqual([
      {
        locality: "hi-maui",
        tmk: "T-1",
        lot_sqft: 15000,
        zone_class: "A-2",
        height: 45,
        land_value: 1400000,
        building_value: 100000,
        existing_use: "vacant",
        existing_units: 0,
        transit_distance_mi: 0.5,
        parking_exempt: false,
      },
    ]);
  });

  it("blank transit distance and parking exemption are left out", () => {
    const { parcels } = parseParcelCsv(csv("hi-maui,T-1,15000,A-2,45,1400000,0,vacant,0,,"));
    expect(parcels[0]).not.toHaveProperty("transit_distance_mi");
    expect(parcels[0]).not.toHaveProperty("parking_exempt");
  });

  it("values and use not known yet may be blank", () => {
    const { parcels, problems } = parseParcelCsv(csv("hi-maui,T-1,15000,A-2,45,,,,,,"));
    expect(problems).toEqual([]);
    expect(parcels[0]).toEqual({
      locality: "hi-maui",
      tmk: "T-1",
      lot_sqft: 15000,
      zone_class: "A-2",
      height: 45,
    });
  });

  it("other columns are ignored", () => {
    const { parcels, problems } = parseParcelCsv(`${HEADER},join_status\n${GOOD},matched`);
    expect(problems).toEqual([]);
    expect(parcels[0]).not.toHaveProperty("join_status");
  });

  it("skips comments, blank lines and Windows line endings", () => {
    const { parcels, problems } = parseParcelCsv(`# a comment\r\n${HEADER}\r\n\r\n${GOOD}\r\n`);
    expect(problems).toEqual([]);
    expect(parcels).toHaveLength(1);
  });

  it("columns may come in any order", () => {
    const cols = [...PARCEL_COLUMNS].reverse();
    const values = GOOD.split(",").reverse();
    const { parcels } = parseParcelCsv(`${cols.join(",")}\n${values.join(",")}`);
    expect(parcels[0].tmk).toBe("T-1");
    expect(parcels[0].lot_sqft).toBe(15000);
  });

  it("a header without every column reads nothing", () => {
    expect(parseParcelCsv("locality,tmk\nhi-maui,T-1")).toEqual({
      parcels: [],
      problems: [
        "header: missing lot_sqft, zone_class, height, land_value, building_value, existing_use, existing_units, transit_distance_mi, parking_exempt",
      ],
    });
  });
});

describe("rows with problems are left out and named", () => {
  it.each([
    ["hi-oahu,T-1,15000,A-2,45,1400000,0,vacant,0,,", 'locality: unknown "hi-oahu"'],
    ["hi-maui,,15000,A-2,45,1400000,0,vacant,0,,", "tmk: missing"],
    ["hi-maui,T-1,0,A-2,45,1400000,0,vacant,0,,", "lot_sqft: must be more than 0"],
    ["hi-maui,T-1,abc,A-2,45,1400000,0,vacant,0,,", 'lot_sqft: "abc" is not a number'],
    ["hi-maui,T-1,15000,A-2,45,-1,0,vacant,0,,", "land_value: must be at least 0"],
    ["hi-maui,T-1,15000,A-2,45,1400000,0,house,0,,", 'existing_use: "house" is not one of'],
    ["hi-maui,T-1,15000,A-2,45,1400000,0,vacant,1.5,,", "existing_units: must be a whole number"],
    ["hi-maui,T-1,15000,A-2,45,1400000,0,vacant,0,,yes", 'parking_exempt: "yes" is not true'],
    ["hi-maui,T-1,15000,A-2,45", "5 fields, the header has 11"],
    ['hi-maui,"T,1",15000,A-2,45,1400000,0,vacant,0,,', "quoted fields are not supported"],
  ])("%s", (row, problem) => {
    const { parcels, problems } = parseParcelCsv(csv(GOOD, row));
    expect(parcels).toHaveLength(1);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`row 3: ${problem}`);
  });
});

describe("land cost from assessed value", () => {
  const p: StatewideParcel = {
    locality: "hi-kauai",
    tmk: "T-2",
    lot_sqft: 10000,
    zone_class: "R-4",
    height: 30,
    land_value: 550000,
    building_value: 300000,
    existing_use: "single_family",
    existing_units: 1,
  };

  it("land alone, or land and buildings for a lot torn down", () => {
    expect(landCostPerSqft(p)).toBe(55);
    expect(landCostPerSqft(p, "total")).toBe(85);
  });

  it("undefined when the values are not known, so the default applies", () => {
    const { land_value, building_value, ...unknown } = p;
    expect(landCostPerSqft(unknown)).toBeUndefined();
    expect(landCostPerSqft({ ...unknown, land_value }, "total")).toBeUndefined();
    expect(landCostPerSqft({ ...unknown, land_value })).toBe(55);
    // the engine's own default land cost, as with no lever
    const parcel = toParcel(unknown);
    expect(calcParcel("current", parcel, { land_cost: landCostPerSqft(unknown) })).toEqual(
      calcParcel("current", parcel)
    );
  });

  it("is the land cost the pro forma carries", () => {
    const r = calcParcel("current", toParcel(p), { land_cost: landCostPerSqft(p, "total") });
    expect(r.dev_land_cost).toBeCloseTo(850000, 6);
  });
});

describe("the sample table", () => {
  const { parcels, problems } = parseParcelCsv(sample);

  it("reads every row, in all four counties", () => {
    expect(problems).toEqual([]);
    expect(new Set(parcels.map((p) => p.locality))).toEqual(
      new Set(["hi-honolulu", "hi-maui", "hi-hawaii", "hi-kauai"])
    );
  });

  // single-family zones the configs do not list yet (the missing-middle
  // scenario adds them) stop with an error, so only the rest run here
  const runnable = parcels.filter(
    (p) => !["R-3", "RS-10"].includes(p.zone_class)
  );

  it.each(runnable.map((p) => [p.tmk, p] as const))("%s runs on current zoning", (_, p) => {
    const r = calcParcel("current", toParcel(p), { land_cost: landCostPerSqft(p) });
    expect(r.tmk).toBe(p.tmk);
    // every sample row has a land value
    expect(r.dev_land_cost).toBeCloseTo(p.land_value!, 6);
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === "number") expect(Number.isFinite(v), k).toBe(true);
    }
  });
});

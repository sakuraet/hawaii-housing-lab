// Tests for the schedule rule shape (src/core/schedule.ts). Each case writes
// one of Honolulu's current formulas as a schedule and checks it gives the
// same number as the code, exactly, across a sweep of inputs. This shows the
// shape can hold the county rules before any of them move into config.

import { describe, expect, it } from "vitest";

import {
  buildingPermitFee,
  calcFAR,
  gradingPermit,
  grubbingPermit,
  lotCoverage,
  planReviewFee,
  stockpilingPermit,
} from "../src/calculations/calc-shared";
import { evaluateSchedule, flat, type Schedule } from "../src/core/schedule";

// 0 to 400,000 in uneven steps, plus every band edge the formulas use
const EDGES = [
  100, 101, 500, 1000, 1100, 7500, 10000, 15000, 15001, 16000, 20000, 30000,
  40000, 50000, 100000, 500000, 2000000,
];
const SWEEP = [
  ...Array.from({ length: 400 }, (_, i) => i * 1013),
  ...EDGES.flatMap((e) => [e - 1, e - 0.5, e, e + 0.5, e + 1]),
];

function expectSame(schedule: Schedule, formula: (x: number) => number) {
  for (const x of SWEEP) {
    expect(evaluateSchedule(schedule, x), `x = ${x}`).toBe(formula(x));
  }
}

describe("evaluateSchedule", () => {
  it("returns a flat value whatever x is", () => {
    const s = flat(2.5, "ROH Table 21-3.4");
    expect(evaluateSchedule(s, 0)).toBe(2.5);
    expect(evaluateSchedule(s, 1e9)).toBe(2.5);
  });

  it("returns 0 when no band holds x", () => {
    const s: Schedule = {
      bands: [{ upTo: 10, inclusive: true, base: 1 }],
      source: "test",
    };
    expect(evaluateSchedule(s, 11)).toBe(0);
  });
});

describe("schedules reproduce Honolulu's formulas exactly", () => {
  it("lot-scaled FAR, low-density apartment (Table 21-3.3, pre Ord. 26-7)", () => {
    const s: Schedule = {
      bands: [
        { upTo: 10000, inclusive: false, base: 0.3, rate: 0.00003 },
        { upTo: 40000, inclusive: true, base: 0.5, rate: 0.00001 },
        { upTo: null, inclusive: true, base: 0.9 },
      ],
      source: "ROH Table 21-3.3",
    };
    expectSame(s, (x) => calcFAR("A-1", x));
  });

  it("lot-scaled FAR, A-3 (four bands)", () => {
    const s: Schedule = {
      bands: [
        { upTo: 10000, inclusive: false, base: 0.6, rate: 0.00014 },
        { upTo: 20000, inclusive: true, base: 1.6, rate: 0.00004 },
        { upTo: 40000, inclusive: true, base: 2.0, rate: 0.00002 },
        { upTo: null, inclusive: true, base: 2.8 },
      ],
      source: "ROH Table 21-3.3",
    };
    expectSame(s, (x) => calcFAR("A-3", x));
  });

  it("tiered lot coverage, apartment districts", () => {
    const s: Schedule = {
      bands: [
        { upTo: 7500, inclusive: false, base: 0.6 },
        { upTo: 20000, inclusive: true, base: 0.5 },
        { upTo: null, inclusive: true, base: 0.4 },
      ],
      source: "ROH Table 21-3.3",
    };
    expectSame(s, (x) => lotCoverage("A-2", x));
  });

  it("building permit fee (Table 18-A)", () => {
    const s: Schedule = {
      bands: [
        { upTo: 500, inclusive: true, base: 20 },
        { upTo: 1000, inclusive: true, base: 8, rate: 2.5, per: 100 },
        { upTo: 20000, inclusive: true, base: 12, rate: 2.2, per: 100 },
        { upTo: 50000, inclusive: true, base: 82, rate: 18, per: 1000, over: 20000 },
        { upTo: 100000, inclusive: true, base: 286, rate: 14, per: 1000, over: 50000 },
        { upTo: 500000, inclusive: true, base: 700, rate: 10, per: 1000, over: 100000 },
        { upTo: 2000000, inclusive: true, base: 3200, rate: 5, per: 1000, over: 500000 },
        { upTo: null, inclusive: true, base: 4300, rate: 4.5, per: 1000, over: 2000000 },
      ],
      source: "ROH 18-7.5, Table 18-A",
    };
    expectSame(s, buildingPermitFee);
  });

  it("plan review fee: 10% of the permit fee, $200 to $25,000", () => {
    const s: Schedule = {
      bands: [{ upTo: null, inclusive: true, base: 0, rate: 0.1 }],
      min: 200,
      max: 25000,
      source: "ROH 18-6.1",
    };
    expectSame(s, planReviewFee);
  });

  it("grubbing permit (stepped)", () => {
    const s: Schedule = {
      bands: [
        { upTo: 15001, inclusive: false, base: 0 },
        { upTo: 16000, inclusive: true, base: 125 },
        { upTo: null, inclusive: true, base: 125, rate: 15, over: 16000, step: 1000 },
      ],
      source: "ROH 18A-2.4(b)",
    };
    expectSame(s, grubbingPermit);
  });

  it("grading permit (stepped)", () => {
    const s: Schedule = {
      bands: [
        { upTo: 1000, inclusive: true, base: 505, rate: 55, step: 100 },
        { upTo: 10000, inclusive: false, base: 1000, rate: 55, over: 1000, step: 1000 },
        { upTo: null, inclusive: true, base: 1495, rate: 35, over: 10000, step: 1000 },
      ],
      source: "ROH 18A-2.4",
    };
    expectSame(s, gradingPermit);
  });

  it("stockpiling permit (stepped)", () => {
    const s: Schedule = {
      bands: [
        { upTo: 101, inclusive: false, base: 0 },
        { upTo: 1100, inclusive: true, base: 70 },
        { upTo: null, inclusive: true, base: 70, rate: 15, over: 1100, step: 1000 },
      ],
      source: "ROH 18A-2.4(c)",
    };
    expectSame(s, stockpilingPermit);
  });
});

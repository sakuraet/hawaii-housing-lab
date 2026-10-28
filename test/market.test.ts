// Tests that rents, the cap rate, property tax and parking costs read the
// locality they are given (src/calculations/calc-shared.ts), and default to
// Honolulu.

import { describe, expect, it } from "vitest";

import {
  calcParkingIncome,
  calcPropertyTax,
  mixRentByAmi,
  podiumEnvelope,
  rentByAmi,
  resolveCapRate,
} from "../src/calculations/calc-shared";
import type { Locality } from "../src/core/locality";
import { honolulu } from "../src/localities/hi/honolulu";

const market = honolulu.assumptions.market;

// Honolulu with half the incomes, a different rent share, tax rate, cap rate
// and doubled parking costs
const other: Locality = {
  ...honolulu,
  id: "test-market",
  name: "Test County",
  state: { ...honolulu.state, affordable_rent_income_share: 0.25 },
  rules: {
    ...honolulu.rules,
    property_tax_rate: 0.01,
    income_limits: Object.fromEntries(
      Object.entries(honolulu.rules.income_limits).map(([ami, row]) => [ami, row.map((v) => v / 2)])
    ),
  },
  assumptions: {
    ...honolulu.assumptions,
    market: {
      ...market,
      cap_rate: 0.06,
      parking: {
        ...market.parking,
        cost_per_sqft: 2 * market.parking.cost_per_sqft,
        surface_cost_per_sqft: 2 * market.parking.surface_cost_per_sqft,
        monthly_rent_per_stall: 50,
      },
    },
  },
};

describe("rents read the locality's income limits and rent share", () => {
  it("a one-bedroom at 80% AMI", () => {
    // Honolulu: average of the 1- and 2-person 80% incomes x 30% / 12
    expect(rentByAmi("ami_80", "one_bb")).toBe(Math.floor((((85120 + 97280) / 2) * 0.3) / 12));
    expect(rentByAmi("ami_80", "one_bb", other)).toBe(
      Math.floor((((85120 + 97280) / 4) * 0.25) / 12)
    );
  });

  it("a unit mix", () => {
    expect(mixRentByAmi("ami_80", "one_bb_100", other)).toBe(rentByAmi("ami_80", "one_bb", other));
  });
});

describe("cap rate, property tax and parking", () => {
  it("cap rate: the slider override wins, else the locality's", () => {
    expect(resolveCapRate(undefined, other)).toBe(0.06);
    expect(resolveCapRate(0.07, other)).toBe(0.07);
    expect(resolveCapRate()).toBe(0.051);
  });

  it("property tax", () => {
    expect(calcPropertyTax(1_000_000, 4_000_000, false, other)).toBe(50_000);
    expect(calcPropertyTax(1_000_000, 4_000_000, true, other)).toBe(10_000);
    expect(calcPropertyTax(1_000_000, 4_000_000)).toBeCloseTo(17_500, 9);
  });

  it("parking income", () => {
    expect(calcParkingIncome(10, other)).toBe(10 * 50 * 12);
    expect(calcParkingIncome(10)).toBe(10 * 100 * 12);
  });

  it("parking cost in the building envelope", () => {
    const inputs = {
      plates: [8000, 8000, 8000, 8000],
      far_cap: 24000,
      retail_cap: 0,
      retail_share: 0,
      unit_size: 500,
      parking_ratio: 1,
    };
    const hnl = podiumEnvelope(inputs);
    const oth = podiumEnvelope({ ...inputs, loc: other });
    // same stall sizes, so the same layout at twice the cost
    expect(hnl.stalls).toBeGreaterThan(0);
    expect(oth.stalls).toBe(hnl.stalls);
    expect(hnl.parking_cost).toBeGreaterThan(0);
    expect(oth.parking_cost).toBeCloseTo(2 * hnl.parking_cost, 6);
  });
});

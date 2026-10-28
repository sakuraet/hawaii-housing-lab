// Tests that the parking, loading and bicycle parking functions read the
// locality they are given (src/calculations/calc-shared.ts), and default to
// Honolulu.

import { describe, expect, it } from "vitest";

import {
  article6Parking,
  bicycleRequired,
  bicycleSpaces,
  legalParkingRatio,
  loadingSpaces,
  loadingSqft,
} from "../src/calculations/calc-shared";
import type { Locality } from "../src/core/locality";
import { flat } from "../src/core/schedule";
import { honolulu } from "../src/localities/hi/honolulu";

// Honolulu with different parking rules, as another county might have
const other: Locality = {
  ...honolulu,
  id: "test-parking",
  name: "Test County",
  rules: {
    ...honolulu.rules,
    zones: {
      ...honolulu.rules.zones,
      "A-2": { ...honolulu.rules.zones["A-2"], bicycle_required: false },
    },
    parking: {
      residential_sqft_per_stall: 500,
      retail_sqft_per_stall: 250,
      joint_use: 0.8,
      source: "test",
    },
    loading: {
      min_lot_sqft: 10000,
      multifamily_spaces: flat(3, "test"),
      retail_spaces: flat(1, "test"),
      small_space_sqft: 100,
      large_space_sqft: 300,
      source: "test",
    },
    bicycle: {
      short_term: { units_per_space: 5, retail_sqft_per_space: 1000, stalls_per_space: 5 },
      long_term: { units_per_space: 1, retail_sqft_per_space: 6000, stalls_per_space: 15 },
      sqft_per_space: 20,
      source: "test",
    },
  },
};

describe("parking, loading and bicycle parking read the locality", () => {
  it("minimum stalls per unit", () => {
    // a 500 sqft one-bedroom: 1 per 1,000 sqft in Honolulu, 1 per 500 here
    expect(legalParkingRatio("one_bb_100")).toBe(0.5);
    expect(legalParkingRatio("one_bb_100", other)).toBe(1);
  });

  it("loading spaces and their area", () => {
    expect(loadingSpaces(100, 0)).toBe(1);
    // 3 + 1 at 80% joint use, rounded half up
    expect(loadingSpaces(100, 5000, 0.8, other)).toBe(3);
    expect(loadingSqft(1, other)).toBe(100);
    // 3 spaces: one large (a third, rounded), two small
    expect(loadingSqft(3, other)).toBe(300 + 2 * 100);
  });

  it("the Article 6 inputs", () => {
    expect(article6Parking(9000, false, other)).toEqual({
      retail_stalls_per_sqft: 1 / 250,
      joint_use: 0.8,
      loading: false,
      bicycle: true,
    });
    expect(article6Parking(9000).loading).toBe(true);
  });

  it("bicycle parking", () => {
    expect(bicycleRequired("A-2")).toBe(true);
    expect(bicycleRequired("A-2", other)).toBe(false);
    expect(bicycleRequired("I-2")).toBe(false);
    // a zone Honolulu's config does not list requires it
    expect(bicycleRequired("XYZ")).toBe(true);
    expect(bicycleSpaces(20, 0, 0, other)).toEqual({ short_term: 4, long_term: 20 });
    expect(bicycleSpaces(20, 0, 0)).toEqual({ short_term: 2, long_term: 10 });
  });
});

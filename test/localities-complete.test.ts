// Every county the model can run must have a complete config: no TODO or
// unfilled value left from the template, every rule sourced, schedules well
// formed (src/core/check.ts). A new county fails here until it is filled in;
// the message names each value still to do.

import { describe, expect, it } from "vitest";

import { checkLocality } from "../src/core/check";
import type { Locality } from "../src/core/locality";
import { getLocality, localityIds } from "../src/localities";
import { honolulu } from "../src/localities/hi/honolulu";

describe("every registered county's config is complete", () => {
  it.each(localityIds())("%s", (id) => {
    expect(checkLocality(getLocality(id))).toEqual([]);
  });
});

describe("the check catches an unfinished config", () => {
  // Honolulu as a new county would start: strict, with template leftovers
  const unfinished: Locality = JSON.parse(JSON.stringify(honolulu));
  unfinished.id = "hi-test";
  unfinished.unknown_zone = "error";
  unfinished.rules.zones["A-2"].commercial_coverage = Number.NaN;
  unfinished.rules.zones["A-2"].source = "TODO";
  unfinished.rules.zones["A-2"].lot_coverage.bill6 = { bands: [{ upTo: 7500, inclusive: false, base: 1.5 }], source: "" };
  unfinished.rules.income_limits = { ...unfinished.rules.income_limits, 80: [1, 2, 3] };
  unfinished.assumptions.timing.permitting_months = 0;
  const problems = checkLocality(unfinished);

  it.each([
    "rules.zones.A-2.commercial_coverage: not filled in",
    "rules.zones.A-2.source: still says TODO",
    "rules.zones.A-2.lot_coverage.bill6.source: no source given",
    "rules.zones.A-2.lot_coverage.bill6.bands: the last band needs upTo: null",
    "rules.zones.A-2.lot_coverage.bill6.bands[0].base: 1.5 is a share",
    "rules.income_limits.80: needs 8 household sizes, has 3",
    "assumptions.timing.permitting_months: must be more than 0",
  ])("%s", (expected) => {
    expect(problems.some((p) => p.startsWith(`hi-test ${expected}`))).toBe(true);
  });

  it("a strict county needs current-zoning FAR in every zone", () => {
    // Honolulu's resort and industrial zones have none under Ord. 26-7
    expect(problems).toContain("hi-test rules.zones.Resort.far.bill6: missing");
  });

  it("a bad id is caught", () => {
    expect(checkLocality({ ...honolulu, id: "Maui" })).toContain(
      'Maui id: should be a state code and a place, like "hi-maui"'
    );
  });
});

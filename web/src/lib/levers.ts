// lever state shared by the map and a parcel's full page

import { useCallback, useState } from "react";
import {
  countyParkingRatio,
  GRANT,
  legalParkingRatio,
  type ParcelOutput,
} from "feasim-challenge";

import type { ParcelRow } from "@/lib/parcels";
import { factorKeysFor } from "@/components/control-panel";
import {
  BILL6_DEFAULTS,
  defaultsFor,
  PROGRAM_DEFAULTS,
  type GaugeInputs,
} from "@/localities/honolulu/pathway-defaults";

export { BILL6_DEFAULTS, defaultsFor, PROGRAM_DEFAULTS };

// unlocked grant amount follows the grant type's statutory award (same rule
// as the calculator)
const statutoryGrantFor = (s: GaugeInputs) =>
  s.grant_type === "pre_construct" ? GRANT.pre_construct : GRANT.post_construct;

const scenarioIn = (s: GaugeInputs) => s.scenario ?? "baseline";

const defaultValueFor = <K extends keyof GaugeInputs>(
  key: K,
  state: GaugeInputs,
  county?: string
): GaugeInputs[K] => {
  if (key === "grant_amount")
    return statutoryGrantFor(state) as GaugeInputs[K];
  return defaultsFor(scenarioIn(state), county)[key];
};

/** levers in `inputs` that differ from their scenario's defaults */
function locksIn(inputs: GaugeInputs, county?: string): Partial<GaugeInputs> {
  const locks: Partial<GaugeInputs> = {};
  for (const key of factorKeysFor(inputs.program)) {
    if (
      inputs[key] !== undefined &&
      inputs[key] !== defaultValueFor(key, inputs, county)
    )
      locks[key] = inputs[key] as never;
  }
  return locks;
}

/**
 * lever values and locks; `initial` opens on a scenario with its changes
 * locked. The defaults are `county`'s, which only differ outside Honolulu
 */
export function useLevers(initial?: GaugeInputs, county?: string) {
  const [inputs, setInputs] = useState<GaugeInputs>(
    () => initial ?? defaultsFor("baseline", county)
  );

  // levers moved off their default: shown orange and kept across scenario
  // switches (like `modified` in the calculator)
  const [modified, setModified] = useState<Partial<GaugeInputs>>(() =>
    initial ? locksIn(initial, county) : {}
  );

  // every lever edit: locks it, or unlocks it when back at its default
  const setFactor = <K extends keyof GaugeInputs>(
    key: K,
    value: GaugeInputs[K]
  ) => {
    // a new grant type moves an unlocked grant amount with it
    const followGrant =
      key === "grant_type" && modified.grant_amount === undefined;
    const nextGrantAmount = followGrant
      ? statutoryGrantFor({
          ...inputs,
          grant_type: value as GaugeInputs["grant_type"],
        })
      : undefined;

    setInputs((prev) => ({
      ...prev,
      [key]: value,
      ...(nextGrantAmount !== undefined
        ? { grant_amount: nextGrantAmount }
        : {}),
    }));
    setModified((prev) => {
      const next = { ...prev };
      if (value === defaultValueFor(key, inputs, county)) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // scenario switch: load its defaults (which pick its pathway), then reapply
  // the locks it shows (locks are kept until reset, even for levers a pathway
  // hides)
  const handleInputsChange: React.Dispatch<
    React.SetStateAction<GaugeInputs>
  > = (action) => {
    setInputs((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      if (scenarioIn(next) !== scenarioIn(prev)) {
        const defaults = defaultsFor(scenarioIn(next), county);
        const keys = factorKeysFor(defaults.program);
        const carried: Partial<GaugeInputs> = {};
        for (const key of Object.keys(modified) as (keyof GaugeInputs)[]) {
          if (keys.has(key)) carried[key] = modified[key] as never;
        }
        return { ...defaults, ...carried };
      }
      return next;
    });
  };

  const handleReset = () => {
    setInputs(defaultsFor(scenarioIn(inputs), county));
    setModified({});
  };

  // a county switch: the scenario's defaults there (TOD runs Honolulu's TOD
  // pathway only on Oʻahu), with the locks kept (a lock now at the new
  // county's default is a lock no more)
  const changeCounty = (next: string) => {
    const rebased = {
      ...defaultsFor(scenarioIn(inputs), next),
      ...modified,
    };
    setInputs(rebased);
    setModified(locksIn(rebased, next));
  };

  // set a whole scenario at once
  const restore = useCallback((scenario: GaugeInputs) => {
    setInputs(scenario);
    setModified(locksIn(scenario, county));
  }, [county]);

  // locks on this pathway's levers, for the badge
  const lockCount = Object.keys(modified).filter((key) =>
    factorKeysFor(inputs.program).has(key as keyof GaugeInputs)
  ).length;

  return {
    inputs,
    modified,
    setFactor,
    handleInputsChange,
    handleReset,
    changeCounty,
    restore,
    lockCount,
  };
}

/**
 * parcel values for levers with no fixed default: cap rate; also the legal
 * parking minimum, which outside Honolulu is the parking lever's value until
 * it is moved, and in Honolulu is the Article 6 minimum (0 if exempt,
 * § 21-6.20(a)) for the below-minimum warning
 */
export function derivedLevers(
  inputs: GaugeInputs,
  parcel: { row: ParcelRow; result: ParcelOutput } | null,
  county?: string
): Partial<GaugeInputs> {
  const otherCounty = county !== undefined && county !== "hi-honolulu";
  const parking: Partial<GaugeInputs> = otherCounty
    ? {
        parking_ratio: countyParkingRatio(
          inputs.unit_type ?? defaultsFor(scenarioIn(inputs), county).unit_type ?? "one_bb_100",
          county
        ),
      }
    : inputs.program === "bill6" ||
    inputs.program === "standard" ||
    inputs.program === "h201"
      ? {
          parking_ratio: parcel?.row.parking_exempt
            ? 0
            : legalParkingRatio(inputs.unit_type ?? "one_bb_100"),
        }
      : {};
  if (!parcel) return parking;
  return {
    ...parking,
    cap_rate: parcel.result.cap_rate,
  };
}

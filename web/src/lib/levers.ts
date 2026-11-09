// lever state shared by the map and a parcel's full page

import { useCallback, useState } from "react";
import {
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

const defaultValueFor = <K extends keyof GaugeInputs>(
  key: K,
  state: GaugeInputs
): GaugeInputs[K] => {
  if (key === "grant_amount")
    return statutoryGrantFor(state) as GaugeInputs[K];
  return defaultsFor(state.program)[key];
};

/** levers in `inputs` that differ from their pathway's defaults */
function locksIn(inputs: GaugeInputs): Partial<GaugeInputs> {
  const locks: Partial<GaugeInputs> = {};
  for (const key of factorKeysFor(inputs.program)) {
    if (
      inputs[key] !== undefined &&
      inputs[key] !== defaultValueFor(key, inputs)
    )
      locks[key] = inputs[key] as never;
  }
  return locks;
}

/** lever values and locks; `initial` opens on a scenario with its changes locked */
export function useLevers(initial?: GaugeInputs) {
  const [inputs, setInputs] = useState<GaugeInputs>(
    () => initial ?? BILL6_DEFAULTS
  );

  // levers moved off their default: shown orange and kept across pathway
  // switches (like `modified` in the calculator)
  const [modified, setModified] = useState<Partial<GaugeInputs>>(() =>
    initial ? locksIn(initial) : {}
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
      if (value === defaultValueFor(key, inputs)) delete next[key];
      else next[key] = value;
      return next;
    });
  };

  // pathway switch: load its defaults, then reapply the locks it shows
  // (locks are kept until reset, even for levers a pathway hides)
  const handleInputsChange: React.Dispatch<
    React.SetStateAction<GaugeInputs>
  > = (action) => {
    setInputs((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      if (next.program !== prev.program) {
        const defaults = defaultsFor(next.program);
        const keys = factorKeysFor(next.program);
        const carried: Partial<GaugeInputs> = {};
        for (const key of Object.keys(modified) as (keyof GaugeInputs)[]) {
          if (keys.has(key)) carried[key] = modified[key] as never;
        }
        return { ...defaults, ...carried, program: next.program };
      }
      return next;
    });
  };

  const handleReset = () => {
    setInputs(defaultsFor(inputs.program));
    setModified({});
  };

  // set a whole scenario at once
  const restore = useCallback((scenario: GaugeInputs) => {
    setInputs(scenario);
    setModified(locksIn(scenario));
  }, []);

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
    restore,
    lockCount,
  };
}

/**
 * parcel values for levers with no fixed default: cap rate; also the Article 6
 * parking minimum (0 if exempt, § 21-6.20(a)) for the
 * below-minimum warning
 */
export function derivedLevers(
  inputs: GaugeInputs,
  parcel: { row: ParcelRow; result: ParcelOutput } | null
): Partial<GaugeInputs> {
  const parking: Partial<GaugeInputs> =
    inputs.program === "bill6" ||
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

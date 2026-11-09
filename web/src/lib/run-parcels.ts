// run-gauge.ts — runs a program's calculator on every parcel, and avoids
// redoing work
//
// Running the calculator on all ~10k parcels takes a noticeable moment, so this
// file saves time in two ways:
//
// 1. Parcels with the same zone, lot size and height get the same answer, so
//    we only calculate each combination once
//
// 2. We remember the last few full runs. If you go back to a scenario you've
//    already seen (Reset, moving a lever back, switching back to a program),
//    we reuse the saved results instead of calculating again.

import type { ParcelOutput } from "feasim-challenge";

import type { GaugeInputs } from "@/localities/honolulu/pathway-defaults";
import type { ParcelRow } from "@/lib/parcels";

// One parcel paired with its calculated result.
export interface ParcelResult {
  parcel: ParcelRow;
  result: ParcelOutput;
}

// The shape of a program's calculator: takes a parcel and the slider values,
// returns that parcel's result.
type Calc = (p: ParcelRow, s: GaugeInputs) => ParcelOutput;

// How many full runs to remember. Each one holds ~10k results, so keep it small.
const MAX_CACHED_PASSES = 8;
// Saved full runs, keyed by program + slider values.
const passes = new Map<string, ParcelResult[]>();

// Builds a label from the only parcel details the calculators use. Two parcels
// with the same label get the same result.
// If a calculator ever starts using another parcel field, add it here —
// otherwise parcels will be handed another parcel's result.
const envelopeKey = (p: ParcelRow) =>
  [
    p.zone_class,
    p.lot_sqft,
    p.height,
    p.parking_exempt,
    p.tod_regime,
  ].join("|");

// Turns the slider values into a text label for the cache. The keys are
// sorted so the same values always make the same label, whatever order
// they were written in.
const inputsKey = (s: GaugeInputs) => JSON.stringify(s, Object.keys(s).sort());

// Calculates results for every parcel in a program.
// First checks if this exact scenario was run recently and reuses it if so.
// Otherwise it runs the calculator, reusing answers for repeat parcels, and
// saves the run for next time.
export function runGauge(
  dataKey: string,
  parcels: ParcelRow[],
  inputs: GaugeInputs,
  calc: Calc
): ParcelResult[] {
  // Have we run this exact scenario recently? If so, reuse it.
  const key = `${dataKey}|${inputsKey(inputs)}`;
  const hit = passes.get(key);
  if (hit) {
    // move it to the back of the line so it counts as "recently used"
    passes.delete(key);
    passes.set(key, hit);
    return hit;
  }

  // Not saved — calculate every parcel, reusing answers for repeat parcels.
  const byEnvelope = new Map<string, ParcelOutput>();
  const out = parcels.map((parcel) => {
    const env = envelopeKey(parcel);
    let shared = byEnvelope.get(env);
    if (!shared) {
      // first parcel with this zone / lot size / height: run the calculator
      shared = calc(parcel, inputs);
      byEnvelope.set(env, shared);
      return { parcel, result: shared };
    }
    // repeat: copy the earlier answer, but with this parcel's own ID
    return { parcel, result: { ...shared, tmk: parcel.tmk } };
  });

  // Save this run. If we're over the limit, drop the oldest one
  // (a Map keeps things in the order they were added, so the first is oldest).
  passes.set(key, out);
  if (passes.size > MAX_CACHED_PASSES) {
    passes.delete(passes.keys().next().value!);
  }
  return out;
}

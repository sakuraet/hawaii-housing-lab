# Scenario layer: design

How the model goes from "does this parcel pencil?" to "how many more homes
would Hawaiʻi get over five years under this policy?". This is the piece the
challenge scores: a statewide, five-year estimate against a baseline, for the
baseline and at least three of the five benchmark scenarios, with ranges.

Status: design only. Nothing here is built yet.

## Where this sits

```
parcels (all four counties)
   │
   ▼
scenario layer      a scenario rewrites a parcel's rules and levers
   │                (src/scenarios)
   ▼
parcel engine       calcParcel(): the pro forma, feasibility (exists)
   │                (src/calculations, src/parcels.ts, src/feasibility.ts)
   ▼
production layer    feasibility → expected units started in 5 years
   │                (src/production)
   ▼
aggregation         county → state; baseline vs scenario; P10/P50/P90
```

The parcel engine does not change shape. Each benchmark scenario becomes a
transformation of what the engine is given (a parcel, its county's rules,
and levers), so every county runs the same scenario code through the same
`current` pathway.

## Honolulu's pathways

Bill 7, TOD (PD-T / IPD-T), 201H, Standard and Waikīkī are Oʻahu law. They
stay as they are. The statewide benchmark runs never call them; they run
`current` plus a scenario's overrides in every county, Honolulu included.

Honolulu's own ordinances become **Oʻahu policy variants** shown beside the
benchmark: for example, the benchmark TOD scenario next to Honolulu's actual
TOD rules on the same parcels. The challenge welcomes state-specific
scenarios, and this is where the existing work shows up. No refactor of
`calc-bill7`, `calc-tod`, `calc-h201` or `calc-standard` is needed.

## Scenarios

A scenario is data plus two small functions:

```ts
interface Scenario {
  id: ScenarioId; // "baseline" | "fees" | "parking" | "missing_middle" | "tod" | "adu"
  name: string;
  /** what it changes, for a policymaker */
  description: string;
  /** the parcels it can apply to; the rest keep the baseline result */
  applies(parcel: StatewideParcel, loc: Locality): boolean;
  /** the runs to try on an eligible parcel; the best one (highest RLV
   *  margin) is the parcel's result */
  runs(parcel: StatewideParcel, loc: Locality, a: ScenarioAssumptions): ScenarioRun[];
}

interface ScenarioRun {
  /** the county's rules as the policy would leave them */
  locality: Locality;
  parcel: Parcel;
  levers: Partial<SliderInputs>;
  /** "redevelop" = the whole-lot pro forma; "adu" = the ADU add-on */
  kind: "redevelop" | "adu";
}
```

Rewriting a copy of the county's `Locality` (not the engine) keeps each
policy readable as a rule change: "parking minimum 0", "fees × 0.5". Each
copy is registered under a derived id (`hi-maui~parking`) so the engine
reads it the way it reads any county.

**Which scenarios:** the baseline plus fees, parking and transit-oriented
density, the three the challenge requires. All of them run on parcels in zones
that allow multi-family housing. ADUs and missing middle are set aside for now;
their designs stay below in case they come back.

### Baseline

Current zoning in every county, as the configs set it: `current` with
`DEFAULT_INPUTS.current`. The parcels it covers are those whose zone allows
multi-family by right (the zones the configs list). Production is calibrated
to recent permits (see Production). Single-family production is not modeled,
and the results have to say so.

### 1. Development fee reduction

The shared assumption is $50,000 per unit in fees. Two versions, both
reported:

- **Benchmark:** the baseline's fee lines are replaced by $50,000 per unit,
  and the scenario by $25,000. Comparable with other submissions.
- **Hawaiʻi fees:** each county's modeled fees (building permit, plan review,
  sewer, water, park, grading, the rest of `SoftCostBreakdown`) × 0.5.
  Shows that modeled Hawaiʻi fees are often well under or over $50,000.

Engine change: one lever, `fee_scale` (default 1), applied to the fee lines
in `calcSoftCosts`, and one, `fee_per_unit`, that replaces them. Construction
management and other non-fee soft costs are not scaled.

### 2. Parking requirement reduction

Minimums go to 0 in every zone (`residential_stalls_per_unit: 0` /
`residential_sqft_per_stall: Infinity`, zone overrides cleared).

Developers still build parking where it pays. The scenario sets
`parking_ratio` to the lesser of the old minimum and a **market ratio**, an
assumption by county (central guess for Honolulu's urban core lower than for
the neighbor islands, where most trips are by car), varied 0 to 1.5 in the
sensitivity runs. Engine change: none (`parking_ratio` exists).

### 3. Missing middle (set aside for now)

2 to 6 units on parcels zoned single-family, up to 3 stories; setbacks and
coverage do not bind (the spec allows this).

- Runs `current` at 2, 3, 4, 5 and 6 units, height 3 stories (35 ft), and
  keeps the run with the best margin.
- Coverage and yards are lifted: the run's zone is a copy with
  `lot_coverage: 1` and no `yards`, `setback: 0`.
- Low-rise construction: walk-up wood frame, so a lower `hard_cost_per_sqft`
  than the mid-rise default and no elevator; an assumption, varied.
- The lot has a house on it, so the land cost is the parcel's **total**
  assessed value (land + building) plus demolition, not land alone.
- Net new units = units built − 1 (the house removed).

Engine changes:
- Single-family zones in each county config, tagged `single_family: true`
  with `residential_permitted: false`, so the baseline skips them and this
  scenario finds them. Today they are not listed, and a parcel in one stops
  with an error.
- Land cost from the parcel's assessed value, not the flat `land_cost` per
  sqft: `landCostPerSqft(parcel, "total")` in `src/scenarios/parcels.ts`,
  passed as `land_cost`. Every calculator multiplies `land_cost` by the lot
  area, so this needs no engine change. Every scenario uses it ("land" for
  vacant or underused lots), so the baseline is judged the same way.
- A `max_units` lever on `current` (it already takes a unit cap internally).

### 4. Transit-oriented density

- **Major transit stop:** a rail station, or a bus stop with service every
  15 minutes or better at peak. Only Oʻahu has rail; on the neighbor islands
  the few frequent bus corridors qualify, so the scenario adds little there,
  which is itself a finding.
- **Threshold:** ½ mile (about a 10-minute walk), the usual walkshed;
  ¼ mile is a sensitivity case.
- **Within it:** height × 1.5 (at least 65 ft), FAR or density × 2 (density
  limit lifted where the code sets units per acre), parking minimum 0 with
  the market ratio as above. Applies to zones already allowing multi-family.
  Single-family zones near stops are left out while missing middle is set
  aside.

On Oʻahu, Honolulu's actual TOD pathway runs on the same parcels as a policy
variant for comparison.

Parcel data needs a distance to the nearest major stop.

### 5. ADUs (set aside for now)

One ADU on parcels with a single-family house; 600 sqft or more, detached or
attached; no added parking.

This is not a redevelopment, so it gets its own small pro forma
(`calcAdu`, `kind: "adu"`):

- cost: 600 sqft × an ADU hard cost per sqft, plus the county's fees for one
  unit (building permit, sewer, water), plus soft costs;
- value: the ADU's rent at the county's market rent, capitalized;
- feasible when value ≥ cost × (1 + a homeowner hurdle).

Every county already allows some form of ADU or ʻohana unit today, so the
baseline must include the ADUs current rules allow, and the scenario's gain
is the change (size floor, parking, owner-occupancy, lot-size limits).
Homeowner take-up is low and uncertain, so ADUs get their own take-up rate
with a wide range.

## Production: from feasibility to units

The engine says whether a project pencils, not whether it gets built. Over
five years only some feasible parcels redevelop.

For each parcel and scenario:

```
margin   = residual land value / current property value
P(start within 5 years) = base_rate[county, kind] × curve(margin)
expected units = P × net new units
```

- `curve` is logistic around a margin of 1 (a developer can pay what the
  owner would accept): near 0 well below, near 1 well above. Its steepness is
  an assumption, varied.
- `base_rate` is calibrated once per county so the **baseline** reproduces
  recent permitted multi-family units over five years. Scenarios then move
  units only through the margin, never the calibration.
- If ADUs or missing middle come back, those parcels (owner-held houses) get
  their own base rates, calibrated where the county has recent ADU permits
  and an assumption where it does not.

**Housing outcome:** units started (permitted) within five years. Permits
are what the calibration target counts, and the model's 18 months of
permitting plus 12 of construction would push many completions past year
five.

Expected values, not parcel predictions: the challenge deprioritizes parcel
precision, and the output says so.

## Uncertainty and sensitivity

- **Ranges:** Monte Carlo over the assumptions most likely to move results:
  hard cost, rent, cap rate, interest rate, market parking ratio, curve
  steepness, base rate (from its calibration error). Seeded, so runs
  reproduce. Report P10 / P50 / P90 of units and of the change from
  baseline, by county and state.
- **Drivers:** one-at-a-time swings of each assumption (a tornado chart), so
  the deck and the comparison paper can say what moves each scenario.
- **What the model cannot tell:** demand limits (absorption across many
  projects at once), construction labor capacity, infrastructure (sewer and
  water capacity, which binds on the neighbor islands), land assembly,
  community opposition, and price effects of the new supply. Written up per
  scenario.

## Data the layer needs

A statewide parcel table, one row per parcel, with: county (locality id),
TMK, lot area, zone, height limit, land and building assessed values, and
distance to the nearest major transit stop. Plus recent permitted units by
county for the calibration. Existing use and units are only needed to find
single-family houses, so they can wait while ADUs and missing middle are set
aside.

Raw data stays out of the repo (`data/` is ignored); a script fetches and
cleans it, and `data/sample/` holds a small sample so tests and the demo run
from a clean checkout. Provenance goes in `docs/DATA_PROVENANCE.md`.

## Code layout

```
src/scenarios/
  types.ts           Scenario, ScenarioRun, ScenarioAssumptions, StatewideParcel
  baseline.ts        fees.ts  parking.ts  missing-middle.ts  tod.ts  adu.ts
  derive.ts          copy a Locality with rule changes, under a derived id
  index.ts           SCENARIOS registry
src/production/
  takeup.ts          curve(), base rates, calibration
  run.ts             runScenario(parcels, scenario, draw) → ParcelResult[]
  aggregate.ts       county and state totals, deltas vs baseline
  uncertainty.ts     seeded draws, P10/P50/P90, tornado
src/calculations/
  calc-adu.ts        the ADU pro forma
```

`missing-middle.ts`, `adu.ts` and `calc-adu.ts` wait until those scenarios come
back.

Engine changes, all small and opt-in (defaults leave every current result
unchanged): `fee_scale` and `fee_per_unit`. If missing middle or ADUs come back:
`max_units` on `current`; `single_family` zone tag and single-family zones in
the configs; `calcAdu`.

## Tests

- each scenario's transformation: the derived rules are what the policy says
  (parking 0, fees halved, ½-mile eligibility);
- direction: on a fixed set of parcels, fee and parking cuts never lower
  feasible units; TOD only changes parcels inside the threshold;
- calibration: the baseline reproduces its target in each county;
- aggregation: county totals sum to the state; the same seed gives the same
  P10/P50/P90;
- a clean-checkout run on `data/sample/`.

## Order of work

Seven weeks to December 16, 2026.

1. Parcel table and sample for all four counties; land cost from assessed
   value. Done: `src/scenarios/parcels.ts`, `data/sample/parcels.csv`.
2. Production layer and aggregation with the baseline; calibrate.
3. Fees and parking, the two cheapest scenarios (their levers mostly exist).
4. TOD, the third benchmark: distance to the nearest major stop for each
   parcel.
5. Uncertainty and the tornado.
6. The Oʻahu policy variants beside the benchmarks, as time allows.
7. Tool UI, docs, deck and video on the results.

## Decisions to make

- Housing outcome: units permitted within five years (recommended) or
  completions.
- Fee scenario: report both versions (recommended), or only the benchmark.
- Market parking ratios by county, and their range.
- What to use for current property value in the margin while assessed values
  are blank. Today it would be the default land cost, which is Oʻahu's.

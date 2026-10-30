# Adding a county

The model reads every county's zoning, parking, fee and market figures from that county's config files. Adding a county means filling in those files, not changing the model. Honolulu's config (`src/localities/hi/honolulu/`) is a full worked example.

New counties run the current-zoning pathway (`current`) only. In Honolulu, `current` is the same as `bill6`, Honolulu's name for its current zoning (Ord. 26-7).

## 1. Copy the template

Copy `templates/locality/` to `src/localities/hi/<county>/`, for example `src/localities/hi/maui/`. It has four files:

| File | What goes in it | Kind |
| ---- | --------------- | ---- |
| `zones.ts` | Each zoning district that allows multifamily housing: FAR, lot coverage, ground-floor commercial share, step-backs, open space | Rules (law) |
| `rules.ts` | Parking minimums, loading, bicycle parking, permit and impact fees, water charges, property tax rate, HHFDC income limits | Rules (law) |
| `assumptions.ts` | Permitting and construction months, excavation depth, cap rate, vacancy, cost and rent growth, parking costs | Estimates |
| `index.ts` | The county's id and name, and the pieces above put together | — |

## 2. Fill in every TODO

- Every number starts as `TODO` and every source as `"TODO"`.
- Replace each source with where the figure comes from, for example `"MCC 19.12.030"` or a fee schedule's title and year.
- Units are in the comments: shares are 0 to 1 (60% = 0.6), areas are sqft, money is dollars.
- A figure that changes with lot size, project size or value is a schedule with one band per range; `zones.ts` explains the format.
- Set each district's density the way its code does, in `current`: `far` (a floor area ratio), `lot_area_per_unit` (sqft of lot per dwelling, as in "one unit per 3,000 sqft"), both (the stricter governs), or neither (height and coverage alone). Delete the one the code doesn't use. For units per acre, `lot_area_per_unit` is 43,560 over the units; where the code counts a fraction of a unit from some share (Kauaʻi: 65%), set `current.units_round_up_at`.
- If the code sets yards, add them to `current.yards` (front, rear, side, any side yard added per story, and any side and rear yard set as a share of the building's height); otherwise the model's 10 ft setback applies on every side. A zone with its own parking minimum sets `current.residential_stalls_per_unit`.
- Zone keys must match the zone codes in the county's parcel data exactly, including capitals and hyphens.
- If the code doesn't have a rule the template asks for, use the value that means "none" (for example `1` for no joint-use reduction) and say so in the source.
- In `index.ts`, set `id` to `"hi-<county>"`, `name` to the official name, and rename `county` to the county's name (for example `maui`).

## 3. Register the county

In `src/localities/index.ts`, import the county and add it to the list:

```ts
import { maui } from "./hi/maui";

const LOCALITIES = new Map<string, Locality>([
  [honolulu.id, honolulu],
  [maui.id, maui],
]);
```

## 4. Check it

```sh
npm test
```

`test/localities-complete.test.ts` checks every registered county and lists each value still to do, by its path, for example:

```
hi-maui rules.zones.A-2.current.far.bands[0].base: not filled in
hi-maui rules.parking.joint_use: not filled in
hi-maui rules.fees.building_permit.source: still says TODO
```

It also checks that every source is given, that schedules cover every value, that shares are between 0 and 1, that every zone has current-zoning rules with a lot coverage, and that a lot area per unit is more than 0. Work through the list until the test passes.

## 5. Add test parcels

Add a few of the county's real parcels with `locality: "hi-<county>"`, and work out by hand what at least one of them should get (FAR, buildable area, parking stalls). A test that checks those figures is what shows the county's rules are right, not only complete.

## Running a parcel in the county

A parcel names its county with `locality`:

```ts
calcParcel("current", { lot_sqft: 20000, zone_class: "A-2", height: 45, locality: "hi-maui" });
```

A zone the county's config does not list stops the run with an error, so a missing district is noticed.

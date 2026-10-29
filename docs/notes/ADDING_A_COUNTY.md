# Adding a county

The model reads every county's zoning, parking, fee and market figures from that county's config files. Adding a county means filling in those files, not changing the model. Honolulu's config (`src/localities/hi/honolulu/`) is a full worked example.

New counties run the current-zoning pathway (`bill6`) only.

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
hi-maui rules.zones.A-2.far.bill6.bands[0].base: not filled in
hi-maui rules.parking.joint_use: not filled in
hi-maui rules.fees.building_permit.source: still says TODO
```

It also checks that every source is given, that schedules cover every value, that shares are between 0 and 1, and that every zone has a current-zoning FAR and lot coverage. Work through the list until the test passes.

## 5. Add test parcels

Add a few of the county's real parcels with `locality: "hi-<county>"`, and work out by hand what at least one of them should get (FAR, buildable area, parking stalls). A test that checks those figures is what shows the county's rules are right, not only complete.

## Running a parcel in the county

A parcel names its county with `locality`:

```ts
calcParcel("bill6", { lot_sqft: 20000, zone_class: "A-2", height: 45, locality: "hi-maui" });
```

A zone the county's config does not list stops the run with an error, so a missing district is noticed.

# Scripts

Command-line scripts that build the parcel table and run it through the engine. The engine in `src/` and the tool in `web/` only read what these scripts produce, so they stay separate from how the data is gathered.

| Script | What it does |
| --- | --- |
| `run-parcels.mjs` | Runs a parcel table through the engine on current zoning and writes the results to `out/parcel-runs/` |
| `build-parcels.mjs` | Combines O ªahu's parcels and the neighbor-island export into one parcel table |
| Data collection scripts | To be added: see [Collecting the data](#collecting-the-data) |

## Collecting the data

The scripts that collect and clean the data the model runs on go in this folder:

- Scripts that download each dataset from its original source and clean it.
- The script that joins the datasets into the parcel table.
- The environment file for these scripts, such as `scripts/environment.yml`, with versions pinned.

Subfolders are up to whoever writes the scripts.

### What they have to produce

One table at `data/parcels_statewide.csv`, one row per parcel, in all four counties. All of these columns must be in the header, in any order, and any extra columns are ignored:

| Column | Meaning | Required |
| --- | --- | --- |
| `locality` | County id: `hi-honolulu`, `hi-maui`, `hi-hawaii` or `hi-kauai` | Yes |
| `tmk` | 9-digit state TMK, leading zeros kept | Yes |
| `lot_sqft` | Lot area in square feet | Yes |
| `zone_class` | Zoning district, as the zoning data writes it | Yes |
| `height` | Height limit in feet; 0 if not known | Yes |
| `land_value` | Assessed land value in dollars | No |
| `building_value` | Assessed building value in dollars | No |
| `existing_use` | One of `EXISTING_USES` in `src/scenarios/parcels.ts` | No |
| `existing_units` | Dwelling units on the parcel now | No |
| `transit_distance_mi` | Miles to the nearest major transit stop | No |
| `parking_exempt` | `true` or `false` | No |

Leave a cell blank where the value isn't known. Fields can't contain quotes or commas. `src/scenarios/parcels.ts` is the source of truth for this format.

### Checking a table

Run these from the repo root:

```bash
npm run build
```

```bash
node scripts/run-parcels.mjs data/parcels_statewide.csv
```

`out/parcel-runs/problems.txt` lists any rows the parser rejected, and `not_modeled.csv` lists zones with no rules in the county configs. Git ignores `out/`.

### Rules

These come from the challenge's [Official Rules](https://housingchallenge.turnout.rocks/rules.html):

- **No large source datasets in the repo.** The scripts download them. Git already ignores everything in `data/` except `data/sample/`.
- **The download has to be automated,** with as little manual work as possible, and documented with one command in this README.
- **Every dataset needs a record in `docs/DATA_PROVENANCE.md`:** source, version, access date, license or terms, and cleaning steps. Check each dataset's terms before using it.
- **Leave out what the model doesn't need,** such as owner names.

### How to run it

To be filled in with the command that builds the table from a clean checkout.

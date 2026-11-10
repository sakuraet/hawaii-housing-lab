# Scripts

Scripts that build the tool's data from public sources and run it through the engine. The engine in `src/` and the tool in `web/` only read what these scripts produce, so they stay separate from how the data is gathered.

## Building the data

One command builds everything, from a clean checkout. Run it from the repo root.

1. Set up the Python environment once (conda or [Miniforge](https://conda-forge.org/download/)):

   ```bash
   conda env create -f scripts/environment.yml
   ```

   Or, with Python 3.12 and pip, `pip install -r scripts/requirements.txt`, which pins the same versions. Dependabot watches `requirements.txt`; keep the two files in step when it updates one.

2. Install the engine's dependencies once:

   ```bash
   npm ci
   ```

3. Build the data, with the environment active:

   ```bash
   conda activate feasim-data
   ```

   ```bash
   python scripts/build_data.py
   ```

It downloads about 300 MB and writes the parcel table and the map files. To rerun from a later step, reusing the earlier steps' files, add `--from <step>`, for example `python scripts/build_data.py --from 4`.

| Step | Script | What it does | Writes |
| --- | --- | --- | --- |
| 1 | `fetch_data.py` | Downloads the statewide parcel layer and the four counties' zoning layers from the Hawaiʻi Statewide GIS Program, and Honolulu's zoning map height limits from the City's open data | `data/gis/<layer>/`, each with a `SOURCE.md` |
| 2 | `clean_parcels.py` | Repairs invalid parcel shapes and merges rows that share a TMK | `data/gis/parcels/parcels_clean.gpkg` |
| 3 | `clean_zoning.py` | Repairs the zoning layers and uses each county code's district names | `data/gis/zoning_clean.gpkg` |
| 4 | `join_zoning.py` | Gives each parcel the district covering most of it, applies Hawaiʻi County's recent rezonings, and adds Maui's community plan area and Honolulu's mapped height | `data/joined/parcels_zoning.gpkg` |
| 5 | `export_parcels.py` | Writes the parcel table the engine runs, with each parcel's height limit from `zone_heights.csv` | `data/parcels_statewide.csv` |
| 6 | `run-parcels.mjs` | Builds the engine and runs every parcel on current zoning | `out/parcel-runs/` |
| 7 | `export_map.py` | Writes each county's parcel positions and lot outlines for the map, for the parcels the engine runs (Honolulu: its apartment, mixed-use and Waikīkī districts) | `web/public/data/parcels-<county>.json`, `parcel-shapes-<county>.json` |

Git ignores everything these steps write. `common.py` holds the paths they share.

### Inputs kept in git

`scripts/inputs/` holds the inputs that aren't downloaded:

- `hawaii_map_amendments.csv`: Hawaiʻi County zoning-map amendments since 2023, transcribed from the Annex to the County Code (Chapter 25). The join applies them where the county's zoning layer is older than the rezoning.
- `zone_heights.csv`: each district's height limit, from the county codes, with the section for each row. The first row whose county, zone pattern (`RM-*` matches every RM district; `CG*` also matches Kauaʻi's overlay labels such as `CG/ST-P`) and area match a parcel sets its height. The areas:
  - `hilo`: the City of Hilo, approximated as TMK zone 2 (the South Hilo district);
  - `keauhou-kahaluu`: Keauhou and Kahaluʻu Bays, approximated as TMK zone 7, section 8;
  - `west-maui` and `hana`: Maui community plan areas, from the Maui zoning layer;
  - `lanai` and `molokai`: the parcel's island;
  - `height-map`: Honolulu, where the zoning maps and special districts set heights. The parcel takes the first number of the label covering most of it (`25' (150')` is 25 ft; the bracketed figure is the transit-oriented bonus height). This row comes first because the map can raise a district's base height: some A-1 parcels in the Punchbowl and transit-oriented special districts, and in recent rezonings, are mapped at 40 to 350 ft. A-1 and AMX-1 parcels with no map height take Table 21-3.3's 30 ft.

  A parcel no row matches, such as a Honolulu A-2 parcel whose map label is blank or `0'`, gets height 0, and the engine uses its default height. The table's `height_source` column says where each height came from.

### Not built yet

- **Honolulu's map files:** the tool still reads Honolulu from its pathway files (`parcels-bill6.json` and so on). Step 7 writes `parcels-hi-honolulu.json` too, to check against them.
- **Assessed values, existing use, transit distance and parking exemptions:** blank in the table.
- **Street addresses:** not in the public layers; the map shows each parcel's TMK.

## The parcel table

`data/parcels_statewide.csv` has one row per zoned parcel in all four counties. All of these columns must be in the header, in any order, and any extra columns are ignored:

| Column | Meaning | Required |
| --- | --- | --- |
| `locality` | County id: `hi-honolulu`, `hi-maui`, `hi-hawaii` or `hi-kauai` | Yes |
| `tmk` | 9-digit state TMK, leading zeros kept | Yes |
| `lot_sqft` | Lot area in square feet | Yes |
| `zone_class` | Zoning district, as the county code names it | Yes |
| `height` | Height limit in feet; 0 if not known | Yes |
| `land_value` | Assessed land value in dollars | No |
| `building_value` | Assessed building value in dollars | No |
| `existing_use` | One of `EXISTING_USES` in `src/scenarios/parcels.ts` | No |
| `existing_units` | Dwelling units on the parcel now | No |
| `transit_distance_mi` | Miles to the nearest major transit stop | No |
| `parking_exempt` | `true` or `false` | No |

Leave a cell blank where the value isn't known. Fields can't contain quotes or commas. `src/scenarios/parcels.ts` is the source of truth for this format.

## Running a table through the engine

`run-parcels.mjs` runs any parcel table on current zoning. Step 6 does this for you; to run it by hand:

```bash
npm run build
```

```bash
node scripts/run-parcels.mjs data/parcels_statewide.csv
```

It writes to `out/parcel-runs/`, which git ignores: `runs.csv` (one row per parcel), `summary.csv` (totals by county), `not_modeled.csv` (zones with no rules in the county configs, most parcels first) and `problems.txt` (rows the parser rejected).

## Rules

These come from the challenge's [Official Rules](https://housingchallenge.turnout.rocks/rules.html):

- **No large source datasets in the repo.** The scripts download them. Git ignores everything in `data/` except `data/sample/`.
- **The download has to be automated,** with as little manual work as possible, and documented with one command in this README.
- **Every dataset needs a record in `docs/DATA_PROVENANCE.md`:** source, version, access date, license or terms, and cleaning steps. Check each dataset's terms before using it.
- **Leave out what the model doesn't need,** such as owner names.

# Data Provenance

Document every dataset your tool uses. The code license does **not** relicense data—each dataset carries its own terms, and you are responsible for them. Do not commit raw or large data to the repository; describe how to obtain it here and keep only small samples in `data/sample/`.

The public parcel and zoning data is downloaded and built by one command, `python scripts/build_data.py` (see [scripts/README.md](../scripts/README.md)). Each download writes a `SOURCE.md` next to its files with the URL, the server's last-modified date and a SHA-256 hash, so a rerun can be checked against the versions recorded here.

# Dataset Inventory

| Dataset | Source | Version / vintage | Access date | License / terms | Category |
| ------- | ------ | ----------------- | ----------- | --------------- | -------- |
| Statewide TMK parcels (`tmk_state`) | Hawaiʻi Statewide GIS Program, Office of Planning and Sustainable Development: [tmk_state.shp.zip](https://files.hawaii.gov/dbedt/op/gis/data/tmk_state.shp.zip) ([map service](https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/25)) | File last modified 2026-06-02; 384,035 features | 2026-11-09 | Free public download. No license is stated; the metadata's use limitation says the boundaries are a visual reference only, not legal or survey accuracy, and attributes are for assessment purposes | Public (State of Hawaiʻi open data) |
| County zoning, City and County of Honolulu (`cty_zoning_oah`) | Hawaiʻi Statewide GIS Program: [cty_zoning_oah.shp.zip](https://files.hawaii.gov/dbedt/op/gis/data/cty_zoning_oah.shp.zip) ([map service](https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/3)), from the City's HOLIS data | File last modified 2023-09-21; 1,965 features | 2026-11-09 | Free public download. No license stated; HOLIS use limitation: not warranted for content or accuracy, not a legal representation | Public (State of Hawaiʻi open data) |
| County zoning, County of Hawaiʻi (`cty_zoning_haw`) | Hawaiʻi Statewide GIS Program: [cty_zoning_haw.shp.zip](https://files.hawaii.gov/dbedt/op/gis/data/cty_zoning_haw.shp.zip) ([map service](https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/2)), from the County Planning Department | File last modified 2023-11-14; 7,721 features | 2026-11-09 | Free public download. No license stated; use limitation: a guide for planning purposes only, not survey accurate | Public (State of Hawaiʻi open data) |
| County zoning, County of Kauaʻi (`cty_zoning_kau`) | Hawaiʻi Statewide GIS Program: [cty_zoning_kau.shp.zip](https://files.hawaii.gov/dbedt/op/gis/data/cty_zoning_kau.shp.zip) ([map service](https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/29)), from the County | File last modified 2023-09-21; 1,953 features | 2026-11-09 | Free public download. No license stated; use limitation: general reference only, accuracy not warranted | Public (State of Hawaiʻi open data) |
| County zoning, County of Maui (`cty_zoning_mau`) | Hawaiʻi Statewide GIS Program: [cty_zoning_mau.shp.zip](https://files.hawaii.gov/dbedt/op/gis/data/cty_zoning_mau.shp.zip) ([map service](https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/33)), from the County Department of Planning | File last modified 2025-09-08; 3,274 features | 2026-11-09 | Free public download. No license stated; use limitation: official locations are verified by the County Department of Planning | Public (State of Hawaiʻi open data) |
| Zoning - Map Height Limit, City and County of Honolulu | City and County of Honolulu, HOLIS: [Zoning_Reg feature service, layer 2](https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/Zoning_Reg/FeatureServer/2) | Data last edited 2026-04-28; 824 features | 2026-11-09 | Public feature service. The item states no license or access terms; HOLIS's use limitation (as above) applies | Public (City and County of Honolulu open data) |
| Hawaiʻi County zoning-map amendments (`scripts/inputs/hawaii_map_amendments.csv`) | Transcribed by the team from the Annex to [Hawaiʻi County Code Chapter 25](https://hawaiicounty.gov/our-county/legislative/office-of-the-county-clerk/county-code), Supp. 20 (7-2026) | 41 amendments, effective 2023 to 2026 | 2026-11 | County code: public law | Team-created |
| Height limits by district (`scripts/inputs/zone_heights.csv`) | Compiled by the team from the county codes: Honolulu ROH Chapter 21, Table 21-3.3 ([American Legal Publishing](https://codelibrary.amlegal.com/codes/honolulu/latest/overview)); Hawaiʻi County Code Chapter 25, Supp. 20; Kauaʻi County Code Chapter 8 (eCode360, Oct. 29, 2026); [Maui County Code Title 19](https://library.municode.com/hi/county_of_maui/codes/code_of_ordinances) (version of Sep. 14, 2026). Each row names its section | Codes as of the versions listed | 2026-11-09 | County codes: public law | Team-created |
| Oʻahu program parcel files (`parcels-bill6.json`, `parcels-bill7.json`, `parcels-standard.json`, `parcels-tod.json`, `parcels-h201.json`, `parcel-shapes.json`) | UHERO's Oʻahu parcel work: 9,444 parcels in the apartment, mixed-use and Waikīkī districts, with each program's eligible parcels, heights from the City's zoning map, street addresses from the City's real property assessment records, a planning region and a parking-exemption flag | Built October 2026 | 2026-10-30 | UHERO; supplied for this submission (see [How the Oʻahu files are supplied](#how-the-oʻahu-files-are-supplied)) | Team-created |
| County zoning rules, fees and market assumptions (`src/localities/`) | The county codes above, HHFDC income schedules (for example the [2026 Maui County schedule](https://dbedt.hawaii.gov/hhfdc/files/2026/06/2026-HHFDC-Maui-County-Income-Limits_Sales-Price-Guidelines.pdf)) and county fee schedules. Every figure and its source is listed in the county notes: [MAUI.md](notes/MAUI.md), [KAUAI.md](notes/KAUAI.md), [HAWAII_COUNTY.md](notes/HAWAII_COUNTY.md) | Per the notes | 2026-10 to 2026-11 | Public law and agency publications | Team-created |

Categories:

- **Public** — nationally available public datasets (e.g., Census/ACS, BLS).
- **State-provided** — datasets supplied by participating states for the challenge.
- **Third-party** — commercial, nonprofit, academic, or online sources.
- **Team-created** — datasets you built or materially modified.

None of the data was supplied by the State for the challenge. The State and county GIS layers are listed as Public because the State and counties publish them for anyone to download.

# Cleaning and Preparation

The steps below are in `scripts/`, in the order `build_data.py` runs them. Git ignores everything they write (`data/`, `out/` and the map files in `web/public/data/`).

1. **Download** (`fetch_data.py`). Fetches the five shapefiles, and pages through the HOLIS height layer (1,000 features a request) as GeoJSON. Records each file's URL, last-modified date and SHA-256 in `SOURCE.md`.
2. **Clean the parcels** (`clean_parcels.py`). Repairs invalid shapes with `shapely.make_valid` (structure method), keeping only polygon parts. Merges rows that share a TMK into one shape, after checking that their attributes are identical. Every changed TMK is logged in `data/gis/parcels/cleaning_log.csv`.
3. **Clean the zoning** (`clean_zoning.py`). Repairs invalid shapes and drops shapes with no geometry (logged). Reprojects to NAD83(HARN) / Hawaii zone 3 (EPSG:3750) where needed. Converts each county's labels to the district names its code uses (for example Kauaʻi's `C-G` is `CG`), and marks labels that aren't zoning districts, such as roads and water. Keeps Maui's community plan area for each district.
4. **Join zoning to parcels** (`join_zoning.py`). Gives each parcel the district covering the largest share of it. A parcel is "zoned" only if that district covers at least 10% of it; the rest (roads, water, unmapped land) are "unzoned". The second-largest district and its share are kept for review. In Hawaiʻi County, the Annex amendments that took effect after the zoning layer (November 8, 2023) replace the layer's district for the TMKs they name; `data/joined/annex_log.csv` records each one. Each Maui parcel also gets the community plan area covering most of it, and each Honolulu parcel the height-map label.
5. **Export the parcel table** (`export_parcels.py`). Writes one row per zoned parcel to `data/parcels_statewide.csv`, leaving out unzoned parcels and 4 Honolulu slivers whose area rounds to 0. Lot area comes from the cleaned shape. Height comes from the first matching row of `zone_heights.csv`:
   - Honolulu takes the City's height-map label covering most of the parcel. A-1 and AMX-1 parcels the map doesn't cover take the code's 30 ft.
   - Areas the codes define on maps that aren't published as GIS layers are approximated by TMK: the City of Hilo as South Hilo (TMK zone 2), and Keauhou and Kahaluʻu Bays as TMK zone 7, section 8.
   - Parcels no row matches get height 0, and the engine uses its default height. The `height_source` column says where each height came from.
6. **Run the engine** (`run-parcels.mjs`). Runs every parcel on current zoning and writes `out/parcel-runs/`.
7. **Export the map files** (`export_map.py`). For the parcels the engine runs, writes each parcel's position (a point inside the lot) and outline, simplified to 1 m, to `web/public/data/parcels-<county>.json` and `parcel-shapes-<county>.json`.

## How the Oʻahu files are supplied

The tool's Honolulu view reads UHERO's Oʻahu program files, not the public pipeline's Honolulu output, because the program pathways (Bill 6, Bill 7, TOD, H201) depend on UHERO's eligibility work. These files aren't in the repository, and no public script builds them. They are supplied with the submission, to be placed in `web/public/data/` (see [web/public/data/README.md](../web/public/data/README.md)).

The public pipeline writes its own Honolulu files (`parcels-hi-honolulu.json`) as a cross-check. They include 9,343 of the 9,444 Oʻahu parcels, and in the parcel table 9,387 of the 9,444 heights match.

# Known Limitations

- **The zoning layers are older than the codes.** The Honolulu and Kauaʻi layers date from September 2023 and Hawaiʻi County's from November 2023. Rezonings since then aren't reflected, except Hawaiʻi County's, which the Annex amendments add. Maui's layer is from September 2025.
- **The largest-share rule picks one district per parcel.** Split-zoned parcels are modeled entirely in their largest district, and parcels whose largest district covers less than 10% are left out.
- **The parcel lines aren't survey accurate,** so lot areas are approximate.
- **Two height areas are approximated by TMK** (Hilo, and Keauhou–Kahaluʻu; see step 5).
- **Ten Honolulu A-1 heights in the public pipeline differ from the Oʻahu files:**
  - five Punchbowl parcels are mapped at `0'` and get the code's 30 ft;
  - one parcel split between 150 and 350 ft zones gets the larger share's 350 ft;
  - three have no map label and get 30 ft;
  - one is mapped at 40 ft where the Oʻahu file has 30.

  The tool uses the Oʻahu files, so it isn't affected.
- **Neighbor-island parcels have no street address, land value or existing use,** because the public layers don't include them. The map shows each parcel's TMK, and land cost uses the engine's default, which the user can change.
- **The State and county layers carry no explicit license.** They are published for free public download, with use limitations (disclaimers) only.

# Restricted, Sensitive, or Personal Data

No dataset describes individuals or households, and none is restricted or confidential.

- **The parcel layer has no owner names.** The scripts keep only the TMK, the island, the TMK parts, area and zoning.
- **The Oʻahu files hold street addresses of properties,** which are public real property records, but no owner names or other personal information.
- **Everything the tool shows is per parcel,** from public land records and public law, so there are no small-cell or re-identification concerns.

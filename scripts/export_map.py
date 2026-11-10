"""Write the map files the tool draws for each county.

Input:  data/parcels_statewide.csv        the parcel table (export_parcels.py)
        data/joined/parcels_zoning.gpkg   parcel shapes (join_zoning.py)
        out/parcel-runs/runs.csv          the engine's run of the parcel table (run-parcels.mjs)
Output: web/public/data/parcels-<county>.json         one row per parcel on the map
        web/public/data/parcel-shapes-<county>.json   [tmk, outline] pairs for the lot outlines
        for hi-honolulu, hi-hawaii, hi-kauai and hi-maui (git ignores web/public/data/)

Only parcels the engine ran (status "run" in runs.csv) are exported: zones the county configs list as
allowing multi-family housing. Honolulu is limited further to its apartment, mixed-use and Waikiki
districts (MAP_ZONES): R-5, B-1, B-2 and ResMix run in the engine but are left off the map, as in the
tool's Honolulu pathway files. Each row has tmk (9 digits), locality, zone_class (the config zone the
engine matched, e.g. Kauai "R-20/ST-P" runs as "R-20"), zone_label (the code's name), lot_sqft, height,
lat and lng, and island. lat and lng are a point inside the parcel's shape (representative_point,
which unlike the centroid always falls inside an oddly shaped lot), in WGS 84, 6 decimals (about
0.1 m). Outlines are the shape simplified to 1 m, as polygons > rings > [lat, lng] points, the order
Leaflet takes.

The tool still reads Honolulu from its pathway files (parcels-bill6.json and so on); the
parcels-hi-honolulu.json written here is for checking against them until it replaces them.

The script stops if a TMK repeats, a point falls outside Hawaii, or a parcel the engine ran has no
shape or is missing from the parcel table.

Usage: python scripts/export_map.py   (run after node scripts/run-parcels.mjs data/parcels_statewide.csv)
"""
import json
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import MultiPolygon, Polygon

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import JOINED, MAP_DATA, PARCEL_TABLE, RUNS  # noqa: E402

COUNTIES = ["hi-honolulu", "hi-hawaii", "hi-kauai", "hi-maui"]
# the zones a county's map shows, where narrower than every zone the engine runs
MAP_ZONES = {"hi-honolulu": {"A-1", "A-2", "A-3", "AMX-1", "AMX-2", "AMX-3", "BMX-3", "BMX-4", "Apart", "ApartMix"}}
ISLAND = {"OAH": "Oʻahu", "HAW": "Hawaiʻi", "MAU": "Maui", "MOL": "Molokaʻi", "LAN": "Lānaʻi",
          "KAH": "Kahoʻolawe", "KAU": "Kauaʻi", "NII": "Niʻihau"}
SIMPLIFY_M = 1.0   # outline accuracy, in metres (the layer's CRS, EPSG:3750, is in metres)
DECIMALS = 6
# Hawaii's main islands, with a margin: a point outside means a projection went wrong
LAT, LNG = (18.5, 22.5), (-160.5, -154.5)


def rings(poly: Polygon) -> list:
    """A polygon's rings as [lat, lng] point lists, exterior first."""
    return [[[round(y, DECIMALS), round(x, DECIMALS)] for x, y in ring.coords]
            for ring in [poly.exterior, *poly.interiors]]


def outline(geom) -> list:
    """A (multi)polygon as polygons > rings > [lat, lng]; other shapes give no outline."""
    if isinstance(geom, Polygon):
        return [rings(geom)]
    if isinstance(geom, MultiPolygon):
        return [rings(p) for p in geom.geoms]
    return []


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    runs = pd.read_csv(RUNS, dtype={"tmk": str, "zone_class": str},
                       usecols=["tmk", "locality", "zone_class", "status"])
    runs = runs[runs["status"].eq("run") & runs["locality"].isin(COUNTIES)].copy()
    for county, zones in MAP_ZONES.items():
        runs = runs[runs["locality"].ne(county) | runs["zone_class"].isin(zones)]
    runs["tmk"] = runs["tmk"].str.zfill(9)
    keep = set(runs["tmk"])
    matched = runs.set_index("tmk")["zone_class"]   # the config zone each parcel ran on

    table = pd.read_csv(PARCEL_TABLE, dtype={"tmk": str},
                        usecols=["locality", "tmk", "lot_sqft", "zone_class", "height", "island"])
    table = table[table["tmk"].isin(keep)]

    shapes = gpd.read_file(JOINED, layer="parcels", columns=["TMK"])
    shapes["tmk"] = shapes["TMK"].astype("int64").astype(str).str.zfill(9)
    shapes = shapes[shapes["tmk"].isin(keep)].set_index("tmk")

    problems = []
    if table["tmk"].duplicated().any():
        problems.append(f"{table['tmk'].duplicated().sum()} duplicate TMKs in the parcel table")
    if shapes.index.duplicated().any():
        problems.append(f"{shapes.index.duplicated().sum()} duplicate TMKs in the parcel shapes")
    missing = keep - set(shapes.index)
    if missing:
        problems.append(f"{len(missing)} parcels the engine ran have no shape, e.g. {sorted(missing)[:3]}")
    if len(table) != len(keep):
        problems.append(f"{len(keep) - len(table)} parcels the engine ran are not in the parcel table")
    if problems:
        for p in problems:
            print("problem:", p)
        sys.exit(1)

    points = shapes.geometry.representative_point().to_crs(4326)
    lines = shapes.geometry.simplify(SIMPLIFY_M, preserve_topology=True).to_crs(4326)

    table = table.set_index("tmk")
    table["zone_label"] = table["zone_class"]
    table["zone_class"] = matched.reindex(table.index)
    table["lat"] = points.y.round(DECIMALS)
    table["lng"] = points.x.round(DECIMALS)
    table["island"] = table["island"].map(ISLAND).fillna(table["island"])
    off = ~(table["lat"].between(*LAT) & table["lng"].between(*LNG))
    if off.any():
        sys.exit(f"problem: {off.sum()} points outside Hawaii, e.g. {table[off].head(3).to_dict('index')}")

    MAP_DATA.mkdir(parents=True, exist_ok=True)
    for county in COUNTIES:
        rows = table[table["locality"].eq(county)].reset_index()
        parcels = [{"tmk": r.tmk, "locality": r.locality, "zone_class": r.zone_class,
                    "zone_label": r.zone_label, "lot_sqft": float(r.lot_sqft), "height": float(r.height),
                    "lat": float(r.lat), "lng": float(r.lng), "island": r.island}
                   for r in rows.itertuples()]
        outlines = [[tmk, outline(lines[tmk])] for tmk in rows["tmk"]]
        for name, data in [(f"parcels-{county}.json", parcels), (f"parcel-shapes-{county}.json", outlines)]:
            path = MAP_DATA / name
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            print(f"{name}: {len(data):,} parcels, {path.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()

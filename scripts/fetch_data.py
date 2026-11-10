"""Download the public GIS layers the parcel table is built from, into data/gis/<name>/.

Each layer is the Hawaii Statewide GIS Program's shapefile zip and its metadata PDF
(https://files.hawaii.gov/dbedt/op/gis/data/), the same data the State's ParcelsZoning map service
serves. Each folder gets a SOURCE.md recording the file, its last-modified date, the download date,
the zip's SHA-256, the feature count and the fields.

  parcels           statewide tax map key (TMK) parcels
  zoning_honolulu   City and County of Honolulu zoning
  zoning_hawaii     County of Hawaii zoning
  zoning_kauai      County of Kauai zoning
  zoning_maui       County of Maui zoning
  height_honolulu   City and County of Honolulu zoning map height limits, from the City's open data
                    (HOLIS) feature service rather than the State's files

Usage: python scripts/fetch_data.py [name ...]   (default: every layer)
"""
import hashlib
import json
import sys
import urllib.parse
import urllib.request
import zipfile
from datetime import date
from pathlib import Path

import geopandas as gpd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import GIS  # noqa: E402

BASE = "https://files.hawaii.gov/dbedt/op/gis/data/"
SERVICE = "https://geodata.hawaii.gov/arcgis/rest/services/ParcelsZoning/MapServer/"
SHP_PARTS = {".shp", ".shx", ".dbf", ".prj", ".cpg", ".sbn", ".sbx", ".xml"}

# feature services read page by page into one GeoJSON file: name: (layer url, fields, title)
FEATURE_LAYERS = {
    "height_honolulu": (
        "https://services.arcgis.com/tNJpAOha4mODLkXz/arcgis/rest/services/Zoning_Reg/FeatureServer/2",
        "height_label,height_label_source",
        "Zoning - Map Height Limit, City and County of Honolulu",
    ),
}
PAGE = 1000

# name: (file stem, map service layer id, title)
LAYERS = {
    "parcels": ("tmk_state", 25, "Statewide TMK parcels"),
    "zoning_honolulu": ("cty_zoning_oah", 3, "County Zoning - City and County of Honolulu"),
    "zoning_hawaii": ("cty_zoning_haw", 2, "County Zoning - County of Hawaii"),
    "zoning_kauai": ("cty_zoning_kau", 29, "County Zoning - County of Kauai"),
    "zoning_maui": ("cty_zoning_mau", 33, "County Zoning - County of Maui"),
}


def fetch(url: str, dest: Path) -> str:
    """Save url to dest; return its Last-Modified header."""
    req = urllib.request.Request(url, headers={"User-Agent": "feasim-data-scripts"})
    with urllib.request.urlopen(req) as r:
        dest.write_bytes(r.read())
        return r.headers.get("Last-Modified", "")


def get(name: str) -> None:
    stem, layer, title = LAYERS[name]
    out = GIS / name
    out.mkdir(parents=True, exist_ok=True)
    zpath = out / f"{stem}.shp.zip"
    modified = fetch(f"{BASE}{stem}.shp.zip", zpath)
    fetch(f"{BASE}{stem}.pdf", out / f"{stem}.pdf")
    sha = hashlib.sha256(zpath.read_bytes()).hexdigest()
    with zipfile.ZipFile(zpath) as z:
        for info in z.infolist():
            p = Path(info.filename)
            # only flat shapefile parts, never paths that climb out of the folder
            if info.is_dir() or p.is_absolute() or ".." in p.parts or p.suffix.lower() not in SHP_PARTS:
                continue
            (out / p.name).write_bytes(z.read(info))
    zpath.unlink()
    shp = out / f"{stem}.shp"
    g = gpd.read_file(shp)
    fields = ", ".join(f"`{c}`" for c in g.columns if c != "geometry")
    (out / "SOURCE.md").write_text(
        f"# {title}\n\n"
        f"- File: {BASE}{stem}.shp.zip (last-modified {modified}), downloaded {date.today().isoformat()}\n"
        f"- Zip SHA-256: {sha}\n"
        f"- Map service layer: {SERVICE}{layer}\n"
        f"- Metadata: {stem}.pdf\n"
        f"- Shapefile: {shp.name}; {len(g):,} features; CRS {g.crs.to_string() if g.crs else 'unknown'}\n"
        f"- Fields: {fields}\n", encoding="utf-8")
    print(f"{name}: {len(g):,} features")


def get_features(name: str) -> None:
    """A feature service layer, every feature, as GeoJSON in WGS 84."""
    url, fields, title = FEATURE_LAYERS[name]
    out = GIS / name
    out.mkdir(parents=True, exist_ok=True)
    features, offset = [], 0
    while True:
        query = urllib.parse.urlencode({"where": "1=1", "outFields": fields, "f": "geojson",
                                        "resultOffset": offset, "resultRecordCount": PAGE})
        req = urllib.request.Request(f"{url}/query?{query}", headers={"User-Agent": "feasim-data-scripts"})
        with urllib.request.urlopen(req) as r:
            page = json.load(r)
        features += page.get("features", [])
        if len(page.get("features", [])) < PAGE:
            break
        offset += PAGE
    path = out / f"{name}.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": features}), encoding="utf-8")
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    (out / "SOURCE.md").write_text(
        f"# {title}\n\n"
        f"- Feature service layer: {url}\n"
        f"- Fields: {fields}; downloaded {date.today().isoformat()} as GeoJSON (WGS 84)\n"
        f"- File: {path.name}; {len(features):,} features; SHA-256 {sha}\n", encoding="utf-8")
    print(f"{name}: {len(features):,} features")


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    every = list(LAYERS) + list(FEATURE_LAYERS)
    names = sys.argv[1:] or every
    unknown = [n for n in names if n not in every]
    if unknown:
        sys.exit(f"unknown layer {unknown}; choose from {every}")
    for n in names:
        if n in FEATURE_LAYERS:
            get_features(n)
        else:
            get(n)


if __name__ == "__main__":
    main()

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

Usage: python scripts/fetch_data.py [name ...]   (default: every layer)
"""
import hashlib
import sys
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


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    names = sys.argv[1:] or list(LAYERS)
    unknown = [n for n in names if n not in LAYERS]
    if unknown:
        sys.exit(f"unknown layer {unknown}; choose from {list(LAYERS)}")
    for n in names:
        get(n)


if __name__ == "__main__":
    main()

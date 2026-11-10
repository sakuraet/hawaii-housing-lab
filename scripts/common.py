"""Paths and constants shared by the data scripts.

Everything the scripts download or build goes under data/, which git ignores (data/sample/ is the
exception). The only inputs kept in git are in scripts/inputs/.
"""
from pathlib import Path

import shapely

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
GIS = DATA / "gis"
INPUTS = Path(__file__).resolve().parent / "inputs"

PARCEL_TABLE = DATA / "parcels_statewide.csv"
JOINED = DATA / "joined" / "parcels_zoning.gpkg"
RUNS = ROOT / "out" / "parcel-runs" / "runs.csv"
MAP_DATA = ROOT / "web" / "public" / "data"

# NAD83(HARN) / UTM zone 4N, in metres: the parcel and zoning layers' coordinate system
CRS = "EPSG:3750"

SQM_PER_ACRE = 4046.8564224
SQFT_PER_ACRE = 43560

# the parcel layer's county names and the engine's locality ids
LOCALITY = {"Honolulu": "hi-honolulu", "Hawaii": "hi-hawaii", "Kauai": "hi-kauai", "Maui": "hi-maui"}


def polygonal(geom):
    """The polygonal part of a geometry (drops points and lines make_valid can leave behind)."""
    if geom.geom_type in ("Polygon", "MultiPolygon"):
        return geom
    parts = [p for p in shapely.get_parts(geom) if p.geom_type in ("Polygon", "MultiPolygon")]
    return shapely.union_all(parts) if parts else shapely.Polygon()

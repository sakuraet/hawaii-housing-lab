"""Clean the four counties' zoning layers and put them in one layer for the parcel join.

Input:  data/gis/zoning_<county>/<stem>.shp      (from fetch_data.py)
Output: data/gis/zoning_clean.gpkg               layer "zoning": county, gis_label, zone_label,
                                                 not_zoning, cpa, geometry (all four counties)
        data/gis/zoning_cleaning_log.csv          every repaired polygon

gis_label is the label as the county layer writes it. zone_label is the district's name in the county
code, which the engine's county configs use (src/localities/hi/*/zones.ts): the layers spell a few
districts differently (Kauai "C-G" is the code's "CG", Maui "M1 Light Industrial" is "M-1"). Labels for
roads, water and unzoned land are marked not_zoning, and the join skips them. cpa is Maui's community
plan area (the layer's CP_AREA), which some Maui height limits depend on; blank elsewhere.

Usage: python scripts/clean_zoning.py   (run after fetch_data.py)
"""
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely
from shapely.validation import explain_validity

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CRS, GIS, polygonal  # noqa: E402

# county: (layer folder, shapefile stem, label field)
LAYERS = {
    "Honolulu": ("zoning_honolulu", "cty_zoning_oah", "ZONE_CLASS"),
    "Hawaii": ("zoning_hawaii", "cty_zoning_haw", "ZONE"),
    "Kauai": ("zoning_kauai", "cty_zoning_kau", "ZONING"),
    "Maui": ("zoning_maui", "cty_zoning_mau", "ZONE_DIST"),
}

# the code's names for districts the layers spell differently (CZO 8-2.1; MCC Title 19)
KAUAI_CODES = {"C-G": "CG", "C-N": "CN", "I-G": "IG", "I-L": "IL", "P-D": "PD", "PD-C": "PDC",
               "SEE PLANNING DEPT": "SPD"}
MAUI_NAMES = {"Commercial Mixed Use - WRA": "CMU-MRA", "Business Multi Family - WRA": "BMF-MRA",
              "Multi Family - WRA": "MF-MRA", "Residential - WRA": "RES-MRA",
              "Public/Quasi-Public - WRA": "P/QP-MRA", "RU-1 Rural 1 Acre": "RU-1.0", "M1 Light Industrial": "M-1"}
# roads, water and land the county leaves unzoned
NOT_ZONING = {"(road)", "(pond)", "(river)", "(breakwater)", "(flood)", "(pier)", "Road", "PR Proposed Road",
              "Drainage", "BRW Beach Right-of-Way", "Unzoned Road", "Not Zoned", ""}


def zone_label(county: str, label: str) -> str:
    """The code's name for a layer label. Kauai keeps its overlays ("R-10/ST-P"); the engine's Kauai
    config drops them (zone_names.overlay_separator)."""
    if county == "Kauai":
        return "/".join(KAUAI_CODES.get(p, p) for p in label.split("/"))
    if county == "Maui":
        return MAUI_NAMES.get(label, label.split(" ")[0])
    return label


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    log, parts = [], []
    for county, (folder, stem, field) in LAYERS.items():
        g = gpd.read_file(GIS / folder / f"{stem}.shp")
        if g.crs is None or g.crs.to_epsg() != 3750:
            g = g.to_crs(CRS)
        g[field] = g[field].fillna("").astype(str).str.strip()
        # records with no shape at all can't be joined
        empty = g.geometry.isna()
        for i in g.index[empty]:
            log.append({"county": county, "feature": i, "label": g.at[i, field], "detail": "no geometry; dropped",
                        "sqm": 0})
        g = g[~empty]
        bad = ~g.is_valid
        for i in g.index[bad]:
            geom = g.at[i, "geometry"]
            fixed = polygonal(shapely.make_valid(geom, method="structure", keep_collapsed=False))
            log.append({"county": county, "feature": i, "label": g.at[i, field],
                        "detail": explain_validity(geom).split("[")[0].strip(),
                        "sqm": round(fixed.area - geom.area, 2)})
            g.at[i, "geometry"] = fixed
        out = gpd.GeoDataFrame({
            "county": county,
            "gis_label": g[field],
            "zone_label": [zone_label(county, s) for s in g[field]],
            "not_zoning": g[field].isin(NOT_ZONING),
            "cpa": g["CP_AREA"].fillna("").astype(str) if county == "Maui" else "",
        }, geometry=g.geometry.values, crs=g.crs)
        out = out[~out.is_empty]
        parts.append(out)
        print(f"{county}: {len(out):,} polygons, {out['zone_label'].nunique()} labels, repaired {int(bad.sum())}")

    z = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=CRS)
    z.to_file(GIS / "zoning_clean.gpkg", layer="zoning", driver="GPKG")
    pd.DataFrame(log).to_csv(GIS / "zoning_cleaning_log.csv", index=False, encoding="utf-8")
    print(f"zoning_clean.gpkg: {len(z):,} polygons")


if __name__ == "__main__":
    main()

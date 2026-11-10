"""Clean the statewide TMK parcel layer for the zoning join.

Input:  data/gis/parcels/tmk_state.shp           (from fetch_data.py)
Output: data/gis/parcels/parcels_clean.gpkg      layer "parcels": one row per TMK, valid polygons
        data/gis/parcels/cleaning_log.csv        one line per TMK that was changed

Steps:
1. Repair invalid geometries with shapely.make_valid (structure method), keeping only polygonal parts.
2. Merge rows that share a TMK into one (Multi)Polygon. Their attributes are identical (checked here),
   so the first row's attributes are kept. Exact duplicate polygons collapse in the union.
3. Recompute GISAcres, Shape_Area and Shape_Leng from the cleaned geometry.

Usage: python scripts/clean_parcels.py   (run after fetch_data.py)
"""
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
import shapely
from shapely.validation import explain_validity

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import GIS, SQM_PER_ACRE, polygonal  # noqa: E402

DIR = GIS / "parcels"
ATTRS = ["TMK", "TMK_txt", "county", "division", "island", "zone", "section", "plat", "plat1", "parcel",
         "parcel1", "cty_tmk", "qpub_link"]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    g = gpd.read_file(DIR / "tmk_state.shp")
    n_in, area_in = len(g), g.area.sum()
    log = {}

    # 1. repair invalid geometries
    bad = ~g.is_valid
    for i in g.index[bad]:
        geom = g.at[i, "geometry"]
        fixed = polygonal(shapely.make_valid(geom, method="structure", keep_collapsed=False))
        log[g.at[i, "TMK"]] = {"repaired": explain_validity(geom).split("[")[0].strip(),
                               "area_change_sqm": round(fixed.area - geom.area, 2)}
        g.at[i, "geometry"] = fixed

    # 2. merge rows that share a TMK
    dup = g["TMK"].duplicated(keep=False)
    varying = g[dup].groupby("TMK")[ATTRS].nunique().gt(1).any(axis=1)
    if varying.any():
        raise ValueError(f"attributes differ within TMK: {list(varying[varying].index)}")
    for tmk, grp in g[dup].groupby("TMK"):
        geoms = list(grp.geometry)
        exact = len(geoms) - len({x.wkb for x in geoms})
        log.setdefault(tmk, {}).update({"merged_rows": len(grp), "exact_duplicates": exact})
    merged = g[dup].dissolve(by="TMK", aggfunc="first", as_index=False)
    merged["geometry"] = [polygonal(x) for x in merged.geometry]
    out = pd.concat([g[~dup], merged[g.columns]], ignore_index=True)
    out = gpd.GeoDataFrame(out, geometry="geometry", crs=g.crs).sort_values("TMK", ignore_index=True)

    # 3. recompute areas
    out["Shape_Area"] = out.area
    out["Shape_Leng"] = out.length
    out["GISAcres"] = out["Shape_Area"] / SQM_PER_ACRE

    problems = []
    if out["TMK"].duplicated().any():
        problems.append("duplicate TMKs remain")
    if (~out.is_valid).any():
        problems.append(f"{(~out.is_valid).sum()} invalid geometries remain")
    if out.is_empty.any():
        problems.append(f"{out.is_empty.sum()} empty geometries: {out[out.is_empty].TMK.tolist()}")
    if not out.geom_type.isin(["Polygon", "MultiPolygon"]).all():
        problems.append("non-polygon geometries remain")
    if problems:
        for p in problems:
            print("problem:", p)
        sys.exit(1)

    out.to_file(DIR / "parcels_clean.gpkg", layer="parcels", driver="GPKG")
    lg = pd.DataFrame([{"TMK": k, **v} for k, v in log.items()])
    lg = lg.merge(out[["TMK", "county"]], on="TMK", how="left")
    cols = ["TMK", "county", "repaired", "area_change_sqm", "merged_rows", "exact_duplicates"]
    lg.reindex(columns=cols).sort_values("TMK").to_csv(DIR / "cleaning_log.csv", index=False, encoding="utf-8")

    print(f"rows {n_in:,} -> {len(out):,}; repaired {int(bad.sum())}; merged {int(dup.sum())} rows into "
          f"{g[dup]['TMK'].nunique()} TMKs; area {area_in / SQM_PER_ACRE:,.1f} -> "
          f"{out.area.sum() / SQM_PER_ACRE:,.1f} acres")


if __name__ == "__main__":
    main()

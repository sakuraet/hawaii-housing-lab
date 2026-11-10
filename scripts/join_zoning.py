"""Give every parcel in the four counties its zoning district.

For each parcel:
  1. Zoning: the district (not roads or water) covering the largest share of the parcel, if it covers
     at least 10% of it; otherwise the parcel is unzoned. The second district and its share are kept
     for review.
  2. Maui: the community plan area covering most of the parcel (cpa). Honolulu: the zoning map height
     label covering most of the parcel (height_label, height_label_source), from the City's height layer.
  3. Hawaii County: zoning-map amendments from the code's Annex (scripts/inputs/hawaii_map_amendments.csv)
     replace the district by TMK when they took effect after the zoning layer's date, or when the layer
     still shows the old district. Rezonings of part of a parcel ("por.", "portion") are flagged, not
     applied.

Inputs:  data/gis/parcels/parcels_clean.gpkg (clean_parcels.py), data/gis/zoning_clean.gpkg (clean_zoning.py),
         data/gis/height_honolulu/height_honolulu.geojson (fetch_data.py)
Outputs, in data/joined/:
  parcels_zoning.gpkg   layer "parcels": TMK and parcel fields, zone_label, join_status, shares, cpa,
                        height_label, flags
  summary.csv           parcels and acres by county, island and join_status
  annex_log.csv         what happened to each Hawaii Annex row

join_status: zoned / unzoned (no district covers 10% of the parcel: roads, water, unmapped land).

Usage: python scripts/join_zoning.py   (run after clean_parcels.py and clean_zoning.py)
"""
import re
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import CRS, GIS, INPUTS, JOINED, SQM_PER_ACRE  # noqa: E402

COUNTIES = ["Honolulu", "Hawaii", "Kauai", "Maui"]
MIN_SHARE = 0.10            # a parcel is zoned if its largest district covers this share
SPLIT_VERTICES = 2000       # zoning polygons with more vertices are cut on a grid before overlay
GRID_M = 2000
HAWAII_LAYER_DATE = pd.Timestamp("2023-11-08")
PARCEL_COLS = ["TMK", "TMK_txt", "county", "island", "zone", "section", "plat", "parcel", "cty_tmk"]
JOIN_COLS = ["parcel_acres", "gis_label", "zone_label", "join_status", "share", "zone_label_2", "share_2",
             "zoned_share", "annex_ordinance", "cpa", "height_label", "height_label_source", "flags"]


def grid_split(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Cut polygons with many vertices into GRID_M cells so pairwise intersections stay cheap."""
    n = shapely.get_num_coordinates(gdf.geometry.values)
    small, big = gdf[n <= SPLIT_VERTICES], gdf[n > SPLIT_VERTICES]
    pieces = []
    for idx, geom in zip(big.index, big.geometry.values):
        x0, y0, x1, y1 = geom.bounds
        xs, ys = (a.ravel() for a in np.meshgrid(np.arange(x0, x1, GRID_M), np.arange(y0, y1, GRID_M)))
        cells = shapely.box(xs, ys, xs + GRID_M, ys + GRID_M)
        cells = cells[shapely.intersects(geom, cells)]
        parts = shapely.intersection(geom, cells)
        parts = parts[~shapely.is_empty(parts) & (shapely.area(parts) > 0)]
        pieces.append(gpd.GeoDataFrame(big.loc[[idx] * len(parts)].drop(columns="geometry"), geometry=parts,
                                       crs=gdf.crs))
    return pd.concat([small] + pieces, ignore_index=True) if pieces else small.reset_index(drop=True)


def areas_by(parcels: gpd.GeoDataFrame, layer: gpd.GeoDataFrame, key: str) -> pd.DataFrame:
    """Square metres of each parcel in each `key` value: DataFrame(pi, value, sqm), pi = parcel position."""
    lg = layer.geometry.values
    shapely.prepare(lg)
    pi, li = shapely.STRtree(lg).query(parcels.geometry.values, predicate="intersects")
    pg = parcels.geometry.values[pi]
    sqm = shapely.area(pg)
    partial = ~shapely.contains_properly(lg[li], pg)
    sqm[partial] = shapely.area(shapely.intersection(pg[partial], lg[li][partial]))
    df = pd.DataFrame({"pi": pi, "value": layer[key].values[li], "sqm": sqm})
    return df.groupby(["pi", "value"], as_index=False)["sqm"].sum().sort_values(["pi", "sqm"],
                                                                                 ascending=[True, False])


def largest(parcels: gpd.GeoDataFrame, layer: gpd.GeoDataFrame, key: str) -> pd.Series:
    """The `key` value covering the largest area of each parcel, aligned to parcels ("" where none)."""
    top = areas_by(parcels, layer, key).groupby("pi").head(1).set_index("pi")["value"]
    return top.reindex(range(len(parcels))).fillna("").astype(str)


def assign_zoning(parcels: gpd.GeoDataFrame, zoning: gpd.GeoDataFrame, area: np.ndarray) -> pd.DataFrame:
    """zone_label, share, the second district and its share, zoned_share and join_status per parcel."""
    real = zoning[~zoning["not_zoning"]]
    a = areas_by(parcels, real, "zone_label")
    a["share"] = a["sqm"] / area[a["pi"].values]
    top = a.groupby("pi").head(1).set_index("pi")
    second = a.groupby("pi").nth(1).set_index("pi")
    labels = areas_by(parcels, real, "gis_label").groupby("pi").head(1).set_index("pi")["value"]
    zoned = top.index[top["share"] >= MIN_SHARE]
    out = pd.DataFrame(index=range(len(parcels)))
    out["zone_label"] = top.loc[zoned, "value"]
    out["gis_label"] = labels.reindex(zoned)
    out["share"] = top.loc[zoned, "share"]
    out["zone_label_2"] = second["value"].reindex(zoned)
    out["share_2"] = second["share"].reindex(zoned)
    out["zoned_share"] = a.groupby("pi")["share"].sum().reindex(out.index).fillna(0)
    out["join_status"] = np.where(out.index.isin(zoned), "zoned", "unzoned")
    out["flags"] = np.where(out.index.isin(zoned) & (out["zoned_share"] < 0.5), "mostly_not_zoning", "")
    for c in ["share", "share_2", "zoned_share"]:
        out[c] = out[c].astype(float).round(4)
    for c in ["zone_label", "gis_label", "zone_label_2"]:
        out[c] = out[c].fillna("")
    return out


def parse_annex_tmks(text: str) -> list[tuple[int, bool]]:
    """'2-2-034:066, 078, and 079' -> [(tmk9, portion)], with portion True for '(por.)' or '(portion)';
    '(portions)' marks every parcel since the last full TMK."""
    out, prefix, start = [], None, 0
    for m in re.finditer(r"(\d)-(\d)-(\d{3}):(\d{3})|\b(\d{3})\b|\((por\.?|portions?)\)", text, re.I):
        if m.group(1):
            prefix, start = f"3{m.group(1)}{m.group(2)}{m.group(3)}", len(out)
            out.append([int(prefix + m.group(4)), False])
        elif m.group(5) and prefix:
            out.append([int(prefix + m.group(5)), False])
        elif m.group(6) and out:
            for x in out[start:] if m.group(6).lower() == "portions" else out[-1:]:
                x[1] = True
    return [tuple(x) for x in out]


def annex_rows(labels: dict[int, str]) -> tuple[dict, dict, pd.DataFrame]:
    """Hawaii Annex map amendments: (overrides {tmk: (district, ordinance)}, portions {tmk: ordinance}, log).
    labels: {tmk: zone_label}. A rezoning effective before the layer date is applied only if the layer
    still shows the old district (the layer misses Ords. 23-52 and 23-69)."""
    annex = pd.read_csv(INPUTS / "hawaii_map_amendments.csv", dtype=str, keep_default_na=False)
    annex["eff"] = pd.to_datetime(annex["effective"], format="mixed")
    overrides, portions, log = {}, {}, []
    for _, r in annex.sort_values("eff").iterrows():
        rezoning = bool(r["to_zone"]) and not r["to_zone"].startswith("(")
        for tmk, portion in parse_annex_tmks(r["tmk"]):
            if not rezoning:
                action = "not a rezoning (conditions amended or repealed)"
            elif r["eff"] <= HAWAII_LAYER_DATE and labels.get(tmk) != r["from_zone"]:
                action = "before layer date; layer already updated"
            elif tmk not in labels:
                action = "TMK not in parcel layer"
            elif portion:
                action = "portion: flagged, not applied"
                portions[tmk] = r["ordinance"]
            else:
                action = "applied"
                overrides[tmk] = (r["to_zone"], r["ordinance"])
            log.append({"ordinance": r["ordinance"], "effective": r["eff"].date(), "tmk": tmk,
                        "from_zone": r["from_zone"], "to_zone": r["to_zone"] if rezoning else "",
                        "portion": portion, "action": action})
    return overrides, portions, pd.DataFrame(log)


def join_county(county: str, zoning: gpd.GeoDataFrame,
                heights: gpd.GeoDataFrame) -> tuple[gpd.GeoDataFrame, pd.DataFrame]:
    t0 = time.time()
    parcels = gpd.read_file(GIS / "parcels" / "parcels_clean.gpkg", layer="parcels",
                            where=f"county = '{county}'", engine="pyogrio").reset_index(drop=True)
    area = shapely.area(parcels.geometry.values)
    p = parcels[PARCEL_COLS].copy()
    p["parcel_acres"] = (area / SQM_PER_ACRE).round(4)
    p = pd.concat([p, assign_zoning(parcels, zoning[zoning["county"] == county], area)], axis=1)
    p["annex_ordinance"] = ""
    county_zoning = zoning[zoning["county"] == county]
    p["cpa"] = largest(parcels, county_zoning[county_zoning["cpa"] != ""], "cpa") if county == "Maui" else ""
    if county == "Honolulu":
        p["height_label"] = largest(parcels, heights, "height_label")
        p["height_label_source"] = largest(parcels, heights, "height_label_source")
    else:
        p["height_label"] = p["height_label_source"] = ""

    log = pd.DataFrame()
    if county == "Hawaii":
        overrides, portions, log = annex_rows(dict(zip(p["TMK"], p["zone_label"])))
        hit = p["TMK"].isin(overrides)
        new = p.loc[hit, "TMK"].map(overrides)
        p.loc[hit, "zone_label"] = new.str[0]
        p.loc[hit, "annex_ordinance"] = new.str[1]
        p.loc[hit, "join_status"] = "zoned"
        p.loc[hit, "flags"] = (p.loc[hit, "flags"] + "; annex_override").str.strip("; ")
        part = p["TMK"].isin(portions)
        p.loc[part, "annex_ordinance"] = p.loc[part, "TMK"].map(portions)
        p.loc[part, "flags"] = (p.loc[part, "flags"] + "; annex_portion").str.strip("; ")

    out = gpd.GeoDataFrame(p[PARCEL_COLS + JOIN_COLS], geometry=parcels.geometry.values, crs=parcels.crs)
    print(f"{county}: {len(out):,} parcels, {out['join_status'].eq('zoned').sum():,} zoned, "
          f"{time.time() - t0:.0f} s")
    return out, log


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    JOINED.parent.mkdir(parents=True, exist_ok=True)
    zoning = grid_split(gpd.read_file(GIS / "zoning_clean.gpkg", layer="zoning"))
    heights = gpd.read_file(GIS / "height_honolulu" / "height_honolulu.geojson").to_crs(CRS)
    heights = heights[heights.geometry.notna() & heights["height_label"].notna()]
    for c in ["height_label", "height_label_source"]:
        heights[c] = heights[c].fillna("").astype(str).str.strip()
    heights = grid_split(heights)
    parts, logs = [], []
    for county in COUNTIES:
        out, log = join_county(county, zoning, heights)
        parts.append(out)
        logs.append(log)
    joined = gpd.GeoDataFrame(pd.concat(parts, ignore_index=True), crs=parts[0].crs)
    if joined["TMK"].duplicated().any():
        sys.exit(f"problem: {joined['TMK'].duplicated().sum()} duplicate TMKs")
    pyogrio.write_dataframe(joined, JOINED, layer="parcels", driver="GPKG")
    summary = (joined.groupby(["county", "island", "join_status"], as_index=False)
               .agg(parcels=("TMK", "size"), acres=("parcel_acres", "sum")))
    summary["acres"] = summary["acres"].round(1)
    summary.to_csv(JOINED.parent / "summary.csv", index=False, encoding="utf-8")
    pd.concat(logs, ignore_index=True).to_csv(JOINED.parent / "annex_log.csv", index=False, encoding="utf-8")
    print(summary.pivot_table(index="county", columns="join_status", values="parcels", aggfunc="sum",
                              fill_value=0))


if __name__ == "__main__":
    main()

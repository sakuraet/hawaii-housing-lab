"""Write the parcel table the engine runs: one row per zoned parcel in all four counties.

Input:  data/joined/parcels_zoning.gpkg (join_zoning.py; geometry is not read)
Output: data/parcels_statewide.csv      the columns of PARCEL_COLUMNS (src/scenarios/parcels.ts), then
                                        island, join_status, share and flags for review

  locality              hi-honolulu / hi-hawaii / hi-kauai / hi-maui, from `county`
  tmk                   the 9-digit TMK, county digit first
  lot_sqft              the cleaned parcel's area x 43,560
  zone_class            zone_label: the district's name in the county code (the engine matches it to
                        its config, dropping Kauai overlays)
  height                0 for now: the engine's default height applies (the height table is a later step)
  land_value ... parking_exempt
                        blank: not in the public layers yet

Parcels with no district (join_status unzoned: roads, water, unmapped land) are left out, and so are
slivers whose area rounds to 0 acres (printed by TMK). The engine's
loader does not read quoted fields, so commas in text become semicolons, and the script stops if a
field would still need quoting, a TMK repeats, a parcel has no area or a county is unknown.

Usage: python scripts/export_parcels.py   (run after join_zoning.py)
"""
import sys
from pathlib import Path

import pandas as pd
import pyogrio

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import JOINED, LOCALITY, PARCEL_TABLE, SQFT_PER_ACRE  # noqa: E402

PARCEL_COLUMNS = ["locality", "tmk", "lot_sqft", "zone_class", "height", "land_value", "building_value",
                  "existing_use", "existing_units", "transit_distance_mi", "parking_exempt"]
EXTRA = ["island", "join_status", "share", "flags"]


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    p = pyogrio.read_dataframe(JOINED, layer="parcels", read_geometry=False,
                               columns=["TMK", "county", "island", "parcel_acres", "zone_label", "join_status",
                                        "share", "flags"])
    for c in ["county", "island", "zone_label", "join_status", "flags"]:
        p[c] = p[c].fillna("").astype(str)
    summary = p.groupby(["county", "join_status"]).size().unstack(fill_value=0)
    p = p[p["join_status"].eq("zoned")]
    # slivers under 0.00005 acre (about 2 sqft) round to no area and can't hold a building
    sliver = p["parcel_acres"].astype(float).le(0)
    if sliver.any():
        print(f"left out {sliver.sum()} sliver parcels with no area: {p.loc[sliver, 'TMK'].tolist()}")
    p = p[~sliver]

    out = pd.DataFrame({
        "locality": p["county"].map(LOCALITY),
        "tmk": p["TMK"].astype("int64").astype(str).str.zfill(9),
        "lot_sqft": (p["parcel_acres"].astype(float) * SQFT_PER_ACRE).round(1),
        "zone_class": p["zone_label"],
        "height": 0,
    })
    for c in PARCEL_COLUMNS[5:]:
        out[c] = ""
    out["island"] = p["island"]
    out["join_status"] = p["join_status"]
    out["share"] = p["share"].astype(float).round(4)
    out["flags"] = p["flags"]
    out = out[PARCEL_COLUMNS + EXTRA]

    problems = []
    if out["locality"].isna().any():
        problems.append(f"unknown county: {sorted(p.loc[out['locality'].isna(), 'county'].unique())}")
    if out["tmk"].duplicated().any():
        problems.append(f"{out['tmk'].duplicated().sum()} duplicate TMKs")
    if not out["lot_sqft"].gt(0).all():
        problems.append(f"{(~out['lot_sqft'].gt(0)).sum()} parcels with no area")
    text = [c for c in out.columns if not pd.api.types.is_numeric_dtype(out[c])]
    out[text] = out[text].apply(lambda s: s.astype(str).str.replace(",", ";", regex=False))
    if out[text].apply(lambda s: s.str.contains('"|\n', regex=True)).any().any():
        problems.append("a field holds a quote or line break, which the engine's loader can't read")
    if problems:
        for pr in problems:
            print("problem:", pr)
        sys.exit(1)

    PARCEL_TABLE.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(PARCEL_TABLE, index=False, encoding="utf-8", lineterminator="\n")
    print(f"exported {len(out):,} parcels to {PARCEL_TABLE}")
    print(summary)


if __name__ == "__main__":
    main()

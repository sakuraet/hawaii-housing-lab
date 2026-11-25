"""Hawaiʻi County's parking exemptions (HCC 25-4-59.2), for the parcel table's parking_exempt column.

The section waives the off-street parking requirement for:
  (1) non-residential uses in downtown Hilo: the area bounded by Kinoʻole Street, Ponahawai Street and
      a straight extension of Ponahawai Street into Hilo Bay, and the Wailuku River;
  (2) dwelling units at 1,000 sqft of land per unit or denser, in the same area;
  (3) the area immediately fronting either side of the Hawaiʻi Belt Highway from TMK 7-9-7:66 to
      TMK 7-9-9:22, in Kainaliu, North Kona;
  (4) property wholly in the DPC (Downtown Pāhoa Commercial) district.

The model exempts a whole project, so a parcel is exempt where its housing is:
  - downtown Hilo: the parcel's centre is in the area, and its district allows 1,000 sqft of land per
    unit or less (CDH at 500; RM, RCX and V at their number in thousands). Commercial districts, at
    1,250 sqft per unit, keep the requirement for their dwellings, so (1) alone isn't modeled;
  - Kainaliu: the parcel lies along that stretch of the highway with no other parcel between it and
    the road;
  - DPC: none. An owner elects into the district (25-7-58, 25-7-59), so no parcel is zoned DPC on the
    County's map, and the model has no DPC rules.

The streets, river, bay and highway are the Census Bureau's TIGER/Line 2024 lines and water areas for
Hawaiʻi County (fetch_data.py, tiger_hawaii), which are in longitude and latitude. They are put on the
parcels' grid (UTM zone 4N, metres) with the transverse Mercator formulas here rather than pyproj; the
datum difference is under a metre, well inside TIGER's own accuracy.
"""
import math
import re

import geopandas as gpd
import numpy as np
import pandas as pd
import pyogrio
import shapely
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import linemerge, substring

from common import GIS

TIGER = GIS / "tiger_hawaii"
ROADS, LINEAR_WATER, AREA_WATER = (f"tl_2024_15001_{n}.zip" for n in ("roads", "linearwater", "areawater"))

# the Kainaliu stretch's end parcels (25-4-59.2(3)), as 9-digit TMKs
KAINALIU_ENDS = ("379007066", "379009022")
# how far from the highway's centreline a fronting parcel may be: half a two-lane right-of-way
# (about 10 m) plus TIGER's positional error
FRONTAGE_M = 40
# a district's density limit, sqft of land per unit, at or under which its dwellings are exempt
HILO_MAX_SQFT_PER_UNIT = 1000


def utm4n(lon: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """GRS 80 longitude/latitude (degrees) to UTM zone 4N easting/northing (metres)."""
    a, f, k0 = 6378137.0, 1 / 298.257222101, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    phi, lam = np.radians(lat), np.radians(lon)
    lam0 = math.radians(-159.0)
    n = a / np.sqrt(1 - e2 * np.sin(phi) ** 2)
    t = np.tan(phi) ** 2
    c = ep2 * np.cos(phi) ** 2
    aa = np.cos(phi) * (lam - lam0)
    m = a * ((1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
             - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * np.sin(2 * phi)
             + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * np.sin(4 * phi)
             - (35 * e2**3 / 3072) * np.sin(6 * phi))
    x = k0 * n * (aa + (1 - t + c) * aa**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * ep2) * aa**5 / 120)
    y = k0 * (m + n * np.tan(phi) * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24
                                     + (61 - 58 * t + t**2 + 600 * c - 330 * ep2) * aa**6 / 720))
    return x + 500000.0, y


def to_grid(geoms) -> np.ndarray:
    """TIGER geometries (longitude, latitude) on the parcels' grid."""
    return shapely.transform(np.asarray(geoms), lambda xy: np.column_stack(utm4n(xy[:, 0], xy[:, 1])))


def read(name: str, where: str | None = None) -> gpd.GeoDataFrame:
    g = pyogrio.read_dataframe(f"zip://{TIGER / name}", where=where)
    g["geometry"] = to_grid(g.geometry.values)
    return g


def named_line(g: gpd.GeoDataFrame, name: str):
    parts = g.loc[g["FULLNAME"].eq(name), "geometry"]
    if parts.empty:
        raise SystemExit(f"parking_exempt: no {name!r} in TIGER")
    return merge(parts.values)


def merge(lines):
    """Lines joined end to end where they meet (one line stays as it is)."""
    u = shapely.union_all(np.asarray(lines))
    return linemerge(u) if u.geom_type == "MultiLineString" else u


def hilo_core() -> Polygon:
    """Downtown Hilo, as 25-4-59.2(1) and (2) bound it: the land between Kinoʻole Street, Ponahawai
    Street and its straight extension into Hilo Bay, and the Wailuku River."""
    roads = read(ROADS, "FULLNAME IN ('Kinoole St', 'Ponahawai St')")
    kinoole, ponahawai = named_line(roads, "Kinoole St"), named_line(roads, "Ponahawai St")
    corner = kinoole.intersection(ponahawai)
    if corner.geom_type != "Point":
        raise SystemExit(f"parking_exempt: Kinoole and Ponahawai meet as {corner.geom_type}")
    # Kinoʻole runs from Waianuenue Avenue by the river (its first point) to Ponahawai
    k_end = Point(kinoole.coords[0])
    k_seg = substring(kinoole, 0, kinoole.project(corner))
    # Ponahawai comes in two pieces a few metres apart; join them, then take the corner to its bay end
    if ponahawai.geom_type == "MultiLineString":
        pieces = sorted(ponahawai.geoms, key=lambda p: p.distance(corner))
        gap = shapely.shortest_line(pieces[0], pieces[1])
        ponahawai = merge([*pieces, gap])
        if ponahawai.geom_type != "LineString":
            ponahawai = max(ponahawai.geoms, key=lambda p: p.length)
    bay_end = max((Point(ponahawai.coords[0]), Point(ponahawai.coords[-1])), key=lambda p: p.y)
    a, b = sorted([ponahawai.project(corner), ponahawai.project(bay_end)])
    p_seg = substring(ponahawai, a, b)
    if Point(p_seg.coords[0]).distance(corner) > 1:
        p_seg = LineString(p_seg.coords[::-1])
    # the straight extension of its last stretch, well out into the bay
    (x1, y1), (x2, y2) = p_seg.coords[-2], p_seg.coords[-1]
    d = math.hypot(x2 - x1, y2 - y1)
    out = (x2 + 3000 * (x2 - x1) / d, y2 + 3000 * (y2 - y1) / d)
    # the river's line ends by Kinoʻole's end; below that TIGER maps the river, and the bay, as water areas
    river = named_line(read(LINEAR_WATER, "FULLNAME = 'Wailuku Riv'"), "Wailuku Riv")
    river = min(getattr(river, "geoms", [river]), key=lambda r: r.distance(k_end))
    r_end = min((Point(river.coords[0]), Point(river.coords[-1])), key=lambda p: p.distance(k_end))
    top = max(out[1], r_end.y) + 3000
    region = shapely.make_valid(Polygon(
        list(k_seg.coords)[::-1] + list(p_seg.coords)[1:] + [out, (out[0], top), (r_end.x, top), r_end.coords[0]]))
    water = read(AREA_WATER)
    water = shapely.union_all(water.geometry.values[shapely.dwithin(water.geometry.values, k_end, 5000)])
    barrier = shapely.union_all([water, river.buffer(2), LineString([k_end, r_end]).buffer(2)])
    land = region.difference(barrier)
    # the downtown piece: the land along both Kinoʻole and Ponahawai
    parts = [p for p in getattr(land, "geoms", [land]) if p.distance(k_seg) < 1 and p.distance(p_seg) < 1]
    if not parts:
        raise SystemExit("parking_exempt: no land between Kinoole, Ponahawai and the river")
    return max(parts, key=lambda p: p.area)


def sqft_per_unit(zone: str) -> float | None:
    """A Hawaiʻi County district's density limit, sqft of land per unit: an RM, RCX or V code's number
    in thousands (25-5-31(a) and the matching RCX and V sections), CDH's 500 (25-7-22(a)(17)), and the
    commercial districts' flat 1,250 (25-5-102(a)(14) and the matching CG and CV sections)."""
    if zone == "CDH":
        return 500
    m = re.fullmatch(r"(RM|RCX|V)-(\d*\.?\d+)", zone)
    if m:
        return float(m.group(2)) * 1000
    if re.fullmatch(r"(CG|CN|CV)-\d+(\.\d+)?", zone):
        return 1250
    return None


def kainaliu_frontage(parcels: gpd.GeoDataFrame) -> set[str]:
    """TMKs immediately fronting the Belt Highway from TMK 7-9-7:66 to 7-9-9:22 (25-4-59.2(3))."""
    ends = parcels.set_index("tmk").geometry.reindex(list(KAINALIU_ENDS))
    if ends.isna().any():
        raise SystemExit(f"parking_exempt: Kainaliu end parcel missing: {ends[ends.isna()].index.tolist()}")
    a, b = (g.centroid for g in ends)
    roads = read(ROADS, "MTFCC = 'S1200'")
    near = roads.geometry.values[shapely.dwithin(roads.geometry.values, a, 500)
                                 | shapely.dwithin(roads.geometry.values, b, 500)]
    hwy = merge(near)
    if hwy.geom_type == "MultiLineString":
        # the highway comes in pieces (and as several names over the same line); join the two nearest
        pa = min(hwy.geoms, key=lambda g: g.distance(a))
        pb = min(hwy.geoms, key=lambda g: g.distance(b))
        hwy = pa if pa.equals(pb) else merge([pa, pb, shapely.shortest_line(pa, pb)])
        if hwy.geom_type != "LineString":
            hwy = max(hwy.geoms, key=lambda g: -(g.distance(a) + g.distance(b)))
    lo, hi = sorted([hwy.project(a), hwy.project(b)])
    stretch = substring(hwy, lo, hi)
    geoms = parcels.geometry.values
    tmks = parcels["tmk"].values
    tree = shapely.STRtree(geoms)
    front = set()
    for i in tree.query(stretch, predicate="dwithin", distance=FRONTAGE_M):
        g = geoms[i]
        # fronting: the straight line from the parcel to the road crosses no other parcel
        link = shapely.shortest_line(g, stretch)
        inner = substring(link, 0.5, max(0.5, link.length - 0.5))
        blockers = [j for j in tree.query(inner, predicate="intersects") if j != i
                    and shapely.intersection(geoms[j], inner).length > 1]
        if not blockers:
            front.add(tmks[i])
    return front


def hawaii_parking_exempt(parcels: gpd.GeoDataFrame) -> tuple[pd.Series, dict[str, int]]:
    """Whether each Hawaiʻi County parcel is exempt, and how many by rule. `parcels` has tmk,
    zone_label and the parcel geometry on the parcels' grid; every zoned parcel in the county."""
    core = hilo_core()
    centres = parcels.geometry.representative_point()
    density = parcels["zone_label"].map(sqft_per_unit)
    hilo = centres.within(core) & density.le(HILO_MAX_SQFT_PER_UNIT)
    kainaliu = parcels["tmk"].isin(kainaliu_frontage(parcels))
    counts = {"downtown Hilo": int(hilo.sum()), "Kainaliu frontage": int(kainaliu.sum()),
              "DPC district": 0, "downtown Hilo area, any district": int(centres.within(core).sum())}
    return hilo | kainaliu, counts

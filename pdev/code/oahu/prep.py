import json, re, numpy as np, pandas as pd
from shapely.geometry import shape, Point, Polygon, MultiPolygon
from shapely.strtree import STRtree
r = pd.read_csv('roll2022.tsv', sep='\t', dtype={'TMK': str})
r['tmk8'] = r.TMK.str[:8]; r['suf'] = r.TMK.str[8:]
g = r.groupby('tmk8').agg(L=('Land_Val', 'sum'), B=('Build_Val', 'sum'), EX=('Tot_Exemption', 'sum'), nrec=('TMK', 'size'))
p = pd.read_csv('parcels.tsv', sep='\t', dtype={'tmk': str}).drop_duplicates('tmk').set_index('tmk')
p['lot'] = p.rec_area_sf.fillna(p.rec_area_ac * 43560).fillna(p.Shape__Area)
p.loc[p.lot <= 0, 'lot'] = p.Shape__Area
d = g.join(p[['lot', 'lon', 'lat', 'type', 'street_parcel']], how='inner')
# zoning
Z = json.load(open('zoning.json'))
geoms, zc = [], []
for f in Z:
    rings = f['geometry']['rings'] if f.get('geometry') else []
    if not rings: continue
    try: poly = Polygon(rings[0], rings[1:]).buffer(0)
    except Exception: continue
    geoms.append(poly); zc.append(f['attributes']['zone_class'])
tree = STRtree(geoms)
zone = []
for x, y in zip(d.lon.values, d.lat.values):
    z = None
    if np.isfinite(x):
        pt = Point(x, y)
        for j in tree.query(pt):
            if geoms[j].contains(pt): z = zc[j]; break
    zone.append(z)
d['zone'] = zone
# 2026 class (land use proxy)
c = pd.read_csv('roll2026.tsv', sep='\t', dtype={'tmk': str, 'ovrclass': str, 'taxratecode': str})
c['tmk8'] = c.tmk.str[:8]
cls = c.groupby('tmk8').taxratecode.agg(lambda s: s.mode().iat[0] if s.notna().any() else '')
d['cls26'] = cls.reindex(d.index)
# permits
pm = pd.read_csv('permits.csv', dtype=str)
pm['dt'] = pd.to_datetime(pm.issuedate, errors='coerce')
for k in ['numunitsadd', 'numunitsdel', 'estimatedvalueofwork', 'totalfloorarea']: pm[k] = pd.to_numeric(pm[k], errors='coerce').fillna(0)
pm['tmks'] = pm.tmk.fillna('').apply(lambda s: re.findall(r'\d{8}', s))
pm = pm[pm.tmks.str.len() > 0].explode('tmks')
pm.to_pickle('pm.pkl'); d.to_pickle('d.pkl')
print(len(d), d.zone.notna().mean(), d.zone.value_counts().head(25).to_dict())
print(pm.dt.dt.year.value_counts().sort_index().tail(8).to_dict())
print(d.cls26.value_counts().head(12).to_dict())

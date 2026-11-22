import json, numpy as np, pandas as pd, collections
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
a = pd.read_csv('m2020.tsv', sep='\t', dtype={'TMK': str}); b = pd.read_csv('m2025.tsv', sep='\t', dtype={'TMK': str}); c = pd.read_csv('m2024.tsv', sep='\t', dtype={'TMK': str})
b['TMK'] = b.TMK.str.replace(r'\.0$', '', regex=True); c['TMK'] = c.TMK.astype(str).str.replace(r'\.0$', '', regex=True)
m = a.merge(b[['TMK', 'LandValue', 'BldgValue']], on='TMK', how='left', suffixes=('', '_25')).merge(c[['TMK', 'BldgValue']].rename(columns={'BldgValue': 'B24'}), on='TMK', how='left')
Z = json.load(open('mzoning.json')); geoms, zd = [], []
for f in Z:
    g = f.get('geometry') or {}
    if not g.get('rings'): continue
    try: geoms.append(Polygon(g['rings'][0], g['rings'][1:]).buffer(0)); zd.append(f['attributes'].get('zone_dist') or '')
    except Exception: pass
tree = STRtree(geoms); zz = []
for x, y in zip(m.lon.values, m.lat.values):
    z = None
    if np.isfinite(x):
        pt = Point(x, y)
        for j in tree.query(pt):
            if geoms[j].contains(pt): z = zd[j]; break
    zz.append(z)
m['zone'] = zz
print(collections.Counter(m.zone).most_common(25))
m.to_pickle('m.pkl')

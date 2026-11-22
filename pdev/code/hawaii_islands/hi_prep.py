# Hawaii vacant lots, same rules as the AZ/OR measurement (residential/rural lots 3,500 sq ft-10 ac, plat-scale developer clusters excluded).
import json, numpy as np, pandas as pd
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
W = './'  # run from a folder holding oahu/, maui/ and islands/ outputs
def zone_join(lon, lat, zfile, key):
    Zs = json.load(open(zfile)); G, V = [], []
    for f in Zs:
        g = f.get('geometry') or {}
        if not g.get('rings'): continue
        try: G.append(Polygon(g['rings'][0], g['rings'][1:]).buffer(0)); V.append(str(f['attributes'].get(key) or ''))
        except Exception: pass
    tr = STRtree(G); out = []
    for x, y in zip(lon, lat):
        z = ''
        if np.isfinite(x):
            pt = Point(x, y)
            for j in tr.query(pt):
                if G[j].contains(pt): z = V[j]; break
        out.append(z)
    return np.array(out)
rows = []
# Oahu: 2022 roll (values Oct 2021) -> 2026 roll (Oct 2025): 4 years. Vacant lot built = building value > $200k on the later roll.
u = pd.read_pickle(W + 'oahu/u.pkl'); c26 = pd.read_csv(W + 'oahu/roll2026.tsv', sep='\t', dtype={'tmk': str}); c26['t'] = c26.tmk.str[:8]
u['B2'] = c26.groupby('t').buildingvalue.sum().reindex(u.index)
o = u[u.grp.str.startswith('Res') & (u.lot.between(3500, 435600)) & (u.B == 0) & u.B2.notna()].copy()
o['ev'] = o.B2 > 200000; o['grp2'] = o.index.str[:5]
rows.append(pd.DataFrame({'area': 'Oahu', 'id': o.index, 'grp': o.grp2, 'lon': o.lon, 'lat': o.lat, 'lot_sqft': o.lot, 'land': o.L, 'ev': o.ev, 'yrs': 4.0, 'miss': 0.0}))
# Maui: 2020 -> 2025 roll: 5 years (Lahaina sections excluded upstream)
m = pd.read_pickle(W + 'maui/u.pkl'); m = m[m.grp.str.startswith('Res') & (m.BldgValue == 0) & m.lot.between(3500, 435600)]
rows.append(pd.DataFrame({'area': 'Maui', 'id': m.TMK, 'grp': m.TMK.str[1:6], 'lon': m.lon, 'lat': m.lat, 'lot_sqft': m.lot, 'land': m.LandValue, 'ev': m.ev, 'yrs': 5.0, 'miss': 0.0}))
# Hawaii County: vacant = no dwelling in the statewide units layer (dwelling data ~Oct 2022); built = building value > $75k on the 2026 roll: ~3 years
h = pd.read_csv(W + 'islands/haw.txt', sep='\t', dtype={'tmk': str}); h['zone'] = zone_join(h.lon.values, h.lat.values, W + 'islands/zhaw.txt', 'zone')
h['lot'] = h.taxacres.fillna(h.gisacres) * 43560
un = pd.read_csv(W + 'islands/units2024.tsv', sep='\t', dtype={'TMK': str}); hu = set(un[un.county.str.startswith('Haw')].TMK.str[:9])
tot = h.landvalue + h.bldgvalue; gov = ((h.landexempt + h.bldgexempt) > 0.5 * tot) & (h.homeowner != 'Y')
h = h[~gov & (h.landvalue > 5000) & h.lot.between(3500, 435600)].copy()
h['cls'] = np.select([h.zone.str.match(r'^(RS|RD)'), h.zone.str.match(r'^(RA|A-1a|A-3a)')], ['Hawaii Co RS/RD', 'Hawaii Co rural'], '')
h = h[h.cls != ''].copy(); h['has'] = h.tmk.str[:9].isin(hu)
MISS = 659 / 110000                                      # share of homes the units layer misses (dated on Oahu)
for c, g in h.groupby('cls'):
    v = g[~g.has]; miss = MISS * g.has.sum() / max(len(v), 1)   # expected old homes per vacant lot wrongly counted as new
    rows.append(pd.DataFrame({'area': c, 'id': v.tmk, 'grp': v.tmk.str[:6], 'lon': v.lon, 'lat': v.lat, 'lot_sqft': v.lot, 'land': v.landvalue, 'ev': v.bldgvalue > 75000, 'yrs': 3.0, 'miss': miss}))
H = pd.concat(rows, ignore_index=True)
cnt = H[H.ev].groupby(['area', 'grp']).size(); dev = set(cnt[cnt >= 5].index)
H['devsub'] = [(a, g) in dev for a, g in zip(H.area, H.grp)]
H.to_pickle(W + 'hi_vacant.pkl')
for a, g in H.groupby('area'):
    o = g[~g.devsub]; p = max(o.ev.mean() - o.miss.iloc[0], 0)
    print(f'{a}: vacant {len(g)}, organic {len(o)}, built {int(o.ev.sum())}, devsub share of builds {g.devsub[g.ev].mean():.2f}, annual {1 - (1 - p) ** (1 / o.yrs.iloc[0]):.2%}, median land $/sf {np.median(o.land / o.lot_sqft):.1f}')

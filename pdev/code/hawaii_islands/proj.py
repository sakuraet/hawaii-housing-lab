import json, numpy as np, pandas as pd
from scipy.optimize import minimize
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree
H = '../oahu/'; MU = '../maui/'
lg = lambda z: 1 / (1 + np.exp(-z))
# ---------- fitting data (Oahu roll-change 2022->2026, Maui 2020->2025), single-family zones, lots >= 3,500 sq ft
d = pd.read_pickle(H + 'd.pkl'); u = pd.read_pickle(H + 'u.pkl')
c26 = pd.read_csv(H + 'roll2026.tsv', sep='\t', dtype={'tmk': str}); c26['tmk8'] = c26.tmk.str[:8]
u = u[(u.lot >= 3500) & u.grp.str.startswith('Res')].copy(); u['B2'] = c26.groupby('tmk8').buildingvalue.sum().reindex(u.index)
u = u[u.B2.notna() & ~((u.B > 50000) & (u.B2 < 0.5 * u.B))]
u['evr'] = (u.B2 > 1.091 * u.B + 200000) & (u.B2 > 2 * 1.091 * u.B)
ve = u[(u.B == 0) & u.evr]; cnt = ve.index.str[:5].value_counts(); u = u[~((u.B == 0) & u.index.str[:5].isin(set(cnt[cnt >= 5].index)))]
m = pd.read_pickle(MU + 'u.pkl'); m = m[m.grp.str.startswith('Res') & ~m.subdiv]
F = pd.DataFrame({'isl': np.r_[np.zeros(len(u)), np.ones(len(m))], 'T': np.r_[np.full(len(u), 4.0), np.full(len(m), 5.0)],
                  'y': np.r_[u.evr.values, m.ev.values].astype(float), 'L': np.r_[u.L.values, m.LandValue.values], 'B': np.r_[u.B.values, m.BldgValue.values], 'lot': np.r_[u.lot.values, m.lot.values]})
LPMED = np.median(np.log(np.clip(F.L / F.lot, 2, 2000)))
def feats(L, B, lot):
    L, B, lot = map(np.asarray, (L, B, lot)); ilr = B / np.maximum(L, 1); vac = (B <= 0).astype(float)
    lx = np.where(vac == 1, 0, np.log(np.clip(ilr, 0.01, None))); ll = np.log(np.clip(lot, 2000, 200000) / 5000); lp = np.log(np.clip(L / lot, 2, 2000)) - LPMED
    return np.c_[np.ones(len(L)), vac, lx, ll, lp, lp * lx, lp * vac], ilr
Xf, ilrf = feats(F.L, F.B, F.lot); isl = F.isl.values; y = F.y.values; T = F['T'].values
def Z(th, X, il, it): z = X @ th[:7]; return z + (th[7] * il + th[8] * il * X[:, 1] + th[9] * il * X[:, 2]) if it else z
def nll(th, it):
    q = np.clip(1 - (1 - lg(Z(th, Xf, isl, it))) ** T, 1e-10, 1 - 1e-10); return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
g0 = minimize(nll, [-6.7, 1.8, -0.8, 1.4, 1.2, 0, 0], args=(False,), method='BFGS').x
g1 = minimize(nll, np.r_[g0, 0, 0, 0], args=(True,), method='BFGS').x
# ---------- share of roll-change "events" on built lots that are new homes (Oahu: permits vs roll-change), by building/land bin
bins = [-0.001, 0, 0.1, 0.2, 0.3, 0.5, 1e9]
ub = pd.cut(u.B / u.L, bins); r_perm = u.groupby(ub, observed=False).ev.mean(); r_roll = u.groupby(ub, observed=False).evr.mean()
share = ((1 - (1 - r_perm) ** (1 / 3.5)) / (1 - (1 - r_roll) ** (1 / 4))).clip(upper=1.0).values.copy(); share[0] = 1.0
print('new-home share of roll-change events by building/land bin:', np.round(share, 2))
def P5(L, B, lot, mode):
    X, ilr = feats(L, B, lot); n = len(X)
    if mode == 'pooled': z = Z(g0, X, np.zeros(n), False)
    else: z = Z(g1, X, np.full(n, 0.0 if mode == 'oahu' else 1.0), True)
    p5 = 1 - (1 - lg(z)) ** 5; k = np.clip(np.digitize(ilr, bins[1:-1], right=True), 0, len(share) - 1)
    return p5 * share[np.where(np.asarray(B) <= 0, 0, k)], ilr
def zone_join(lon, lat, zfile, key):
    Zs = json.load(open(zfile)); G, V = [], []
    for f in Zs:
        g = f.get('geometry') or {}
        if not g.get('rings'): continue
        try: G.append(Polygon(g['rings'][0], g['rings'][1:]).buffer(0)); V.append(str(f['attributes'].get(key) or ''))
        except Exception: pass
    tr = STRtree(G); out = []
    for x, yy in zip(lon, lat):
        z = ''
        if np.isfinite(x):
            pt = Point(x, yy)
            for j in tr.query(pt):
                if G[j].contains(pt): z = V[j]; break
        out.append(z)
    return np.array(out)
res = []
def report(name, L, B, lot, note='', extra=None):
    L, B, lot = map(np.asarray, (L, B, lot)); out = {}
    for mode in ['pooled', 'oahu', 'maui']: out[mode] = P5(L, B, lot, mode)[0].sum()
    lp = np.log(np.clip(L / lot, 2, 2000)); lo, hi = np.percentile(np.log(np.clip(F.L / F.lot, 2, 2000)), [1, 99])
    res.append(dict(area=name, lots=len(L), vacant=int((B <= 0).sum()), central=out['pooled'], low=min(out.values()), high=max(out.values()), outside_fit=float(((lp < lo) | (lp > hi)).mean()), note=note))
# ---------- Oahu now (2026 roll)
cur = c26.groupby('tmk8').agg(L=('landvalue', 'sum'), B=('buildingvalue', 'sum'), EX=('landexemption', 'sum'), EXB=('buildingexemption', 'sum'), n=('tmk', 'size'))
o = cur.join(d[['lot', 'zone', 'street_parcel']], how='inner')
pm = pd.read_pickle(H + 'pm.pkl'); recent = set(pm[(pm.newbuilding == 'Y') & (pm.numunitsadd >= 1) & (pm.dt >= '2024-01-01')].tmks)
o = o[o.zone.fillna('').str.match(r'^R-') & (o.n == 1) & (o.lot >= 3500) & (o.L > 20000) & ((o.EX + o.EXB) < 0.5 * (o.L + o.B)) & ~o.index.isin(recent) & (o.street_parcel != 1)]
report('Oʻahu', o.L, o.B, o.lot)
# ---------- Maui now (2025 roll), Lahaina sections excluded (fire rebuild modeled separately)
mm = pd.read_pickle(MU + 'm.pkl'); mm['lot'] = mm.TaxAcres * 43560
mm = mm[mm.zone.fillna('').str.match(r'^R-\d') & ~mm.TMK.str[1:3].isin(['45', '46']) & (mm.lot >= 3500) & (mm.LandValue_25 > 20000) & mm.BldgValue_25.notna()]
report('Maui (excl. Lahaina)', mm.LandValue_25, mm.BldgValue_25, mm.lot)
# ---------- Hawaii County now (2026 roll)
h = pd.read_csv('haw.txt', sep='\t'); h['zone'] = zone_join(h.lon.values, h.lat.values, 'zhaw.txt', 'zone'); h['lot'] = h.taxacres.fillna(h.gisacres) * 43560
tot = h.landvalue + h.bldgvalue; gov = ((h.landexempt + h.bldgexempt) > 0.5 * tot) & (h.homeowner != 'Y')
base = h[~gov & (h.landvalue > 5000) & (h.lot >= 3500)]
core = base[base.zone.str.match(r'^(RS|RD)')]; rural = base[base.zone.str.match(r'^(RA|A-1a|A-3a)')]
report('Hawaiʻi County: RS/RD single-family zones', core.landvalue, core.bldgvalue, core.lot)
report('Hawaiʻi County: rural subdivisions (RA, A-1a, A-3a)', rural.landvalue, rural.bldgvalue, rural.lot, note='outside the fitted land type')
# ---------- Kauai: no public assessed values -> borrow land $/sf and building/land from similar neighbor-island lots
k = pd.read_csv('kau_parcels.txt', sep='\t', dtype={'tmk': str}); k['zone'] = zone_join(k.lon.values, k.lat.values, 'zkau.txt', 'zoning')
un = pd.read_csv('kau.txt', sep='\t', dtype={'TMK': str}).set_index('TMK').COUNT_Units
k['units'] = un.reindex(k.tmk.astype(str)).fillna(0).values; k['lot'] = k.taxacres.fillna(k.gisacres) * 43560
k = k[k.zone.str.match(r'^R-\d') & (k.lot >= 3500) & ~k.owner.fillna('').str.contains('STATE OF HAWAII|COUNTY OF KAUAI|UNITED STATES|DEPT OF|HOUSING AGENCY')]
donors = pd.concat([pd.DataFrame({'L': mm.LandValue_25.values, 'B': mm.BldgValue_25.values, 'lot': mm.lot.values}),
                    pd.DataFrame({'L': core.landvalue.values, 'B': core.bldgvalue.values, 'lot': core.lot.values})])
donors['vac'] = donors.B <= 0; donors['ll'] = np.log(donors.lot)
tot_k = {'pooled': 0, 'oahu': 0, 'maui': 0}
for vac, grp in k.groupby(k.units == 0):
    dn = donors[donors.vac == vac].sort_values('ll'); ll = np.log(grp.lot.values)
    idx = np.searchsorted(dn.ll.values, ll)
    for mode in tot_k:
        pd_ = P5(dn.L.values, dn.B.values, dn.lot.values, mode)[0]; cs = np.r_[0, np.cumsum(pd_)]
        lo_ = np.clip(idx - 50, 0, len(dn)); hi_ = np.clip(idx + 50, 0, len(dn))
        tot_k[mode] += ((cs[hi_] - cs[lo_]) / np.maximum(hi_ - lo_, 1)).sum()
res.append(dict(area='Kauaʻi (values borrowed from Maui and Hawaiʻi County)', lots=len(k), vacant=int((k.units == 0).sum()), central=tot_k['pooled'], low=min(tot_k.values()), high=max(tot_k.values()), outside_fit=np.nan, note='no public assessed values'))
R = pd.DataFrame(res); R['per 1,000 lots per yr'] = 1000 * (1 - (1 - R.central / R.lots) ** (1 / 5))
pd.set_option('display.width', 220); print(R.round(3).to_string(index=False))
R.to_pickle('proj.pkl'); np.save('g0.npy', g0); np.save('g1.npy', g1)
print('g0', g0.round(3)); print('g1', g1.round(3))

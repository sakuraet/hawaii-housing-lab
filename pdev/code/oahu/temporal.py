# Held-out-years test. Fit on window A (2022 roll, permits Jan 2022 - Sep 2023);
# predict window B (TY2023 roll snapshot, permits Oct 2023 - Jun 2025) without refitting.
# Same pro forma assumptions in both windows (no retuning on B).
import numpy as np, pandas as pd
from scipy.optimize import minimize
from scipy.spatial import cKDTree
d = pd.read_pickle('d.pkl'); pm = pd.read_pickle('pm.pkl'); cp = pd.read_pickle('comps.pkl')
snap = pd.read_csv('roll2023snap.tsv', sep='\t', dtype={'tmk': str}).set_index('tmk')
pm['adu'] = (pm.accessorydwellingunitadu == 'Y') | (pm.ohana == 'Y') | pm.proposeduse.fillna('').str.contains('ADU|OHANA', case=False)
newu = pm[(pm.newbuilding == 'Y') & (pm.numunitsadd >= 1)]
main = newu[~(newu.adu & (newu.numunitsadd <= 1))]
HARD, SOFT, FIN, FEES, DEMO = 150.0, 0.15, 0.06, 15000, 25000
X = np.c_[np.ones(len(cp)), np.log(cp.L), np.log(cp.totalfloorarea)]; yv = np.log(cp.V.values)
k, *_ = np.linalg.lstsq(X, yv, rcond=None); res = yv - X @ k
xy = lambda df: np.c_[df.lon.values * 103900, df.lat.values * 110700]
tr = cKDTree(xy(cp))
lotb = [0, 4000, 5000, 6000, 7500, 10000, 15000, 1e12]; fav = [2307, 2434, 2594, 2692, 2856, 3239, 3022]

def build(L, B, w0, w1, prior0):
    x = d.copy(); x['L'] = L.reindex(x.index); x['B'] = B.reindex(x.index)
    x = x[x.L.notna()]
    ev = set(main[(main.dt >= w0) & (main.dt <= w1)].tmks); prior = set(main[(main.dt >= prior0) & (main.dt < w0)].tmks)
    x['ev'] = x.index.isin(ev)
    tot = x.L + x.B
    x = x[x.zone.fillna('').str.match(r'^R-') & (x.L > 20000) & (x.EX < 0.5 * tot) & (x.nrec == 1) & ~x.index.isin(prior) & (x.street_parcel != 1) & (x.lot >= 3500)].copy()
    dist, idx = tr.query(xy(x), k=30); w = np.exp(-(dist / 1500) ** 2); loc = (w * res[idx]).sum(1) / (w.sum(1) + 5)
    x['FA'] = np.array(fav)[np.digitize(x.lot, lotb[1:-1])]
    x['Vnew'] = np.exp(k[0] + k[1] * np.log(x.L) + k[2] * np.log(x.FA) + loc)
    x['R'] = x.Vnew / (x.L + x.B + HARD * x.FA * (1 + SOFT) * (1 + FIN) + FEES + np.where(x.B > 0, DEMO, 0))
    vac_ev = x[(x.B == 0) & x.ev]; cnt = vac_ev.index.str[:5].value_counts(); sub = set(cnt[cnt >= 5].index)
    x = x[~(x.index.str[:5].isin(sub) & (x.B == 0))]                      # developer subdivisions = pipeline
    x['vac'] = (x.B == 0).astype(float); x['lnR'] = np.log(x.R); x['lnR_vac'] = x.lnR * x.vac
    x['lnlpsf'] = np.log(x.L / x.lot); x['lnlot'] = np.log(x.lot / 5000); x['lnbl_b'] = np.log((x.B + 1000) / x.L) * (1 - x.vac)
    return x

ta = (pd.Timestamp('2022-01-01'), pd.Timestamp('2023-09-30')); tb = (pd.Timestamp('2023-10-01'), pd.Timestamp('2025-06-30'))
A = build(d.L, d.B, *ta, '2019-01-01')
B = build(snap.land_value_sum, snap.building_value_sum, *tb, '2020-10-01')
print('window A lots', len(A), 'events', int(A.ev.sum()), '| window B lots', len(B), 'events', int(B.ev.sum()))

def fit(Xm, y):
    def nll(t):
        q = np.clip(1 / (1 + np.exp(-(t[0] + Xm @ t[1:]))), 1e-12, 1 - 1e-12); g = q - y
        return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum(), np.r_[g.sum(), Xm.T @ g]
    return minimize(nll, np.r_[np.log(y.mean() / (1 - y.mean())), np.zeros(Xm.shape[1])], jac=True, method='L-BFGS-B').x
ll = lambda q, y: -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
rows = []
for spec, cols in [('R only', ['lnR']), ('R x vacant', ['lnR', 'vac', 'lnR_vac']), ('R x vacant + lot covariates', ['lnR', 'vac', 'lnR_vac', 'lnlpsf', 'lnlot', 'lnbl_b'])]:
    ya, yb = A.ev.values.astype(float), B.ev.values.astype(float)
    t = fit(A[cols].values, ya); qb = 1 / (1 + np.exp(-(t[0] + B[cols].values @ t[1:])))
    base = np.full(len(yb), ya.mean())
    B['q'] = qb; B['dec'] = pd.qcut(B.q.rank(method='first'), 10, labels=False)
    g = B.groupby('dec').agg(p=('q', 'sum'), o=('ev', 'sum'), v=('q', lambda s: (s * (1 - s)).sum()))
    inside = int(((g.o >= g.p - 1.645 * np.sqrt(g.v)) & (g.o <= g.p + 1.645 * np.sqrt(g.v))).sum())
    rows.append(dict(spec=spec, B_observed=int(yb.sum()), B_predicted=round(qb.sum(), 1), pct_err=round(100 * (qb.sum() / yb.sum() - 1), 1),
                     ll_model=round(ll(qb, yb), 1), ll_base_rate=round(ll(base, yb), 1), deciles_in_90=inside,
                     vacant_obs=int(yb[B.vac == 1].sum()), vacant_pred=round(qb[B.vac.values == 1].sum(), 1)))
    if spec.startswith('R x vacant +'): print(g.assign(lo=g.p - 1.645 * np.sqrt(g.v), hi=g.p + 1.645 * np.sqrt(g.v)).round(1).to_string())
out = pd.DataFrame(rows); print(out.to_string(index=False)); out.to_csv('temporal_test.csv', index=False)
print('R medians A/B:', round(A.R.median(), 3), round(B.R.median(), 3), ' share R>1 A/B:', round((A.R > 1).mean(), 4), round((B.R > 1).mean(), 4))

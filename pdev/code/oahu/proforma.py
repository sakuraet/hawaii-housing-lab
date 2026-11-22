import numpy as np, pandas as pd, sys
from scipy.spatial import cKDTree
HARD = float(sys.argv[1]) if len(sys.argv) > 1 else 300.0
SOFT, FIN, FEES, DEMO = 0.15, 0.06, 15000, 25000
d = pd.read_pickle('d.pkl'); u = pd.read_pickle('u.pkl'); cp = pd.read_pickle('comps.pkl')
xy = lambda df: np.c_[df.lon.values * 103900, df.lat.values * 110700]
# value of a new house: log V = k0 + k1 log L + k2 log FA, plus a local residual (30 nearest comps, shrunk)
X = np.c_[np.ones(len(cp)), np.log(cp.L), np.log(cp.totalfloorarea)]; yv = np.log(cp.V.values)
k, *_ = np.linalg.lstsq(X, yv, rcond=None); res = yv - X @ k
print('value model k =', k.round(3), ' R2 =', round(1 - res.var() / yv.var(), 3), ' resid sd', round(res.std(), 3))
r = u[u.grp == 'Residential (R-)'].copy()
tr = cKDTree(xy(cp)); dist, idx = tr.query(xy(r), k=30)
w = np.exp(-(dist / 1500) ** 2); loc = (w * res[idx]).sum(1) / (w.sum(1) + 5)      # shrunk toward 0 where comps are far
lotb = [0, 4000, 5000, 6000, 7500, 10000, 15000, 1e12]; fav = [2307, 2434, 2594, 2692, 2856, 3239, 3022]
r['FA'] = np.array(fav)[np.digitize(r.lot, lotb[1:-1])]
r['Vnew'] = np.exp(k[0] + k[1] * np.log(r.L) + k[2] * np.log(r.FA) + loc)
hard = HARD * r.FA
r['cost'] = r.L + r.B + hard * (1 + SOFT) * (1 + FIN) + FEES + np.where(r.B > 0, DEMO, 0)
r['R'] = r.Vnew / r.cost
r.to_pickle(f'r_{int(HARD)}.pkl')
print('R quantiles:', r.R.quantile([.01, .1, .25, .5, .75, .9, .99]).round(2).to_dict())
print('vacant median R', round(r[r.B == 0].R.median(), 2), ' built median R', round(r[r.B > 0].R.median(), 2))

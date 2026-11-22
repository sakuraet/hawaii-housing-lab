# Island-by-island p(dev) curves.
# Cost rule (chosen by Patrick): each island's hard cost per sq ft is set so that island's median vacant lot breaks even (R = 1),
# the same rule that set Oahu's $150. Profit is therefore comparable within an island, not across islands.
import json, numpy as np, pandas as pd
from scipy.optimize import minimize, brentq
W = './'
SOFT, FIN, FEES, DEMO = 0.15, 0.06, 15000, 25000
lotb = [0, 4000, 5000, 6000, 7500, 10000, 15000, 1e12]; fav = np.array([2307, 2434, 2594, 2692, 2856, 3239, 3022])   # new-house size by lot size (Oahu permits)
FA = lambda lot: fav[np.digitize(lot, lotb[1:-1])]
lg = lambda z: 1 / (1 + np.exp(-z))
def value_model(L_new, V_new, lot_new):
    """new-home value relative to land: log(V/L) = k0 + k1 log L + k2 log lot, fitted on that island's own newly built homes"""
    X = np.c_[np.ones(len(L_new)), np.log(L_new), np.log(lot_new)]; y = np.log(V_new / L_new)
    k, *_ = np.linalg.lstsq(X, y, rcond=None); r = y - X @ k
    return k, float(1 - r.var() / y.var()), len(y)
def ratio(L, B, lot, k, hard):
    V = L * np.exp(k[0] + k[1] * np.log(L) + k[2] * np.log(lot))
    return V / (L + B + hard * FA(lot) * (1 + SOFT) * (1 + FIN) + FEES + np.where(B > 0, DEMO, 0))
def anchor(Lv, lotv, k):  # hard cost at which the median vacant lot has R = 1
    return brentq(lambda h: np.median(ratio(Lv, 0 * Lv, lotv, k, h)) - 1, 1, 2000)
def fit_curve(lnR, y, T, extra=None, nb=300, seed=1):
    X = np.c_[np.ones(len(y)), lnR] if extra is None else np.c_[np.ones(len(y)), lnR, extra]
    def nll(t, X=X, y=y, T=T):
        q = np.clip(1 - (1 - lg(X @ t)) ** T, 1e-12, 1 - 1e-12); return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
    t = minimize(nll, np.r_[-3, np.zeros(X.shape[1] - 1)], method='BFGS').x
    r = np.random.default_rng(seed); B = []
    for _ in range(nb):
        j = r.integers(0, len(y), len(y)); B.append(minimize(lambda tt: nll(tt, X[j], y[j], T[j]), t, method='BFGS').x)
    return t, np.array(B)
def cv_loss(lnR, y, T, grp, extra=None):
    rng = np.random.default_rng(7); ug = pd.unique(grp); fo = dict(zip(ug, rng.integers(0, 5, len(ug)))); fold = np.array([fo[g] for g in grp])
    out = {}
    for name, use in [('flat', False), ('curve', True)]:
        q = np.zeros(len(y))
        for f in range(5):
            tr, te = fold != f, fold == f
            if use:
                t, _ = fit_curve(lnR[tr], y[tr], T[tr], None if extra is None else extra[tr], nb=0)
                X = np.c_[np.ones(te.sum()), lnR[te]] if extra is None else np.c_[np.ones(te.sum()), lnR[te], extra[te]]
                q[te] = 1 - (1 - lg(X @ t)) ** T[te]
            else: q[te] = y[tr].mean()
        q = np.clip(q, 1e-9, 1 - 1e-9); out[name] = -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
    return out
res = {}
# ---------------- Maui: 2020 roll -> 2025 roll (5 years)
m = pd.read_pickle(W + 'maui/u.pkl'); m = m[m.grp.str.startswith('Res') & ~m.subdiv & m.lot.between(3500, 435600)].copy()
nv = m[(m.BldgValue == 0) & m.ev & (m.BldgValue_25 > 100000)]
km, r2m, nm = value_model(nv.LandValue_25.values, (nv.LandValue_25 + nv.BldgValue_25).values, nv.lot.values)
vm = m[m.BldgValue == 0]; hm = anchor(vm.LandValue.values, vm.lot.values, km)
vm['R'] = ratio(vm.LandValue.values, 0 * vm.LandValue.values, vm.lot.values, km, hm)
res['Maui'] = dict(cost=hm, vm_r2=r2m, vm_n=nm, df=vm, T=5.0)
# ---------------- Hawaii County: units layer (~Oct 2022) -> 2026 roll (~3 years). Values: 2026 land (no earlier roll public).
H = pd.read_pickle(W + 'hi_vacant.pkl'); H = H[H.area.str.startswith('Hawaii Co')].copy()
cnt = H[H.ev].groupby(['area', 'grp']).size(); dev = set(cnt[cnt >= 5].index)   # same developer rule as the rest of the Hawaii set
h = pd.read_csv(W + 'islands/haw.txt', sep='\t', dtype={'tmk': str}).set_index('tmk')
H = H.join(h[['bldgvalue', 'homeowner']], on='id')
new = H[H.ev]; kh, r2h, nh = value_model(new.land.values, (new.land + new.bldgvalue).values, new.lot_sqft.values)
for area in ['Hawaii Co RS/RD', 'Hawaii Co rural']:
    d = H[(H.area == area) & ~H.devsub].copy(); hc = anchor(d.land.values, d.lot_sqft.values, kh)
    d['R'] = ratio(d.land.values, 0 * d.land.values, d.lot_sqft.values, kh, hc)
    res[area] = dict(cost=hc, vm_r2=r2h, vm_n=nh, df=d, T=3.0)
# ---------------- Oahu vacant (permits), for reference with the same code
x = pd.read_pickle(W + 'oahu/x_explore.pkl'); xv = x[x.vac == 1].copy()
res['Oahu (permits)'] = dict(cost=150.0, vm_r2=0.932, vm_n=1434, df=xv.assign(ev=xv.y.astype(bool)), T=3.5)
Ho = pd.read_pickle(W + 'hi_vacant.pkl'); Ho = Ho[(Ho.area == 'Oahu')].set_index('id')
Ho = Ho.join(xv[['R']], how='inner'); Ho['grp'] = Ho.index.str[:5]
res['Oahu'] = dict(cost=150.0, vm_r2=0.932, vm_n=1434, df=Ho, T=4.0)
out = {}
for k_, r in res.items():
    d = r['df']; lnR = np.log(np.clip(d.R.values, 0.05, 20)); y = d.ev.values.astype(float); T = np.full(len(y), r['T'])
    grp = (d.index.str[:5] if k_.startswith('Oahu') else d.TMK.str[1:6].values if k_ == 'Maui' else d.grp.values)
    t, B = fit_curve(lnR, y, T); cv = cv_loss(lnR, y, T, np.asarray(grp))
    p5 = lambda z: 1 - (1 - lg(z)) ** 5
    pts = {f'{q:+.0%}': round(float(p5(t[0] + t[1] * np.log(1 + q))), 3) for q in [-0.4, -0.2, 0, 0.2]}
    bins = pd.cut(d.R - 1, [-1, -0.4, -0.2, 0, 0.2, 10]); obs = d.groupby(bins, observed=True).ev.agg(['size', 'mean'])
    obs['5yr'] = 1 - (1 - obs['mean']) ** (5 / r['T'])
    out[k_] = dict(cost_per_sqft=round(r['cost'], 0), value_model_r2=round(r['vm_r2'], 2), value_model_n=r['vm_n'], lots=len(y), built=int(y.sum()),
                   a=round(float(t[0]), 3), b=round(float(t[1]), 3), b_sd=round(float(B[:, 1].std()), 3), cv_flat=round(cv['flat'], 1), cv_curve=round(cv['curve'], 1), curve_5yr=pts,
                   observed=' | '.join(f'{iv}: {int(n)} lots, {v:.1%}' for iv, (n, mm, v) in obs.iterrows()))
    np.save(W + f'curveB_{k_.replace(" ", "_").replace("/", "")}.npy', B)
for k_, o in out.items(): print(k_, json.dumps(o, indent=1))
json.dump(out, open(W + 'island_vacant_curves.json', 'w'), indent=1)

# ---------------- shared slope vs island-specific slopes (completed-home outcome on every island)
areas = ['Oahu', 'Maui', 'Hawaii Co RS/RD', 'Hawaii Co rural']
rows = []
for a in areas:
    d = res[a]['df']; g = (d.index.str[:5] if a == 'Oahu' else d.TMK.str[1:6].values if a == 'Maui' else d.grp.values)
    rows.append(pd.DataFrame({'area': a, 'lnR': np.log(np.clip(d.R.values, 0.05, 20)), 'y': d.ev.values.astype(float), 'T': res[a]['T'], 'grp': a + '|' + pd.Series(np.asarray(g)).astype(str).values}))
D = pd.concat(rows, ignore_index=True); A = pd.get_dummies(D.area).astype(float)[areas].values
def design(kind):
    if kind == 'shared slope': return np.c_[A, D.lnR.values]
    if kind == 'separate slopes': return np.c_[A, A * D.lnR.values[:, None]]
    if kind == 'flat': return A
y = D.y.values; T = D['T'].values
rng = np.random.default_rng(11); ug = D.grp.unique(); fo = dict(zip(ug, rng.integers(0, 5, len(ug)))); fold = D.grp.map(fo).values
def fitX(X, y, T):
    def nll(t): q = np.clip(1 - (1 - lg(X @ t)) ** T, 1e-12, 1 - 1e-12); return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
    return minimize(nll, np.r_[np.full(4, -3.5), np.zeros(X.shape[1] - 4)], method='BFGS').x
print('\nShared-slope test (held out by plat, all islands):')
for kind in ['flat', 'shared slope', 'separate slopes']:
    X = design(kind); q = np.zeros(len(y))
    for f in range(5):
        t = fitX(X[fold != f], y[fold != f], T[fold != f]); q[fold == f] = 1 - (1 - lg(X[fold == f] @ t)) ** T[fold == f]
    q = np.clip(q, 1e-9, 1 - 1e-9); L_ = -(y * np.log(q) + (1 - y) * np.log(1 - q))
    per = pd.Series(L_).groupby(D.area.values).sum().round(1).to_dict()
    print(f'  {kind:16s} total {L_.sum():8.1f}  by island {per}')
X = design('shared slope'); ts = fitX(X, y, T)
Bs = []
for _ in range(200):
    j = rng.integers(0, len(y), len(y)); Bs.append(fitX(X[j], y[j], T[j]))
Bs = np.array(Bs); json.dump({'areas': areas, 'intercepts': ts[:4].round(3).tolist(), 'slope': round(float(ts[4]), 3), 'boot': Bs.round(4).tolist()}, open(W + 'shared_slope.json', 'w'))
print('shared slope', round(ts[4], 3), '+/-', round(Bs[:, 4].std(), 3), ' intercepts', dict(zip(areas, ts[:4].round(2))))
print('5-yr at break-even:', {a: round(float(1 - (1 - lg(ts[i])) ** 5), 3) for i, a in enumerate(areas)})

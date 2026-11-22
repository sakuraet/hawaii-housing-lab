import numpy as np, pandas as pd
from scipy.optimize import minimize
r = pd.read_pickle('r_150.pkl'); r = r[r.lot >= 3500].copy()
pm = pd.read_pickle('pm.pkl')
# subdivision clusters: plats where 5+ vacant lots got permits in the window -> developer-controlled (pipeline), reported separately
vac_ev = r[(r.B == 0) & r.ev]; cnt = vac_ev.index.str[:5].value_counts(); sub = set(cnt[cnt >= 5].index)
r['subdiv'] = r.index.str[:5].isin(sub) & (r.B == 0)
x = r[~r.subdiv].copy()
x['m'] = x.R - 1
T = 3.5
bins = [-1, -0.4, -0.3, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.10, 0.15, 10]
lab = ['< −40%', '−40 to −30%', '−30 to −20%', '−20 to −15%', '−15 to −10%', '−10 to −5%', '−5 to 0%', '0 to 5%', '5 to 10%', '10 to 15%', '> 15%']
x['b'] = pd.cut(x.m, bins, labels=lab)
t = x.groupby('b', observed=False).agg(n=('ev', 'size'), built=('ev', 'sum'), vacant_share=('B', lambda s: (s == 0).mean()))
t['per_year'] = 1 - (1 - t.built / t.n) ** (1 / T); t['in_5_yrs'] = 1 - (1 - t.per_year) ** 5
print(t.to_string(float_format=lambda v: f'{v:.3f}'))
print('subdivision lots (developer-controlled): n', int(r.subdiv.sum()), 'built share 3.5y', round(r[r.subdiv].ev.mean(), 3))
# fit: P(built within 3.5y) = 1-(1-p)^3.5, p = c * logistic(a + b*ln R)
lnR = np.log(x.R.values); y = x.ev.values.astype(float)
def P(th, lnR):
    a, b, lc = th; c = 1 / (1 + np.exp(-lc)); p = c / (1 + np.exp(-(a + b * lnR))); return 1 - (1 - p) ** T
def nll(th, lnR, y):
    q = np.clip(P(th, lnR), 1e-9, 1 - 1e-9); return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
def fit(lnR, y, ceiling=True):
    best = None
    for st in ([-5, 5, 0], [-3, 10, -2], [-6, 20, -1], [-4, 8, 2]):
        th0 = np.array(st, float)
        if not ceiling: f = minimize(lambda t: nll(np.r_[t, 30], lnR, y), th0[:2], method='Nelder-Mead', options=dict(maxiter=4000)); f.x = np.r_[f.x, 30]
        else: f = minimize(lambda t: nll(t, lnR, y), th0, method='Nelder-Mead', options=dict(maxiter=6000))
        if best is None or f.fun < best.fun: best = f
    return best
fc, fn = fit(lnR, y, True), fit(lnR, y, False)
print('\nwith ceiling: a=%.2f b=%.2f ceiling c=%.3f per yr  nll=%.1f' % (fc.x[0], fc.x[1], 1 / (1 + np.exp(-fc.x[2])), fc.fun))
print('no ceiling:   a=%.2f b=%.2f                     nll=%.1f' % (fn.x[0], fn.x[1], fn.fun))
base = -(y * np.log(y.mean()) + (1 - y) * np.log(1 - y.mean())).sum(); print('base-rate nll=%.1f' % base)
for R_ in [0.8, 0.9, 1.0, 1.08, 1.15, 1.3, 1.5]:
    pc = (1 / (1 + np.exp(-fc.x[2]))) / (1 + np.exp(-(fc.x[0] + fc.x[1] * np.log(R_)))); pn = 1 / (1 + np.exp(-(fn.x[0] + fn.x[1] * np.log(R_))))
    print(f'  margin {R_-1:+.0%}: per year  ceiling-model {pc:.3%}  no-ceiling {pn:.3%}   | 5 yrs {1-(1-pc)**5:.1%} vs {1-(1-pn)**5:.1%}')
# held-out by TMK zone (first digit): fit on other zones, score this one
zone = x.index.str[0].values; out = []
for z in sorted(set(zone)):
    tr, te = zone != z, zone == z
    a = fit(lnR[tr], y[tr], True); b = fit(lnR[tr], y[tr], False); br = y[tr].mean()
    q = lambda th: np.clip(P(th, lnR[te]), 1e-9, 1 - 1e-9)
    ll = lambda qq: -(y[te] * np.log(qq) + (1 - y[te]) * np.log(1 - qq)).sum()
    out.append((z, te.sum(), int(y[te].sum()), round(P(a.x, lnR[te]).sum(), 1), round(P(b.x, lnR[te]).sum(), 1), round(ll(q(a.x)), 1), round(ll(q(b.x)), 1), round(ll(np.full(te.sum(), br)), 1)))
o = pd.DataFrame(out, columns=['TMK zone', 'parcels', 'built', 'pred_ceiling', 'pred_noceil', 'nll_ceiling', 'nll_noceil', 'nll_baserate'])
print('\nHeld out by TMK zone:'); print(o.to_string(index=False)); print('totals:', o[['built', 'pred_ceiling', 'pred_noceil', 'nll_ceiling', 'nll_noceil', 'nll_baserate']].sum().round(1).to_dict())
np.save('fit_ceiling.npy', fc.x); x.to_pickle('x.pkl'); t.to_pickle('t.pkl')

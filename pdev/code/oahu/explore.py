# Vacant vs built, neighborhood effects, covariates -- with out-of-sample checks.
# Outcome: new-home permit on the lot within the 3.5-yr window (2022-01 .. 2025-06), single-family zones.
import numpy as np, pandas as pd
from scipy.optimize import minimize
x = pd.read_pickle('x.pkl')                       # already excludes developer subdivisions
x = x[x.lot >= 3500].copy()
y = x.ev.values.astype(float)
x['vac'] = (x.B == 0).astype(float)
x['lnR'] = np.log(x.R)
x['lnlpsf'] = np.log(x.L / x.lot)                 # land $/sq ft
x['lnlot'] = np.log(x.lot / 5000)
x['lnbl'] = np.log((x.B + 1000) / x.L)            # building / land
z1 = x.index.str[0]; z2 = x.index.str[:2]; plat = x.index.str[:5]
rng = np.random.default_rng(7)
up = plat.unique(); fold_of = dict(zip(up, rng.integers(0, 5, len(up)))); fold = np.array([fold_of[p] for p in plat])

def design(spec):
    cols = {'R': ['lnR'], 'R+vac': ['lnR', 'vac'], 'R*vac': ['lnR', 'vac', 'lnR_vac'],
            'R*vac+cov': ['lnR', 'vac', 'lnR_vac', 'lnlpsf', 'lnlot', 'lnbl_b'],
            'cov only (no R)': ['vac', 'lnlpsf', 'lnlot', 'lnbl_b']}[spec]
    x['lnR_vac'] = x.lnR * x.vac; x['lnbl_b'] = x.lnbl * (1 - x.vac)
    X = x[cols].values; mu, sd = X.mean(0), X.std(0); return (X - mu) / sd

def fit(X, y, grp=None, lam=0.0, ngrp=0):
    k = X.shape[1]
    def nll(t):
        eta = t[0] + X @ t[1:k + 1]
        if grp is not None: eta = eta + t[k + 1:][grp]
        q = 1 / (1 + np.exp(-eta)); q = np.clip(q, 1e-12, 1 - 1e-12)
        pen = lam * (t[k + 1:] ** 2).sum() if grp is not None else 0
        g = q - y; gr = np.r_[g.sum(), X.T @ g]
        if grp is not None: gr = np.r_[gr, np.bincount(grp, g, ngrp) + 2 * lam * t[k + 1:]]
        return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum() + pen, gr
    t0 = np.r_[np.log(y.mean() / (1 - y.mean())), np.zeros(k), np.zeros(ngrp if grp is not None else 0)]
    return minimize(nll, t0, jac=True, method='L-BFGS-B').x

def pred(t, X, grp=None):
    k = X.shape[1]; eta = t[0] + X @ t[1:k + 1]
    if grp is not None: eta = eta + t[k + 1:][grp]
    return 1 / (1 + np.exp(-eta))

ll = lambda q, yy: -(yy * np.log(np.clip(q, 1e-12, 1)) + (1 - yy) * np.log(np.clip(1 - q, 1e-12, 1))).sum()
codes2 = pd.factorize(z2)[0]; n2 = codes2.max() + 1
rows = []
for spec in ['R', 'R+vac', 'R*vac', 'R*vac+cov', 'cov only (no R)']:
    X = design(spec)
    # (a) 5-fold CV by plat (areas held out within neighbourhoods)
    q = np.zeros(len(y)); qn = np.zeros(len(y))
    for f in range(5):
        tr, te = fold != f, fold == f
        q[te] = pred(fit(X[tr], y[tr]), X[te])
        tn = fit(X[tr], y[tr], codes2[tr], lam=2.0, ngrp=n2); qn[te] = pred(tn, X[te], codes2[te])
    # (b) leave-one-TMK-zone-out
    qz = np.zeros(len(y)); zerr = []
    for z in sorted(set(z1)):
        tr, te = z1 != z, z1 == z
        qz[te] = pred(fit(X[tr], y[tr]), X[te]); zerr.append((z, int(y[te].sum()), round(qz[te].sum(), 1)))
    rows.append(dict(spec=spec, cv_plat_ll=round(ll(q, y), 1), cv_plat_ll_with_section_FE=round(ll(qn, y), 1),
                     zone_out_ll=round(ll(qz, y), 1), zone_out_pred=round(qz.sum(), 1),
                     zone_out_mean_abs_pct_err=round(np.mean([abs(p - o) / o for _, o, p in zerr]) * 100, 1),
                     zones=' '.join(f'{z}:{o}/{p:.0f}' for z, o, p in zerr)))
    if spec == 'R*vac+cov': q_best, qn_best, X_best = q, qn, X
base = ll(np.full(len(y), y.mean()), y)
out = pd.DataFrame(rows); print('base-rate ll', round(base, 1), ' events', int(y.sum()), ' lots', len(y)); print(out.to_string(index=False))

# decile calibration (pre-registered check ii) for R*vac+cov, CV-by-plat predictions
x['q'] = q_best; x['y'] = y
x['dec'] = pd.qcut(x.q.rank(method='first'), 10, labels=False)
cal = x.groupby('dec').agg(n=('y', 'size'), pred=('q', 'sum'), obs=('y', 'sum'))
cal['lo90'] = cal.pred - 1.645 * np.sqrt(x.groupby('dec').q.apply(lambda s: (s * (1 - s)).sum()))
cal['hi90'] = cal.pred + 1.645 * np.sqrt(x.groupby('dec').q.apply(lambda s: (s * (1 - s)).sum()))
cal['inside'] = (cal.obs >= cal.lo90) & (cal.obs <= cal.hi90)
print('\nDecile calibration (CV by plat, R*vac+cov):'); print(cal.round(1).to_string()); print('deciles inside 90% band:', int(cal.inside.sum()), '/ 10')

# vacant vs built: coefficients on the natural scale (R*vac, full data, unstandardised)
for v, lab in [(1, 'vacant'), (0, 'built')]:
    s = x.vac == v; X1 = x.loc[s, ['lnR']].values
    t = fit(X1, y[s]); print(f'{lab:7s} lots {s.sum():6d} events {int(y[s].sum()):4d}  3.5-yr logit: a={t[0]:.2f} b={t[1]:.2f}',
          ' | P(3.5yr) at margin 0/+15%:', ' '.join(f'{pred(t, np.array([[np.log(r)]]))[0]:.3f}' for r in (1.0, 1.15)))
for v, lab in [(1, 'vacant'), (0, 'built')]:
    s = x.vac == v
    tb = x[s].groupby(pd.cut(x[s].m, [-1, -.3, -.2, -.1, 0, .1, .2, 10]), observed=True).agg(n=('y', 'size'), built=('y', 'sum'))
    tb['pct_3.5yr'] = (tb.built / tb.n * 100).round(2); print('\n', lab); print(tb.to_string())

# neighbourhood: observed vs expected by TMK zone-section, from covariate model (no area terms), shrunk
x['exp'] = q_best
ns = x.groupby(z2).agg(lots=('y', 'size'), obs=('y', 'sum'), exp=('exp', 'sum'))
k0 = 15.0
ns['shrunk_ratio'] = (ns.obs + k0) / (ns.exp + k0)
ns = ns[ns.lots >= 300].sort_values('shrunk_ratio')
print('\nZone-section obs/exp (shrunk, sections with >=300 lots):'); print(ns.round(2).to_string())
x.to_pickle('x_explore.pkl'); out.to_csv('explore_specs.csv', index=False); ns.to_csv('explore_sections.csv'); cal.to_csv('explore_calibration.csv')

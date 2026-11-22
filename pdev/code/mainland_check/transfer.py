# Does mainland (AZ + OR) vacant-lot behaviour predict Hawaii? Held-out tests, no tuning on the held-out areas.
import numpy as np, pandas as pd
from scipy.optimize import minimize
V = pd.read_pickle('work/vacant_all.pkl')
H = pd.read_pickle('work/hi_vacant.pkl')
def g400(lon, lat): return ((lon * 111320 * np.cos(np.radians(lat))) // 400).astype(int).astype(str) + '_' + ((lat * 110540) // 400).astype(int).astype(str)
H['grp'] = g400(H.lon, H.lat)
M = pd.DataFrame({'area': V.county, 'grp': V.grp, 'lot_sqft': V.lot_sqft, 'land': V.land, 'ev': V.ev, 'yrs': 5.0, 'miss': 0.0, 'fips': V.fips})
fips_hi = {'Oahu': '15003', 'Maui': '15009', 'Hawaii Co RS/RD': '15001', 'Hawaii Co rural': '15001'}
H['fips'] = H.area.map(fips_hi)
D = pd.concat([M.assign(src='mainland'), H[M.columns].assign(src='hawaii')], ignore_index=True)
# county market heat: 1-unit permits 2020-24 per 1,000 residents (2020)
b = pd.read_csv('data/bps_az_or_hi.csv', dtype={'fips': str}); b = b[b.year.between(2020, 2024)].groupby('fips').u1.sum()
pop = pd.read_csv('data/pop.txt', sep='|', header=None, dtype=str); pop['fips'] = pop[0] + pop[1]; pop = pop.set_index('fips')[3].astype(float)
heat = (b / pop * 1000 / 5); D['heat'] = D.fips.map(heat)             # per 1,000 residents per year
# developer-cluster rules (applied identically everywhere, on ~400 m cells; Jackson OR uses its map pages)
cell = D.groupby(['area', 'grp']).agg(n=('ev', 'size'), e=('ev', 'sum'), yrs=('yrs', 'first'))
cell['ann'] = 1 - (1 - cell.e / cell.n) ** (1 / cell.yrs)
rules = {'none': set(), 'count>=5': set(cell[cell.e >= 5].index), 'count>=5 & cell rate>=5.6%/yr': set(cell[(cell.e >= 5) & (cell.ann >= 0.0559)].index)}
lg = lambda z: 1 / (1 + np.exp(-z))
def summarize(df):
    p = (df.ev.mean() - df.miss.mean()).clip(0); y = df.yrs.iloc[0]
    return pd.Series({'lots': len(df), 'built': int(df.ev.sum()), 'annual_%': 100 * (1 - (1 - p) ** (1 / y)), 'land_$sf_med': np.median(df.land / df.lot_sqft), 'heat': df.heat.iloc[0]})
for name, dev in rules.items():
    D['dev_' + name] = [(a, g) in dev for a, g in zip(D.area, D.grp)]
    print(f'\n=== organic vacant-lot build rates, rule: {name}')
    print(D[~D['dev_' + name]].groupby('area').apply(summarize, include_groups=False).round(2).to_string())
RULE = 'dev_count>=5 & cell rate>=5.6%/yr'
O = D[~D[RULE]].copy()
O['x1'] = np.log(np.clip(O.land / O.lot_sqft, 0.05, 2000)); O['x2'] = np.log(O.lot_sqft / 10000); O['x3'] = np.log(O.heat)
FEAT = ['x1', 'x2', 'x3']
def fit(df, feats):
    X = np.c_[np.ones(len(df)), df[feats].values, df.x1.values ** 2]; y = df.ev.values.astype(float); T = df.yrs.values
    def nll(t):
        q = np.clip(1 - (1 - lg(X @ t)) ** T, 1e-10, 1 - 1e-10); return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
    return minimize(nll, np.r_[-4, np.zeros(X.shape[1] - 1)], method='BFGS').x
def pred(t, df, feats):
    X = np.c_[np.ones(len(df)), df[feats].values, df.x1.values ** 2]; return (1 - (1 - lg(X @ t)) ** df.yrs.values)
def test(train, test_df, feats):
    t = fit(train, feats); q = pred(t, test_df, feats)
    rows = []
    for a, g in test_df.assign(q=q).groupby('area'):
        obs = g.ev.sum() - g.miss.sum(); rows.append((a, len(g), round(obs, 1), round(g.q.sum(), 1), round(100 * (g.q.sum() / obs - 1), 1) if obs > 0 else np.nan))
    return pd.DataFrame(rows, columns=['area', 'lots', 'observed', 'predicted', 'error_%']), t
mainland = O[O.src == 'mainland']; hawaii = O[O.src == 'hawaii']
print('\n=== Test 1: leave one mainland county out (fit on the other mainland counties)')
r1 = pd.concat([test(mainland[mainland.area != a], mainland[mainland.area == a], FEAT)[0] for a in mainland.area.unique()]); print(r1.to_string(index=False))
print('  mean abs error %:', round(r1.error_pct.abs().mean() if 'error_pct' in r1 else r1['error_%'].abs().mean(), 1))
print('\n=== Test 2: Hawaii fully held out (fit on all mainland counties)')
r2, t2 = test(mainland, hawaii, FEAT); print(r2.to_string(index=False)); print('  coefficients [const, ln land$/sf, ln lot, ln heat, (ln land$/sf)^2]:', np.round(t2, 3))
base = mainland.groupby('area').apply(lambda g: 1 - (1 - g.ev.mean()) ** 0.2, include_groups=False).median()
print(f'  naive benchmark (median mainland county annual rate {base:.2%}) predicts:', {a: round(len(g) * (1 - (1 - base) ** g.yrs.iloc[0]), 1) for a, g in hawaii.groupby('area')})
print('\n=== Test 3: does mainland data help a Hawaii model? leave one Hawaii area out')
ra = pd.concat([test(hawaii[hawaii.area != a], hawaii[hawaii.area == a], FEAT)[0] for a in hawaii.area.unique()])
rb = pd.concat([test(pd.concat([mainland, hawaii[hawaii.area != a]]), hawaii[hawaii.area == a], FEAT)[0] for a in hawaii.area.unique()])
print('Hawaii-only training:'); print(ra.to_string(index=False)); print('Hawaii + mainland training:'); print(rb.to_string(index=False))
print('  mean abs error %: Hawaii-only', round(ra['error_%'].abs().mean(), 1), ' | with mainland', round(rb['error_%'].abs().mean(), 1))
O.to_pickle('work/organic_all.pkl')

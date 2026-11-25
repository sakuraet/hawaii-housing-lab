# Does the market cycle explain how many existing single-family lots get rebuilt each quarter?
# Outcome: distinct existing R-zoned lots (TMKs in the 2022 roll) with a new-home permit, by quarter, 2005Q1-2025Q2.
# Tract building excluded: any plat (5-digit TMK prefix) with >= 5 such lots in one year is treated as a subdivision.
# Fit 2005-2017, predict 2018-2025Q2 untouched. Poisson GLM, no dummies for particular years.
import sys, numpy as np, pandas as pd
import statsmodels.api as sm
from fred_q import MORT, HPI, PPI, parse
W = './'
d = pd.read_pickle(W + 'd.pkl'); pm = pd.read_pickle(W + 'pm.pkl')
pm['adu'] = (pm.accessorydwellingunitadu == 'Y') | (pm.ohana == 'Y') | pm.proposeduse.fillna('').str.contains('ADU|OHANA', case=False)
newu = pm[(pm.newbuilding == 'Y') & (pm.numunitsadd >= 1) & ~(pm.adu & (pm.numunitsadd <= 1)) & (pm.numunitsadd <= 4)]
rlots = d[d.zone.fillna('').str.match(r'^R-')].index
e = newu[newu.tmks.isin(rlots) & newu.dt.between('2005-01-01', '2025-06-30')].sort_values('dt').drop_duplicates('tmks')
e['yr'] = e.dt.dt.year; e['plat'] = e.tmks.str[:5]
py = e.groupby(['plat', 'yr']).size(); tract = set(py[py >= 5].index)
e['tract'] = [(p, y) in tract for p, y in zip(e.plat, e.yr)]
inf = e[~e.tract]; inf['q'] = inf.dt.dt.to_period('Q')
q = pd.period_range('2005Q1', '2025Q2', freq='Q')
df = pd.DataFrame(index=q); df['n'] = inf.groupby('q').size().reindex(q).fillna(0)
df['tract_n'] = e[e.tract].groupby(e[e.tract].dt.dt.to_period('Q')).size().reindex(q).fillna(0)
df['mort'] = parse(MORT).reindex(q); df['ln_hpi_ppi'] = np.log(parse(HPI) / parse(PPI)).reindex(q)
df['d_hpi4'] = np.log(parse(HPI)).diff(4).reindex(q)          # last year's price growth
for s in (2, 3, 4): df[f's{s}'] = (df.index.quarter == s).astype(float)
print(df[['n', 'tract_n']].groupby(df.index.year).sum().astype(int).T.to_string())
tr = df.index.year <= 2017; te = ~tr
def run(cols, name):
    X = sm.add_constant(df[cols]) if cols else pd.DataFrame({'const': 1.0}, index=df.index)
    m = sm.GLM(df.n[tr], X[tr], family=sm.families.Poisson()).fit()
    mu = m.predict(X[te]); y = df.n[te]
    dev = 2 * np.sum(np.where(y > 0, y * np.log(y / mu), 0) - (y - mu))
    yrs = pd.DataFrame({'obs': y, 'pred': mu}).groupby(y.index.year).sum()
    print(f'\n{name}: train dispersion {m.pearson_chi2 / m.df_resid:.2f}; test deviance {dev:.1f}; test total obs {y.sum():.0f} pred {mu.sum():.0f} ({100 * (mu.sum() / y.sum() - 1):+.0f}%)')
    print('  coefs:', {k: round(v, 3) for k, v in m.params.items() if not k.startswith('s')}, ' se:', {k: round(v, 3) for k, v in m.bse.items() if not k.startswith('s')})
    print('  by year obs/pred:', ' '.join(f'{yr}:{int(r.obs)}/{r.pred:.0f}' for yr, r in yrs.iterrows()))
    return m
run(['s2', 's3', 's4'], 'constant + season')
run(['s2', 's3', 's4', 'mort'], 'mortgage rate')
run(['s2', 's3', 's4', 'mort', 'ln_hpi_ppi'], 'mortgage rate + price/cost')
run(['s2', 's3', 's4', 'mort', 'ln_hpi_ppi', 'd_hpi4'], 'mortgage + price/cost + price momentum')
# full-sample elasticity for the baseline range
X = sm.add_constant(df[['s2', 's3', 's4', 'mort', 'ln_hpi_ppi']]); mf = sm.GLM(df.n, X, family=sm.families.NegativeBinomial(alpha=0.05)).fit()
print('\nfull sample (NB): mort', round(mf.params.mort, 3), '+/-', round(mf.bse.mort, 3), ' ln(HPI/PPI)', round(mf.params.ln_hpi_ppi, 3), '+/-', round(mf.bse.ln_hpi_ppi, 3))
print('  => one point on the 30-yr mortgage rate changes infill starts by', f'{100 * (np.exp(mf.params.mort) - 1):+.0f}%')
df.to_csv('cycle_quarterly.csv')

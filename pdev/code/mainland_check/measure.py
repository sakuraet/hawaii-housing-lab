# Vacant-lot build rates, 2020-2024, every county with lot-level data. Same rules as the Hawaii measurement:
#  - universe: residential (or rural-residential tract) lots, 3,500 sq ft to 10 acres, with a land value
#  - vacant at t0 (end 2019): no structure built before 2020
#  - event: main structure year built 2020-2024
#  - developer subdivisions: any plat-scale cluster (~400 m cell / map page) with >= 5 events -> pipeline, excluded
import numpy as np, pandas as pd
P = pd.read_pickle('work/parcels.pkl')
P = P[P.lot_sqft.between(3500, 435600) & (P.land > 1000)].copy()
P['built_pre'] = (P.yb < 2020) | ((P.cls == 'imp') & P.yb.isna() & (P.imp > 20000))   # improved with unknown year -> treat as old
P['ev'] = P.yb.between(2020, 2024)
V = P[~P.built_pre].copy()
cnt = V[V.ev].groupby(['county', 'grp']).size()
dev = set(cnt[cnt >= 5].index)
V['devsub'] = [(c, g) in dev for c, g in zip(V.county, V.grp)]
V['lpsf'] = V.land / V.lot_sqft
def rate(g, yrs=5):
    p5 = g.ev.mean(); return pd.Series({'vacant_t0': len(g), 'built': int(g.ev.sum()), 'p5': p5, 'annual': 1 - (1 - p5) ** (1 / yrs)})
print('All vacant-at-2019 lots (incl. developer subdivisions):'); print(V.groupby('county').apply(rate, include_groups=False).round(4).to_string())
O = V[~V.devsub]
print('\nOrganic (developer subdivisions excluded):'); T = O.groupby('county').apply(rate, include_groups=False); print(T.round(4).to_string())
print('\nshare of 2020-24 builds on vacant lots that were in developer subdivisions:', V.groupby('county').apply(lambda g: g.devsub[g.ev].mean(), include_groups=False).round(2).to_dict())
O['lb'] = pd.cut(O.lpsf, [0, 1, 3, 10, 30, 100, 1e6], labels=['<$1', '$1-3', '$3-10', '$10-30', '$30-100', '>$100'])
print('\nOrganic annual vacant-lot build rate by land $/sq ft:')
print(O.groupby(['county', 'lb'], observed=True).apply(lambda g: f"{100 * (1 - (1 - g.ev.mean()) ** 0.2):.1f}% (n={len(g)})", include_groups=False).unstack().to_string())
O.to_pickle('work/vacant_organic.pkl'); V.to_pickle('work/vacant_all.pkl'); T.to_csv('work/county_rates.csv')

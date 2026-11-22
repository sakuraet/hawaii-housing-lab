# Every AZ / OR (and HI) county: Census 1-unit permit baseline with an empirical 5-year range, plus measured organic vacant-lot rates where lot data exist,
# and a cross-check of the lot measurement against Census permits.
import numpy as np, pandas as pd
b = pd.read_csv('data/bps_az_or_hi.csv', dtype={'fips': str})
b['total'] = b.u1 + b.u2 + b.u34 + b.u5
pop = pd.read_csv('data/pop.txt', sep='|', header=None, dtype=str); pop.columns = ['st', 'co', 'name', 'p20', 'p24']; pop['fips'] = pop.st + pop.co
pop = pop.set_index('fips'); pop[['p20', 'p24']] = pop[['p20', 'p24']].astype(float)
rows = []
for f, g in b[b.fips.str[2:] != '000'].groupby('fips'):
    g = g.set_index('year').reindex(range(2005, 2026)).fillna(0)
    s5 = g.total.rolling(5).sum().dropna(); s1 = g.u1.rolling(5).sum().dropna()
    rows.append(dict(fips=f, county=pop.name.get(f, f), state={'04': 'AZ', '41': 'OR', '15': 'HI'}[f[:2]], pop2024=pop.p24.get(f, np.nan),
        u1_2020_24=g.u1.loc[2020:2024].sum(), all_2020_24=g.total.loc[2020:2024].sum(), mf_share_2020_24=(g.u5.loc[2020:2024].sum() / max(g.total.loc[2020:2024].sum(), 1)),
        mean5_2005_25=g.total.mean() * 5, p10_5yr=np.quantile(s5, .1), p90_5yr=np.quantile(s5, .9),
        u1_p10=np.quantile(s1, .1), u1_p90=np.quantile(s1, .9)))
C = pd.DataFrame(rows)
# Sherman and Wheeler (OR) issue no permits; Census reports them in 'Oregon balance of state'
C.loc[len(C)] = dict(fips='41055/41069', county='Sherman + Wheeler (Census: OR balance of state)', state='OR', pop2024=2002 + 1456)
# measured organic vacant-lot rates (2020-24) and the lot data's own count of new homes
O = pd.read_pickle('work/organic_all.pkl'); V = pd.read_pickle('work/vacant_all.pkl'); P = pd.read_pickle('work/parcels.pkl')
fmap = P.groupby('county').fips.first().to_dict()
meas = O[O.src == 'mainland'].groupby('area').apply(lambda g: pd.Series({'organic_vacant_lots_2019': len(g), 'organic_rate_annual': 1 - (1 - g.ev.mean()) ** 0.2}), include_groups=False)
yb = P[P.yb.between(2020, 2024)].groupby('county').size()
meas['lot_data_new_homes_2020_24'] = yb; meas['fips'] = meas.index.map(fmap)
C = C.merge(meas.reset_index(drop=True), on='fips', how='left')
C['lot_data_vs_census_1unit'] = C.lot_data_new_homes_2020_24 / C.u1_2020_24
C['data_tier'] = np.where(C.organic_rate_annual.notna(), 'A: lot-level values + year built', np.where(C.state == 'HI', 'A: lot-level values (roll-to-roll)', 'B: Census permits only'))
C.loc[C.fips.isin(['04019']), 'data_tier'] = 'B+: lot values, no year built (Pima)'
C.to_csv('work/county_table.csv', index=False)
pd.set_option('display.width', 250)
show = C[['state', 'county', 'pop2024', 'all_2020_24', 'mf_share_2020_24', 'p10_5yr', 'p90_5yr', 'organic_rate_annual', 'lot_data_vs_census_1unit', 'data_tier']]
print(show.round(3).to_string(index=False))
r = C.organic_rate_annual.dropna(); print('\nmainland organic vacant-lot rate: median %.2f%%, IQR %.2f-%.2f%%, range %.2f-%.2f%%' % (100 * r.median(), 100 * r.quantile(.25), 100 * r.quantile(.75), 100 * r.min(), 100 * r.max()))

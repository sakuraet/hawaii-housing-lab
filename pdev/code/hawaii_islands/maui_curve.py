import numpy as np, pandas as pd
m = pd.read_pickle('m.pkl')
g = 1.2245                                   # median building-value growth 2020->2025 for existing buildings
L0, B0, B5, B24 = m.LandValue, m.BldgValue, m.BldgValue_25, m.B24
m['lot'] = m.TaxAcres * 43560
fire = m.TMK.str[1:3].isin(['45', '46'])     # Lahaina sections 4-5, 4-6
destroyed = (B0 > 50000) & ((B24 < 0.5 * B0) | (B5 < 0.5 * B0))
exempt = (m.LandExempt + m.BldgExempt) > 0.5 * (L0 + B0)
m['ev'] = (B5 > g * B0 + 200000) & (B5 > 2 * g * B0)
m['grp'] = np.select([m.zone.fillna('').str.match(r'^R-\d'), m.zone.fillna('').str.match(r'^(A-|B-|Commercial Mixed)')], ['Residential (R-)', 'Apartment/business'], 'other')
u = m[(m.grp != 'other') & (L0 > 20000) & ~exempt & ~fire & ~destroyed & B5.notna() & (m.lot >= 3500)].copy()
u['ilr'] = u.BldgValue / u.LandValue
bins = [-0.001, 0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1e9]
labs = ['vacant', '0–0.05', '0.05–0.1', '0.1–0.2', '0.2–0.3', '0.3–0.5', '0.5–0.75', '0.75–1', '>1']
u['bin'] = pd.cut(u.ilr, bins, labels=labs)
# subdivision clusters among vacant lots (5+ built in same plat) -> developer-controlled
vb = u[(u.BldgValue == 0) & u.ev]; cnt = vb.TMK.str[1:6].value_counts(); sub = set(cnt[cnt >= 5].index)
u['subdiv'] = (u.BldgValue == 0) & u.TMK.str[1:6].isin(sub)
o = pd.read_pickle('../oahu/u.pkl'); o = o[(o.lot >= 3500)].copy()
ve = o[(o.B == 0) & o.ev]; c2 = ve.index.str[:5].value_counts(); o['subdiv'] = (o.B == 0) & o.index.str[:5].isin(set(c2[c2 >= 5].index))
o['bin'] = pd.cut(o.B / o.L, bins, labels=labs)
rows = []
for grp in ['Residential (R-)', 'Apartment/business']:
    mu = u[(u.grp == grp) & ~u.subdiv]; ou = o[(o.grp.str.startswith('Residential') if grp.startswith('Res') else ~o.grp.str.startswith('Residential')) & ~o.subdiv]
    tm = mu.groupby('bin', observed=False).ev.agg(['size', 'sum']); to = ou.groupby('bin', observed=False).ev.agg(['size', 'sum'])
    for bn in labs:
        po = to.loc[bn, 'sum'] / max(to.loc[bn, 'size'], 1); p5o = 1 - (1 - po) ** (5 / 3.5)
        rows.append((grp, bn, int(tm.loc[bn, 'size']), int(tm.loc[bn, 'sum']), tm.loc[bn, 'sum'] / max(tm.loc[bn, 'size'], 1), int(to.loc[bn, 'size']), p5o))
R = pd.DataFrame(rows, columns=['zones', 'building ÷ land', 'Maui lots', 'Maui built', 'Maui 5 yrs', 'Oʻahu lots', 'Oʻahu 5 yrs'])
print(R.to_string(index=False, float_format=lambda v: f'{v:.3f}'))
print('Maui subdivision (developer) lots: n', int(u.subdiv.sum()), 'built', round(u[u.subdiv].ev.mean(), 3))
print('Maui excluded: fire sections', int(((m.grp != 'other') & fire).sum()), 'destroyed/demolished', int(((m.grp != 'other') & destroyed & ~fire).sum()))
R.to_pickle('R.pkl'); u.to_pickle('u.pkl')

import numpy as np, pandas as pd
d = pd.read_pickle('d.pkl'); pm = pd.read_pickle('pm.pkl')
pm['adu'] = (pm.accessorydwellingunitadu == 'Y') | (pm.ohana == 'Y') | pm.proposeduse.fillna('').str.contains('ADU|OHANA', case=False)
newu = pm[(pm.newbuilding == 'Y') & (pm.numunitsadd >= 1)]
main = newu[~(newu.adu & (newu.numunitsadd <= 1))]          # new buildings with units, excluding ADU-only
W0, W1 = pd.Timestamp('2022-01-01'), pd.Timestamp('2025-06-30')
ev = main[(main.dt >= W0) & (main.dt <= W1)].groupby('tmks').agg(units=('numunitsadd', 'sum'), first=('dt', 'min'))
prior = set(main[(main.dt >= '2019-01-01') & (main.dt < W0)].tmks)
adu = set(newu[newu.adu & (newu.dt >= W0) & (newu.dt <= W1)].tmks)
d['ev'] = d.index.isin(ev.index); d['evu'] = ev.units.reindex(d.index).fillna(0); d['adu'] = d.index.isin(adu)
d['grp'] = np.select([d.zone.fillna('').str.match(r'^R-'), d.zone.fillna('').str.match(r'^(A-|AMX|Apart|BMX|B-|ResMix|Kak)')], ['Residential (R-)', 'Apartment/business (A, AMX, B, BMX)'], 'other')
tot = d.L + d.B
u = d[(d.grp != 'other') & (d.L > 20000) & (d.EX < 0.5 * tot) & (d.nrec == 1) & ~d.index.isin(prior) & (d.street_parcel != 1)].copy()
u['ilr'] = u.B / u.L
bins = [-0.001, 0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1.0, 1.5, 1e9]
labs = ['vacant (0)', '0–0.05', '0.05–0.1', '0.1–0.2', '0.2–0.3', '0.3–0.5', '0.5–0.75', '0.75–1', '1–1.5', '>1.5']
u['bin'] = pd.cut(u.ilr, bins, labels=labs)
yrs = 3.5
def tab(x):
    t = x.groupby('bin', observed=False).agg(n=('ev', 'size'), ev=('ev', 'sum'), units=('evu', 'sum'))
    t['P3.5y'] = t.ev / t.n; t['annual'] = 1 - (1 - t['P3.5y']) ** (1 / yrs); t['5yr'] = 1 - (1 - t.annual) ** 5
    return t
for gname, x in u.groupby('grp'):
    print('\n==', gname, 'parcels', len(x), 'events', int(x.ev.sum()))
    print(tab(x).to_string(float_format=lambda v: f'{v:.3f}'))
u.to_pickle('u.pkl')
print('\nexcluded: prior-permit parcels', len(prior), ' multi-record (condo/CPR) in zones', int(((d.grp!='other')&(d.nrec>1)).sum()))
print('ADU events (separate)', len(adu))

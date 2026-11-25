import numpy as np, pandas as pd
d = pd.read_pickle('d.pkl'); pm = pd.read_pickle('pm.pkl')
pm['comp'] = pd.to_datetime(pm.completeddate, errors='coerce')
sfr = pm[(pm.newbuilding == 'Y') & (pm.numunitsadd == 1) & pm.structurecode.fillna('').str.startswith('51') & (pm.totalfloorarea > 500) & (pm.totalfloorarea < 8000)]
# cost per sf from permits (estimated value of work), by year
c = sfr[(sfr.estimatedvalueofwork > 50000)].assign(cpsf=lambda x: x.estimatedvalueofwork / x.totalfloorarea, y=lambda x: x.dt.dt.year)
print('permit $/sf new SFR, median by year:', c[c.y.between(2015, 2025)].groupby('y').cpsf.median().round(0).to_dict())
# new homes built before the 2022 roll's valuation date (issued 2016-2019, completed before Oct 2021), single permit on parcel
b = sfr[(sfr.dt >= '2016-01-01') & (sfr.dt < '2020-01-01') & (sfr.comp < '2021-10-01')]
b = b[~b.tmks.duplicated(keep=False)].set_index('tmks')
nb = d.join(b[['totalfloorarea']], how='inner')
nb = nb[(nb.nrec == 1) & (nb.B > 50000) & (nb.zone.fillna('').str.startswith('R-'))]
nb['V'] = nb.L + nb.B
print('new-home comps', len(nb), 'median value', nb.V.median(), 'median FA', nb.totalfloorarea.median(), 'median lot', nb.lot.median())
# floor area of new houses vs lot size (all new SFR permits 2016-2021 matched to lots)
fa = sfr[(sfr.dt >= '2016-01-01') & (sfr.dt < '2022-01-01')].set_index('tmks').join(d[['lot']], how='inner')
fa = fa[fa.lot.between(2500, 40000)]
fa['lb'] = pd.cut(fa.lot, [2500, 4000, 5000, 6000, 7500, 10000, 15000, 40000])
print('new house floor area by lot size:', fa.groupby('lb', observed=True).totalfloorarea.median().round(0).to_dict())
nb.to_pickle('comps.pkl'); fa.to_pickle('fa.pkl')

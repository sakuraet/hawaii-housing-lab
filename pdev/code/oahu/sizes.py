# Project size vs cancellation, time to completion and volatility; what gets demolished for apartments.
import numpy as np, pandas as pd, re
p = pd.read_csv('permits.csv', dtype=str)
for c in ['numunitsadd', 'numunitsdel', 'estimatedvalueofwork', 'totalfloorarea', 'finalstories']: p[c] = pd.to_numeric(p[c], errors='coerce')
p['iss'] = pd.to_datetime(p.issuedate, errors='coerce'); p['done'] = pd.to_datetime(p.completeddate, errors='coerce'); p['y'] = p.iss.dt.year
p['u'] = p.numunitsadd.fillna(0)
def cls(r):
    if r.accessorydwellingunitadu == 'Y' or r.ohana == 'Y': return '0 ADU/ohana'
    if r.newbuilding != 'Y' or r.u < 1: return None
    if r.u == 1: return '1 single-family'
    if r.u <= 4: return '2 2-4 units'
    if r.u <= 19: return '3 5-19 units'
    if r.u <= 99: return '4 20-99 units'
    return '5 100+ units'
p['size'] = p.apply(cls, axis=1)
q = p[p['size'].notna() & p.y.between(2005, 2019)].copy()     # issued, with time to finish
q['cancel'] = q.statusdescription.isin(['Job Cancelled', 'Permit revoked', 'Cancelled - No Plans Uploaded'])
q['open'] = q.statusdescription.isin(['Inspection(s) in Progress', 'Start', 'Permit approved to issue'])
q['months'] = (q.done - q.iss).dt.days / 30.4
t = q.groupby('size').agg(permits=('u', 'size'), units=('u', 'sum'), cancelled_pct=('cancel', 'mean'), still_open_pct=('open', 'mean'),
                          med_months_to_complete=('months', 'median'), p75_months=('months', lambda s: s.quantile(.75)))
t['cancelled_pct'] *= 100; t['still_open_pct'] *= 100
w = q[~q.cancel].groupby('size').apply(lambda g: np.average(g.cancel, weights=g.u) if len(g) else np.nan, include_groups=False)
t['cancelled_units_pct'] = q.groupby('size').apply(lambda g: 100 * g.loc[g.cancel, 'u'].sum() / g.u.sum(), include_groups=False)
print('Permits issued 2005-2019 by project size (Oahu):'); print(t.round(1).to_string())

# year-to-year volatility of units permitted (net of cancellations), 2005-2024
a = p[p['size'].notna() & p.y.between(2005, 2024) & ~p.statusdescription.isin(['Job Cancelled', 'Permit revoked', 'Cancelled - No Plans Uploaded'])]
yr = a.pivot_table(index='y', columns='size', values='u', aggfunc='sum').fillna(0)
yr['5+ combined'] = yr[[c for c in yr.columns if c[0] in '345']].sum(1)
print('\nUnits permitted per year:'); print(yr.astype(int).to_string())
print('\nCoefficient of variation 2005-24:'); print((yr.std() / yr.mean()).round(2).to_string())
# issue year vs completion: big projects that took >5 yrs or never finished
yr.to_csv('units_by_year_size.csv'); t.to_csv('size_outcomes.csv')

# what is demolished, by what replaces it
p['tmks'] = p.tmk.fillna('').apply(lambda s: re.findall(r'\d{8}', s)); e = p.explode('tmks')
demo = e[e.demolition == 'Y'][['tmks', 'iss', 'numunitsdel', 'occupancygroupassessed', 'finalstories', 'proposeduse', 'existingfloorarea']]
new5 = e[(e.newbuilding == 'Y') & (e.u >= 5) & e.y.between(2005, 2025)][['tmks', 'iss', 'u', 'finalstories']]
m = new5.merge(demo, on='tmks', suffixes=('', '_d'))
m = m[(m.iss - m.iss_d).dt.days.between(-365, 6 * 365)]
site = new5.groupby('tmks').agg(units=('u', 'sum'), stories=('finalstories', 'max'))
dd = m.groupby('tmks').agg(units_del=('numunitsdel', 'sum'), demo_occ=('occupancygroupassessed', lambda s: s.mode().iat[0] if s.notna().any() else ''))
site = site.join(dd); site['prior'] = np.where(site.units_del.isna(), 'no demolition on record (vacant/parking/ag)',
                                np.where(site.units_del.fillna(0) == 0, 'non-residential demolished',
                                np.where(site.units_del < 5, 'house/duplex (1-4 units) demolished', 'apartment (5+ units) demolished')))
print('\nSites of new 5+ unit buildings, 2005-25, by what was there before:')
print(site.groupby('prior').agg(sites=('units', 'size'), new_units=('units', 'sum'), units_removed=('units_del', 'sum')).to_string())
dm = demo[demo.iss.dt.year.between(2005, 2025)]
print('\nDemolition permits 2005-25 by units removed:', pd.cut(dm.numunitsdel.fillna(0), [-1, 0, 1, 4, 19, 99, 1e6], labels=['0', '1', '2-4', '5-19', '20-99', '100+']).value_counts().sort_index().to_dict())
print('demolitions of 4+ storey buildings (finalstories field on demo permit):', int((dm.finalstories >= 4).sum()))

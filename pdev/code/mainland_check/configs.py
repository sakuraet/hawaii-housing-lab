# One YAML config per county (AZ 15, OR 36, HI 4): baseline permits, measured or prior p(dev) parameters, data sources, caveats.
import os, numpy as np, pandas as pd, yaml
yaml.SafeDumper.add_multi_representer(np.floating, lambda d, v: d.represent_float(float(v)))
yaml.SafeDumper.add_multi_representer(np.integer, lambda d, v: d.represent_int(int(v)))
yaml.SafeDumper.add_multi_representer(np.bool_, lambda d, v: d.represent_bool(bool(v)))
C = pd.read_csv('work/county_table.csv', dtype={'fips': str})
P = pd.read_pickle('work/parcels.pkl'); P = P[P.lot_sqft.between(3500, 435600) & (P.land > 1000)]
O = pd.read_pickle('work/organic_all.pkl'); D_all = pd.read_pickle('work/vacant_all.pkl')
# developer cells (same rule as transfer.py) to split currently-vacant lots into organic vs pipeline
cell = D_all.groupby(['county', 'grp']).agg(n=('ev', 'size'), e=('ev', 'sum')); cell['ann'] = 1 - (1 - cell.e / cell.n) ** 0.2
devc = set(cell[(cell.e >= 5) & (cell.ann >= 0.0559)].index)
now = P[(P.cls == 'vac') & P.yb.isna()].copy(); now['dev'] = [(c, g) in devc for c, g in zip(now.county, now.grp)]
r_all = C.organic_rate_annual.dropna(); PRIOR = dict(central=round(float(r_all.median()), 4), iqr=[round(float(r_all.quantile(.25)), 4), round(float(r_all.quantile(.75)), 4)],
    range=[round(float(r_all.min()), 4), round(float(r_all.max()), 4)], basis='median and spread of 8 measured AZ/OR counties, 2020-24; predicts Oahu, Maui and Hawaii County within about 30% (held-out test)')
SRC = {'04013': 'https://gis.maricopa.gov/arcgis/rest/services/IndividualService/Parcel/MapServer/1',
       '41051': 'https://services2.arcgis.com/McQ0OlIABe29rJJy/arcgis/rest/services/Taxlots_(Public)/FeatureServer/3',
       '41067': 'https://services2.arcgis.com/McQ0OlIABe29rJJy/arcgis/rest/services/Taxlots_(Public)/FeatureServer/3',
       '41005': 'https://services2.arcgis.com/McQ0OlIABe29rJJy/arcgis/rest/services/Taxlots_(Public)/FeatureServer/3',
       '41029': 'https://spatial.jacksoncountyor.gov/arcgis/rest/services/OpenData/ReferenceData/MapServer/3',
       '41035': 'https://services.arcgis.com/H6Mh1bySxR4oHx6x/arcgis/rest/services/KC_Taxlots/FeatureServer/1',
       '41039': 'https://lcmaps.lanecounty.org/arcgis/rest/services/PlanMaps/AddressParcel/MapServer/1',
       '41033': 'https://services2.arcgis.com/pc4beVTMEhYHqerq/arcgis/rest/services/tax_parcels/FeatureServer/0'}
PARTIAL = {'04019': 'Pima regional parcels (total FCV, use code; year built field empty): utility.arcgis.com/.../PropertyHousing/MapServer/17',
           '04003': 'Cochise Cad_Parcel_TaxInfo (total FCV, use code, no year built): services6.arcgis.com/Yxem0VOcqSy8T6TE',
           '04017': 'Navajo Parcels (building count, subdivision, no values): services.arcgis.com/cghC2lEIpJ2TRrs5',
           '04025': 'Yavapai Values service (land and improvement value layers, no year built found): services1.arcgis.com/BajuNXbtZNiBKFkx',
           '41017': 'Deschutes Taxlot_Assessor_Account (no values in public view): services1.arcgis.com/znO8Hz1SuVVohYhZ'}
os.makedirs('work/configs', exist_ok=True)
for _, r in C.iterrows():
    f = r.fips; st = r.state; nm = str(r.county)
    cfg = {'fips': f, 'county': nm, 'state': st, 'population_2024': None if pd.isna(r.pop2024) else int(r.pop2024), 'data_tier': r.data_tier,
           'baseline_permits': None if pd.isna(r.get('all_2020_24')) else {
               'source': 'Census Building Permits Survey, county annual (co{year}a.txt), 2005-2025', 'units_2020_24': int(r.all_2020_24), 'one_unit_2020_24': int(r.u1_2020_24),
               'five_plus_share_2020_24': round(float(r.mf_share_2020_24), 3), 'historical_5yr_total_p10_p90': [int(r.p10_5yr), int(r.p90_5yr)],
               'note': 'p10-p90 of rolling 5-year totals 2005-2025 (overlapping windows; includes the 2006-11 bust)'}}
    if f in SRC:
        cty = P[P.fips == f].county.iloc[0]; n_now = now[(now.county == cty)]; org = n_now[~n_now.dev]
        o = O[(O.area == cty)]; k, n = int(o.ev.sum()), len(o); p5 = k / n; se = np.sqrt(p5 * (1 - p5) / n)
        lo, hi = [1 - (1 - max(p5 + z * se, 0)) ** 0.2 for z in (-1.645, 1.645)]
        rate = 1 - (1 - p5) ** 0.2
        cfg['pdev_vacant_lots'] = {'source': SRC[f], 'window': '2020-2024 (year built)', 'organic_rate_annual': round(rate, 4), 'organic_rate_90ci': [round(float(lo), 4), round(float(hi), 4)],
            'vacant_lots_2019_organic': n, 'built_2020_24': k,
            'developer_share_of_vacant_lot_builds': round(float(D_all[(D_all.county == cty) & D_all.ev].pipe(lambda g: np.mean([(c, gg) in devc for c, gg in zip(g.county, g.grp)]))), 3),
            'vacant_lots_now': {'organic': int(len(org)), 'in_active_developer_clusters': int(n_now.dev.sum())},
            'organic_vacant_lot_builds_next_5yr': {'central': round(len(org) * (1 - (1 - rate) ** 5)),
                'sampling_90ci': [round(len(org) * (1 - (1 - lo) ** 5)), round(len(org) * (1 - (1 - hi) ** 5))],
                'market_cycle_range': [round(len(org) * (1 - (1 - rate) ** 5) * r.u1_p10 / r.u1_2020_24), round(len(org) * (1 - (1 - rate) ** 5) * r.u1_p90 / r.u1_2020_24)],
                'market_cycle_note': 'central x (p10 or p90 of rolling 5-yr 1-unit permits 2005-25 / 2020-24 1-unit permits); assumes organic building moves with the county 1-unit cycle'}}
    elif st != 'HI':
        cfg['pdev_vacant_lots'] = {'source': 'no public lot-level values with year built found; prior from measured AZ/OR counties', 'organic_rate_annual': PRIOR['central'], 'organic_rate_iqr': PRIOR['iqr'],
            'organic_rate_range': PRIOR['range'], 'basis': PRIOR['basis'], 'partial_parcel_source': PARTIAL.get(f, 'none found in ArcGIS Online search (Oct 2026)')}
    else:
        cfg['pdev_vacant_lots'] = {'source': 'see Hawaii package (roll-to-roll); mainland prior available as a cross-check', 'mainland_prior': PRIOR}
    cfg['not_modeled_here'] = ['teardown / infill on built lots (year built cannot separate a rebuild from a first build)', 'ADUs', 'multifamily', 'developer subdivision pipeline (counted, not modeled)']
    with open(f"work/configs/{st}_{f.replace('/', '_')}_{nm.split(' (')[0].replace(' ', '_').replace('+', 'and')}.yaml", 'w') as fh: yaml.safe_dump(cfg, fh, sort_keys=False, allow_unicode=True)
print(len(os.listdir('work/configs')), 'configs written')
for f in sorted(os.listdir('work/configs')):
    if 'Maricopa' in f or 'Klamath' in f: print(open('work/configs/' + f).read())

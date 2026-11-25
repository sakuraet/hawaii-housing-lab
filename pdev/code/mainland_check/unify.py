# Put every county parcel file into one schema:
# fips, county, id, grp (plat-like cluster), lot_sqft, land, imp, yb, cls ('vac'|'imp'), rural flag
import re, numpy as np, pandas as pd
R = 'data/'
num = lambda s: pd.to_numeric(s, errors='coerce')
def grid(lon, lat, m=400):  # ~400 m cells, same scale as an Oahu TMK plat / Oregon quarter-quarter section
    x = (num(lon) * 111320 * np.cos(np.radians(num(lat).fillna(0)))) // m; y = (num(lat) * 110540) // m
    return x.astype('Int64').astype(str) + '_' + y.astype('Int64').astype(str)
out = []
# --- Maricopa (AZ): PUC 00xx vacant land, 01xx single-family residence
m = pd.read_csv(R + 'az_maricopa.tsv.gz', sep='\t', dtype=str)
m = m[m.PropertyUseCode.str[:2].isin(['00', '01'])]
out.append(pd.DataFrame({'fips': '04013', 'county': 'Maricopa AZ', 'id': m.APN, 'grp': grid(m.Longitude_DD, m.Latitude_DD),
    'lot_sqft': num(m.LotSize_SqFt), 'land': num(m.LandFullCashValue), 'imp': num(m.ImprovementFullCashValue), 'yb': num(m.ConstructionYear),
    'cls': np.where(m.PropertyUseCode.str[:2] == '00', 'vac', 'imp')}))
# --- Oregon: DOR property class. 1xx residential, 4xx rural tract; 3rd digit 0 = vacant, 1 = improved (9 = manufactured, kept as improved)
def orcls(pc):
    pc = pc.fillna('').str.strip().str.zfill(3)
    keep = pc.str[0].isin(['1', '4']) & pc.str[2].isin(['0', '1', '9'])
    return keep, np.where(pc.str[2] == '0', 'vac', 'imp'), pc.str[0] == '4'
r = pd.read_csv(R + 'or_rlis.tsv.gz', sep='\t', dtype=str)
k, c, rur = orcls(r.PROP_CODE); r = r[k]; c = c[k.values]; rur = rur[k.values]
cn = {'M': ('41051', 'Multnomah OR'), 'W': ('41067', 'Washington OR'), 'C': ('41005', 'Clackamas OR')}
gx = (num(r.X_COORD) * 0.3048 // 400).astype('Int64').astype(str) + '_' + (num(r.Y_COORD) * 0.3048 // 400).astype('Int64').astype(str)
yb = num(r.YEARBUILT); yb = yb.where(yb > 1800)
out.append(pd.DataFrame({'fips': r.COUNTY.map(lambda z: cn[z][0]), 'county': r.COUNTY.map(lambda z: cn[z][1]), 'id': r.TLID, 'grp': gx,
    'lot_sqft': num(r.A_T_ACRES).where(num(r.A_T_ACRES) > 0, num(r.GIS_ACRES)) * 43560, 'land': num(r.LANDVAL), 'imp': num(r.BLDGVAL), 'yb': yb, 'cls': c, 'rural': rur}))
j = pd.read_csv(R + 'or_jackson.tsv.gz', sep='\t', dtype=str)
k, c, rur = orcls(j.PROPCLASS); j = j[k]
out.append(pd.DataFrame({'fips': '41029', 'county': 'Jackson OR', 'id': j.MAPLOT, 'grp': j.MAPLOT.str.replace(r'\d{3,5}$', '', regex=True),
    'lot_sqft': num(j.ACREAGE) * 43560, 'land': num(j.LANDVALUE), 'imp': num(j.IMPVALUE), 'yb': num(j.YEARBLT).where(num(j.YEARBLT) > 1800), 'cls': c[k.values], 'rural': rur[k.values]}))
kl = pd.read_csv(R + 'or_klamath.tsv.gz', sep='\t', dtype=str)
k, c, rur = orcls(kl.PCLS); kl = kl[k]
out.append(pd.DataFrame({'fips': '41035', 'county': 'Klamath OR', 'id': kl.MTL, 'grp': grid(kl.INSIDE_X, kl.INSIDE_Y),
    'lot_sqft': num(kl.ACREAGE) * 43560, 'land': num(kl.LND_APPR), 'imp': num(kl.IMP_APPR), 'yb': num(kl.YRBLT).where(num(kl.YRBLT) > 1800), 'cls': c[k.values], 'rural': rur[k.values]}))
la = pd.read_csv(R + 'or_lane.tsv.gz', sep='\t', dtype=str)
k, c, rur = orcls(la.PROPCL); la = la[k]
out.append(pd.DataFrame({'fips': '41039', 'county': 'Lane OR', 'id': la.MAPTAXLOT, 'grp': grid(la.LONGITUDE, la.LATITUDE),
    'lot_sqft': num(la.MAPACRES) * 43560, 'land': num(la.LANDVAL), 'imp': num(la.IMPVAL), 'yb': num(la.YEARBLT).where(num(la.YEARBLT) > 1800), 'cls': c[k.values], 'rural': rur[k.values]}))
jo = pd.read_csv(R + 'or_josephine.tsv.gz', sep='\t', dtype=str)
k, c, rur = orcls(jo.PROP_CLASS); jo = jo[k]
out.append(pd.DataFrame({'fips': '41033', 'county': 'Josephine OR', 'id': jo.ACCOUNT, 'grp': grid(jo.Longitude, jo.Latitude),
    'lot_sqft': num(jo.ACREAGE).where(num(jo.ACREAGE) > 0, num(jo.GIS_Acres)) * 43560, 'land': num(jo.LAND_MKT), 'imp': num(jo.IMP_VALUE).fillna(0), 'yb': num(jo.YR_BLT).where(num(jo.YR_BLT) > 1800), 'cls': c[k.values], 'rural': rur[k.values]}))
P = pd.concat(out, ignore_index=True); P['rural'] = P.rural.fillna(False).astype(bool)
P.to_pickle('work/parcels.pkl')
print(P.groupby('county').agg(n=('id', 'size'), vac=('cls', lambda s: (s == 'vac').mean()), yb_na=('yb', lambda s: s.isna().mean()),
      land_na=('land', lambda s: s.isna().mean()), lot_med=('lot_sqft', 'median'), yb20_24=('yb', lambda s: s.between(2020, 2024).sum())).round(3).to_string())

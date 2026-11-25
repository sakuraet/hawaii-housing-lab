import glob, re, gzip, json, numpy as np, pandas as pd, tifffile
from shapely.geometry import shape, Point
from shapely.strtree import STRtree
P=pd.read_pickle('hz_points.pkl'); P['slope']=np.nan
files=sorted(glob.glob('hz/slope*.tif'))
# prefer slope2_ re-downloads where both exist
keyed={}
for f in files:
    m=re.search(r'_(\d+)_(\d+)_(\d+)_(\d+)\.tif',f); k=tuple(map(int,m.groups()))
    if k not in keyed or 'slope2_' in f: keyed[k]=f
for (x0,y0,x1,y1),f in keyed.items():
    a=tifffile.imread(f); h,w=a.shape[:2]; px=(x1-x0)/w; py=(y1-y0)/h
    sel=(P.x>=x0)&(P.x<x1)&(P.y>=y0)&(P.y<y1)&P.slope.isna()
    c=((P.x[sel]-x0)/px).astype(int).clip(0,w-1); r=((y1-P.y[sel])/py).astype(int).clip(0,h-1)
    P.loc[sel,'slope']=a[r.values,c.values].astype(float)
    print(f.split('/')[-1], a.shape, a.dtype, f'px {px:.1f}x{py:.1f} m', 'points', int(sel.sum()))
print('slope coverage', P.slope.notna().mean().round(4), P.groupby('set').slope.describe().round(1).to_string())
# hazard polygons
H=[]
for fn in ['hz/hi_hazards.geojson.gz','hz/hi_hazards2.geojson.gz']:
    for f in json.load(gzip.open(fn))['features']:
        try: H.append((f['properties'].get('layer'), f['properties'].get('zone',''), shape(f['geometry']).buffer(0)))
        except Exception: pass
print('hazard polygons', pd.Series([h[0] for h in H]).value_counts().to_dict())
pts=[Point(a,b) for a,b in zip(P.lon,P.lat)]
names={5:'flood',4:'flood',14:'flood',8:'flood',3:'lava',7:'fire',2:'tsunami',12:'tsunami_extreme',15:'slr32'}
for col in set(names.values()): P[col]=False
P['lava_zone']=''; P['fire_risk']=''
for lay in sorted(set(h[0] for h in H)):
    G=[h for h in H if h[0]==lay]; tr=STRtree([g[2] for g in G]); col=names.get(lay)
    if col is None: continue
    hit=np.zeros(len(P),bool); lab=['']*len(P)
    for i,(qi,gi) in enumerate(zip(*tr.query(pts,predicate='intersects'))): hit[qi]=True; lab[qi]=str(G[gi][1])
    P[col]=P[col]|hit
    if col=='lava': P['lava_zone']=np.where(hit,lab,P.lava_zone)
    if col=='fire': P['fire_risk']=np.where(hit,lab,P.fire_risk)
P.to_pickle('hz_joined.pkl')
print(P.groupby('set')[['flood','tsunami','tsunami_extreme','slr32','lava','fire']].mean().round(3).to_string())
print(P[P.set.str.startswith('hc')].lava_zone.value_counts().to_dict(), P.fire_risk.value_counts().to_dict())

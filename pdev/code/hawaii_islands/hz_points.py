import pandas as pd, numpy as np
from pyproj import Transformer
exec(open('island_curves.py').read().split('\nout = {}\n')[0])
x=pd.read_pickle('oahu/x_explore.pkl')
rows=[]
b=x[x.vac==0]; rows.append(pd.DataFrame({'set':'oahu_house','id':b.index,'lon':b.lon,'lat':b.lat}))
xv=x[x.vac==1]; rows.append(pd.DataFrame({'set':'oahu_vac','id':xv.index,'lon':xv.lon,'lat':xv.lat}))
mm=pd.read_pickle('maui/u.pkl'); mm=mm[mm.grp.str.startswith('Res')&mm.lot.between(3500,435600)]
rows.append(pd.DataFrame({'set':'maui','id':mm.TMK.values,'lon':mm.lon.values,'lat':mm.lat.values}))
for a,s in [('Hawaii Co RS/RD','hc_town'),('Hawaii Co rural','hc_rural')]:
    d=res[a]['df']; rows.append(pd.DataFrame({'set':s,'id':d.id.values,'lon':d.lon.values,'lat':d.lat.values}))
P=pd.concat(rows,ignore_index=True).dropna(subset=['lon','lat']).reset_index(drop=True)
t=Transformer.from_crs(4326,3750,always_xy=True); P['x'],P['y']=t.transform(P.lon.values,P.lat.values)
P.to_pickle('hz_points.pkl'); print(len(P),P.set.value_counts().to_dict())
T=4000*10  # 40 km tiles at 10 m
P['tx']=(P.x//T).astype(int); P['ty']=(P.y//T).astype(int)
tiles=P.groupby(['tx','ty']).size().reset_index(name='n'); print(len(tiles),'tiles'); print(';'.join(f'{r.tx},{r.ty}' for r in tiles.itertuples()))

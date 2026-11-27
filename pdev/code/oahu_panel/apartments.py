import pandas as pd, numpy as np
g=pd.read_pickle('hnl_panel.pkl'); d=pd.read_pickle('../oahu/d.pkl'); m=pd.read_pickle('main_permits.pkl')
apz=d.zone.fillna('').str.match(r'^(A-|AMX|Apart|BMX|B-|ResMix|Kak)')
st=d.loc[apz,['lot','zone']]
ev=m[(m.numunitsadd>=5)]; evset=set(zip(ev.tmks,ev.yr)); units=ev.groupby(['tmks','yr']).numunitsadd.sum()
rows=[]
for Y in range(2017,2026):
    x=g[g.tax_year==Y].set_index('tmk8').join(st,how='inner')
    x=x[(x.nrec==1)&(x.L>20000)&(x.lot>=5000)]   # single-record lots (condo towers excluded), >=5,000 sq ft
    prior=set(ev[(ev.yr>=Y-5)&(ev.yr<Y)].tmks); x=x[~x.index.isin(prior)]
    x['ev']=[(t,Y) in evset for t in x.index]; x['u']=[units.get((t,Y),0) for t in x.index]
    x['Y']=Y; x['T']=0.5 if Y==2025 else 1.0; rows.append(x)
A=pd.concat(rows); A['ilr']=A.B/A.L
A['grp']=pd.cut(A.ilr,[-0.01,0.0001,0.25,0.75,1e9],labels=['vacant/parking','B/L<0.25','0.25-0.75','>0.75'])
t=A.groupby('grp',observed=False).agg(lot_years=('ev','size'),events=('ev','sum'),units=('u','sum'),T=('T','sum'))
t['annual']=t.events/t['T']; t['5yr']=1-(1-t.annual)**5
print(t.to_string(float_format=lambda v:f'{v:.4f}'))
# held-out by year halves: rates from 2017-2021 predict 2022-2025
for a,b in [((2017,2021),(2022,2025)),((2022,2025),(2017,2021))]:
    tr=A[A.Y.between(*a)]; te=A[A.Y.between(*b)]
    r=(tr.groupby('grp',observed=False).ev.sum()/tr.groupby('grp',observed=False)['T'].sum())
    pred=(te.grp.map(r).astype(float)*te['T']).sum()
    print(a,'->',b,'observed',int(te.ev.sum()),'predicted',round(pred,1),'flat-rate predicted',round(tr.ev.sum()/tr['T'].sum()*te['T'].sum(),1))
A.to_pickle('apt_panel.pkl')

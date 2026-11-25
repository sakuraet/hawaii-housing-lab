# Annual panel of Oahu single-family-zoned lots, tax years 2017-2025: values as of Oct 1 of Y-1 -> new-home permit issued in calendar year Y.
import numpy as np, pandas as pd, sys
from scipy.spatial import cKDTree
from fred_q import PPI, parse
W='../oahu/'   # outputs of code/oahu/prep.py and comps
g=pd.read_pickle('hnl_panel.pkl'); d=pd.read_pickle(W+'d.pkl'); pm=pd.read_pickle(W+'pm.pkl'); cp=pd.read_pickle(W+'comps.pkl')
pm['adu']=(pm.accessorydwellingunitadu=='Y')|(pm.ohana=='Y')|pm.proposeduse.fillna('').str.contains('ADU|OHANA',case=False)
newu=pm[(pm.newbuilding=='Y')&(pm.numunitsadd>=1)]
main=newu[~(newu.adu&(newu.numunitsadd<=1))].copy(); main['yr']=main.dt.dt.year
# completion info kept for the permit->finished conversion
main.to_pickle('main_permits.pkl')
evyr=main.groupby(['tmks','yr']).size().reset_index()[['tmks','yr']]
evset=set(zip(evyr.tmks,evyr.yr))
static=d[['lot','lon','lat','zone','street_parcel']]
ppi=parse(PPI)
X=np.c_[np.ones(len(cp)),np.log(cp.L),np.log(cp.totalfloorarea)]; yv=np.log(cp.V.values)
k,*_=np.linalg.lstsq(X,yv,rcond=None); res=yv-X@k
xy=lambda df: np.c_[df.lon.values*103900,df.lat.values*110700]; tr=cKDTree(xy(cp))
lotb=[0,4000,5000,6000,7500,10000,15000,1e12]; fav=[2307,2434,2594,2692,2856,3239,3022]
SOFT,FIN,FEES,DEMO=0.15,0.06,15000,25000
rows=[]
for Y in range(2017,2026):
    x=g[g.tax_year==Y].set_index('tmk8').join(static,how='inner')
    tot=x.L+x.B
    x=x[x.zone.fillna('').str.match(r'^R-')&(x.L>20000)&(x.EX<0.5*tot)&(x.nrec==1)&(x.street_parcel!=1)&(x.lot>=3500)].copy()
    prior=set(main[(main.yr>=Y-3)&(main.yr<Y)].tmks)
    x=x[~x.index.isin(prior)]
    x['ev']=[(t,Y) in evset for t in x.index]
    x['T']=0.5 if Y==2025 else 1.0
    x['Y']=Y
    dist,idx=tr.query(xy(x),k=30); w=np.exp(-(dist/1500)**2); loc=(w*res[idx]).sum(1)/(w.sum(1)+5)
    x['FA']=np.array(fav)[np.digitize(x.lot,lotb[1:-1])]
    x['Vnew']=np.exp(k[0]+k[1]*np.log(x.L)+k[2]*np.log(x.FA)+loc)
    for name,ci in [('flat',1.0),('ppi',ppi[pd.Period(f'{Y-1}Q4','Q')]/ppi[pd.Period('2021Q4','Q')])]:
        x['R_'+name]=x.Vnew/(x.L+x.B+150*ci*x.FA*(1+SOFT)*(1+FIN)+FEES+np.where(x.B>0,DEMO,0))
    rows.append(x)
P=pd.concat(rows); P.index.name='tmk8'; P=P.reset_index()
# developer subdivisions: vacant lots in a plat with >=5 vacant-lot permits in Y-1..Y+1
P['plat']=P.tmk8.str[:5]
vc=P[(P.B==0)&P.ev].groupby(['plat','Y']).size()
def nb(pl,Y): return sum(vc.get((pl,y),0) for y in (Y-1,Y,Y+1))
P['subdiv']=(P.B==0)&np.array([nb(a,b)>=5 for a,b in zip(P.plat,P.Y)])
P['own']=((P.EX>=80000)&(P.EX<=250000)).astype(float)
P.to_pickle('panel.pkl')
s=P[~P.subdiv].groupby('Y').agg(lots=('ev','size'),houses=('B',lambda b:(b>0).sum()),built=('ev','sum'),built_house=('ev',lambda e:e[P.loc[e.index,'B']>0].sum()),Rmed_flat=('R_flat','median'),Rmed_ppi=('R_ppi','median'))
print(s.round(3).to_string()); print('subdiv lots',int(P.subdiv.sum()))

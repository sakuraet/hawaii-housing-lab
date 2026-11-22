# Do slope and hazard layers improve the p(dev) curves on held-out data?
import numpy as np, pandas as pd
from scipy.optimize import minimize
exec(open('island_curves.py').read().split('\nout = {}\n')[0])
P=pd.read_pickle('hz_joined.pkl')
P['steep']=(P.slope>=20).astype(float); P['lnslope']=np.log1p(P.slope.fillna(0))
HZ=['lnslope','steep','flood','tsunami_extreme','slr32','fire_high']
lg=lambda z:1/(1+np.exp(-z))
def fitX(X,y,T):
    def nll(t):
        q=np.clip(1-(1-lg(X@t))**T,1e-12,1-1e-12); return -(y*np.log(q)+(1-y)*np.log(1-q)).sum()
    return minimize(nll,np.r_[-3.5,np.zeros(X.shape[1]-1)],method='BFGS').x
def cv(X,y,T,grp,reps=3):
    out=[]
    for rep in range(reps):
        rng=np.random.default_rng(30+rep); ug=pd.unique(grp); fo=dict(zip(ug,rng.integers(0,5,len(ug)))); fold=np.array([fo[g] for g in grp]); q=np.zeros(len(y))
        for f in range(5): t=fitX(X[fold!=f],y[fold!=f],T[fold!=f]); q[fold==f]=1-(1-lg(X[fold==f]@t))**T[fold==f]
        q=np.clip(q,1e-9,1-1e-9); out.append(-(y*np.log(q)+(1-y)*np.log(1-q)).sum())
    return np.mean(out)
def run(name,df,base,y,T,grp):
    rows=[]; X0=np.c_[np.ones(len(df)),df[base].values]; b0=cv(X0,y,T,grp); full0=fitX(X0,y,T)
    rows.append(('(current model)',np.nan,b0,0.0,np.nan,np.nan))
    for h in HZ+[c for c in df.columns if c.startswith('lava_') and c!='lava_zone']:
        v=df[h].astype(float).values
        if v.std()==0: continue
        X=np.c_[X0,v]; c=cv(X,y,T,grp); t=fitX(X,y,T)
        share=v.mean() if h!='lnslope' else np.nan
        rows.append((h,share,c,b0-c,t[-1],np.exp(t[-1]) if h!='lnslope' else np.nan))
    R=pd.DataFrame(rows,columns=['term','share_of_lots','cv_loss','gain','coef','rate_multiplier'])
    print(f'\n=== {name}: {len(df):,} lots, {int(y.sum()):,} built. gain = held-out loss reduction (>2 is meaningful)'); print(R.round(3).to_string(index=False))
    return R
out={}
# 1) Oahu lots with a house (permits), base = profit + owner-occupied
x=pd.read_pickle('oahu/x_explore.pkl'); b=x[x.vac==0].copy(); b['own']=((b.EX>=80000)&(b.EX<=250000)).astype(float); b['lnR']=np.log(b.R)
b=b.join(P[P.set=='oahu_house'].set_index('id')[HZ],how='inner')
out['oahu_house']=run('Oahu lots with a house',b,['lnR','own'],b.y.values.astype(float),np.full(len(b),3.5),b.index.str[:5].values)
# 2) vacant lots, all islands, shared profit slope with island levels
rows=[]
for a,s in [('Oahu','oahu_vac'),('Maui','maui'),('Hawaii Co RS/RD','hc_town'),('Hawaii Co rural','hc_rural')]:
    d=res[a]['df'].copy(); idx=(d.index if a=='Oahu' else d.TMK.values if a=='Maui' else d.id.values)
    g=(d.index.str[:5] if a=='Oahu' else d.TMK.str[1:6].values if a=='Maui' else d.grp.values)
    d=pd.DataFrame({'area':a,'id':np.asarray(idx),'lnR':np.log(np.clip(d.R.values,0.05,20)),'y':d.ev.values.astype(float),'T':res[a]['T'],'grp':a+'|'+pd.Series(np.asarray(g)).astype(str).values})
    hz=P[P.set==s].drop_duplicates('id').set_index('id')[HZ+['lava_zone']]
    rows.append(d.join(hz,on='id'))
V=pd.concat(rows,ignore_index=True); V=V[V.lnslope.notna()].copy()
for a in ['Oahu','Maui','Hawaii Co RS/RD','Hawaii Co rural']: V['is_'+a]=(V.area==a).astype(float)
lz=V.lava_zone.fillna('').astype(str)
V['lava_1_2']=lz.isin(['1','2']).astype(float); V['lava_3']=(lz=='3').astype(float)
base=['is_Maui','is_Hawaii Co RS/RD','is_Hawaii Co rural','lnR']
out['vacant']=run('Vacant lots, all islands (shared slope)',V,base,V.y.values,V['T'].values,V.grp.values)
# 3) Hawaii County rural vacant lots alone (largest sample; lava matters here)
Hr=V[V.area=='Hawaii Co rural'].copy()
out['hc_rural']=run('Hawaii County rural vacant lots',Hr,['lnR'],Hr.y.values,Hr['T'].values,Hr.grp.values)
pd.concat({k:v for k,v in out.items()}).to_csv('hz_results.csv')
print('\nlava zones among HC rural vacant lots:', Hr.lava_zone.fillna('').value_counts().head(8).to_dict())
# combined model: every term that helped on its own
for name,df,base,y,T,g,keep in [('Oahu lots with a house',b,['lnR','own'],b.y.values.astype(float),np.full(len(b),3.5),b.index.str[:5].values,out['oahu_house']),
                                ('Vacant lots, all islands',V,base,V.y.values,V['T'].values,V.grp.values,out['vacant'])]:
    good=keep[(keep.gain>2)].term.tolist()
    if good:
        X0=np.c_[np.ones(len(df)),df[base].values]; X1=np.c_[X0,df[good].astype(float).values]
        c0,c1=cv(X0,y,T,g),cv(X1,y,T,g); t=fitX(X1,y,T)
        print(f'\n{name}: combined {good}: held-out gain {c0-c1:.1f}; multipliers', dict(zip(good,np.round(np.exp(t[-len(good):]),2))))

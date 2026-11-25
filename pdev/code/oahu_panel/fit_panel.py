import numpy as np, pandas as pd, sys
from scipy.optimize import minimize
P=pd.read_pickle('panel.pkl')
b=P[(P.B>0)&~P.subdiv].copy(); b['lnbl']=np.log((b.B+1000)/b.L)
HZ=len(sys.argv)>1
if HZ:
    H=pd.concat([pd.read_pickle('../hz_joined.pkl'),pd.read_pickle('../hz_joined_extra.pkl')])
    H=H[H.set.isin(['oahu_house','oahu_vac','oahu_extra'])].drop_duplicates('id').set_index('id')
    b=b.join(H[['slope','tsunami_extreme','slr32']],on='tmk8',how='left'); print('hazard coverage',round(b.slope.notna().mean(),4))
    b=b[b.slope.notna()]; b['steep']=(b.slope>=20).astype(float)
print('house lot-years',len(b),'events',int(b.ev.sum()),'lots',b.tmk8.nunique())
lg=lambda z:1/(1+np.exp(-z))
def fitX(X,y,T):
    f=lambda t:(lambda q:-(y*np.log(q)+(1-y)*np.log(1-q)).sum())(np.clip(1-(1-lg(X@t))**T,1e-12,1-1e-12))
    return minimize(f,np.r_[np.log(y.mean()),np.zeros(X.shape[1]-1)],method='BFGS').x
TERMS=['lnR','own','lnbl']+(['steep','tsunami_extreme','slr32'] if HZ else [])
y=b.ev.values.astype(float); T=b['T'].values
res={}
for R in ['R_flat','R_ppi']:
    X=np.c_[np.ones(len(b)),np.log(b[R]),b[TERMS[1:]].astype(float).values]
    th=fitX(X,y,T); res[R]=th
    print(f'\n== {R}: all years coef',dict(zip(['const']+TERMS,np.round(th,3))))
    for tr_,te_ in [((2017,2021),(2022,2025)),((2022,2025),(2017,2021))]:
        m=b.Y.between(*tr_).values; n=b.Y.between(*te_).values
        t=fitX(X[m],y[m],T[m]); q=1-(1-lg(X[n]@t))**T[n]
        bt=b[n].assign(q=q).groupby('Y').agg(obs=('ev','sum'),pred=('q','sum')); bt['pred']=bt.pred.round(1)
        print(f' fit {tr_} -> {te_}: obs {int(bt.obs.sum())} pred {bt.pred.sum():.0f} ({100*(bt.pred.sum()/bt.obs.sum()-1):+.0f}%) | by year',bt.to_dict('index'))
    # leave-one-year-out
    rows=[]
    for Y in range(2017,2026):
        m=(b.Y!=Y).values; n=~m; t=fitX(X[m],y[m],T[m]); rows.append((Y,int(y[n].sum()),round((1-(1-lg(X[n]@t))**T[n]).sum(),1)))
    L=pd.DataFrame(rows,columns=['year','obs','pred']); L['err%']=(100*(L.pred/L.obs-1)).round(0)
    print(' leave-one-year-out:',L.to_dict('records'),' mean abs err %',round(L['err%'].abs().mean(),1))
np.save('house_panel_coef.npy',res['R_flat']); b.to_pickle('house_panel.pkl')

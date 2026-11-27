import numpy as np, pandas as pd, json
from scipy.optimize import minimize
b=pd.read_pickle('house_panel.pkl')
H=pd.concat([pd.read_pickle('../hz_joined.pkl'),pd.read_pickle('../hz_joined_extra.pkl')]); H=H[H.set.isin(['oahu_house','oahu_vac','oahu_extra'])].drop_duplicates('id').set_index('id')
if 'slope' not in b: b=b.join(H[['slope','tsunami_extreme','slr32']],on='tmk8')
b['steep']=(b.slope>=20).astype(float)
TERMS=['lnR','own','lnbl','steep','tsunami_extreme','slr32']; b['lnR']=np.log(b.R_ppi)
X=np.c_[np.ones(len(b)),b[TERMS].astype(float).values]; y=b.ev.values.astype(float); T=b['T'].values
lg=lambda z:1/(1+np.exp(-z))
def fitX(X,y,T,t0=None):
    f=lambda t:(lambda q:-(y*np.log(q)+(1-y)*np.log(1-q)).sum())(np.clip(1-(1-lg(X@t))**T,1e-12,1-1e-12))
    return minimize(f,t0 if t0 is not None else np.r_[np.log(y.mean()),np.zeros(X.shape[1]-1)],method='BFGS').x
th=fitX(X,y,T)
# events-only resampling by plat clusters is heavy; use plat cluster bootstrap with weights
plat=b.tmk8.str[:5].values; up,inv=np.unique(plat,return_inverse=True); rng=np.random.default_rng(11); B=[]
for r in range(40):
    w=rng.poisson(1.0,len(up))[inv].astype(float)
    def f(t):
        q=np.clip(1-(1-lg(X@t))**T,1e-12,1-1e-12); return -(w*(y*np.log(q)+(1-y)*np.log(1-q))).sum()
    B.append(minimize(f,th,method='BFGS').x)
sd=np.std(B,axis=0)
# residual year ratios (leave-one-year-out) for the market range
rat=[]
for Y in range(2017,2026):
    m=(b.Y!=Y).values; t=fitX(X[m],y[m],T[m],th); pred=(1-(1-lg(X[~m]@t))**T[~m]).sum(); rat.append(y[~m].sum()/pred)
rat=np.array(rat); w5=[rat[i:i+5].mean() for i in range(len(rat)-4)]
print('coef',dict(zip(['const']+TERMS,np.round(th,3)))); print('sd',dict(zip(['const']+TERMS,np.round(sd,3))))
print('year obs/pred',np.round(rat,2),' 5-yr window means',np.round(w5,2))
med_bl=float(np.log((b[b.Y==2025].B+1000)/b[b.Y==2025].L).median())
json.dump({'terms':['const']+TERMS,'coef':[round(float(v),4) for v in th],'sd':[round(float(v),4) for v in sd],'year_ratio':[round(float(v),3) for v in rat],'window5':[round(float(v),3) for v in w5],'median_lnbl_2025':round(med_bl,4)},open('house_panel_final.json','w'),indent=1)

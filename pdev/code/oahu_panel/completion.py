# Converts the house curve from permits issued to homes finished, using permit close-out dates.
import pandas as pd, numpy as np, json
m=pd.read_pickle('main_permits.pkl'); m=m[m.numunitsadd<=4]
m['done']=pd.to_datetime(m.completeddate,errors='coerce'); m['lag']=(m.done-m.dt).dt.days/365.25
s=m[m.yr.between(2013,2019)].copy()          # permits with at least 5.5 years of follow-up
bad=s.statusdescription.isin(['Job Cancelled','Permit revoked','Cancelled - No Plans Uploaded','Denied'])
fin=s[~bad & s.done.notna() & (s.statusdescription=='Permit application closed')]
F=lambda l:(fin.lag<=l).mean(); f=len(fin)/len(s)
ratio=f*np.mean([F(4.5-t) for t in range(5)])   # permits spread evenly over five years
print('finished share',round(f,3),'5-yr finished/permitted',round(ratio,3))
json.dump({'finished_share':round(f,3),'F':{l:round(F(l),3) for l in (0.5,1.5,2.5,3.5,4.5)},'ratio':round(ratio,3)},open('completion.json','w'))

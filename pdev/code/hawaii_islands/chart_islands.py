import json, numpy as np, pandas as pd, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
S=json.load(open('shared_slope.json')); A=S['areas']; I=dict(zip(A,S['intercepts'])); sl=S['slope']; Bt=np.array(S['boot'])
lg=lambda z:1/(1+np.exp(-z)); m=np.linspace(-0.3,0.25,120); ln=np.log(1+m)
p5v=lambda a,b_:100*(1-(1-lg(a+b_*ln))**5)
vband=lambda i:np.percentile(np.array([p5v(bb[i],bb[4]) for bb in Bt]),[5,95],axis=0)
tw=[I['Oahu'],I['Maui'],I['Hawaii Co RS/RD']]; kau_c,kau_lo,kau_hi=np.mean(tw),min(tw),max(tw)
HC=json.load(open('house_chart.json')); c_,s_,mbl=HC['c'],HC['s'],HC['mbl']
th=[c_['const']+c_['lnbl']*mbl,c_['lnR'],c_['own']]; rng=np.random.default_rng(5)
TH=np.c_[rng.normal(c_['const'],s_['const'],300)+rng.normal(c_['lnbl'],s_['lnbl'],300)*mbl,rng.normal(c_['lnR'],s_['lnR'],300),rng.normal(c_['own'],s_['own'],300)]
ph=lambda t,own:100*(1-(1-lg(t[0]+t[1]*ln+t[2]*own))**5)
HOUSE='#2a78d6'; OWN='#6250d6'; VAC='#eb6834'; VAC2='#b5481c'; APP='#1baf7a'; INK='#0b0b0b'; MUT='#52514e'
fig=plt.figure(figsize=(9,7.8),dpi=200); gs=fig.add_gridspec(5,2,height_ratios=[1,3.2,0.55,1,3.2],hspace=0.1,wspace=0.12)
titles=['Oʻahu','Maui (excluding Lahaina)','Hawaiʻi County','Kauaʻi']
for k in range(4):
    r=0 if k<2 else 3; c=k%2; top=fig.add_subplot(gs[r,c]); ax=fig.add_subplot(gs[r+1,c],sharex=top)
    top.set_title(titles[k],loc='left',fontsize=10,fontweight='bold')
    if k==0:
        top.axhspan(77,90,color=APP,alpha=0.18,lw=0); top.axhline(77,color=APP,lw=2); top.text(24,79,'approved 201H project: 77% of projects, 90% of units',ha='right',va='bottom',fontsize=6.8,color=INK)
    else:
        top.axhline(77,color=APP,lw=1.5,ls=':'); top.text(24,79,'approved project (Oʻahu rate, borrowed)',ha='right',va='bottom',fontsize=6.8,color=MUT)
    top.set_ylim(60,100); top.set_yticks([75,100])
    def houses(measured):
        for own,col,t in [(0,HOUSE,'house, rented or second home'),(1,OWN,'house, owner lives there')]:
            cc=ph(th,own)
            if measured:
                lo,hi=np.percentile(np.array([ph(tt,own) for tt in TH]),[5,95],axis=0); ax.fill_between(m*100,lo,hi,color=col,alpha=0.18,lw=0); ax.plot(m*100,cc,color=col,lw=2)
                ax.text(24,cc[-1]+(-0.6 if own else 0.4),t,ha='right',va='top' if own else 'bottom',fontsize=7,color=INK)
            else: ax.plot(m*100,cc,color=col,lw=1.4,ls=':')
    def vac(i,name,col=VAC,dy=0.5,va='bottom'):
        cc=p5v(I[i],sl); lo,hi=vband(A.index(i)); ax.fill_between(m*100,lo,hi,color=col,alpha=0.16,lw=0); ax.plot(m*100,cc,color=col,lw=2)
        ax.text(24,cc[-1]+(dy if va=='bottom' else -dy),name,ha='right',va=va,fontsize=7,color=INK)
    if k==0: vac('Oahu','vacant lot'); houses(True)
    if k==1:
        vac('Maui','vacant lot'); houses(False); ax.text(-29,24.3,'Dotted: Oʻahu curves, borrowed. Maui data confirm\nowner-occupied homes are rebuilt less often.',fontsize=6.5,color=MUT,va='top')
    if k==2:
        vac('Hawaii Co RS/RD','vacant lot, towns'); vac('Hawaii Co rural','vacant lot, rural',col=VAC2,va='top'); houses(False)
        ax.text(-29,24.3,'Dotted: Oʻahu curves, borrowed and untested\n(no earlier building values to check against).',fontsize=6.5,color=MUT,va='top')
    if k==3:
        cc=p5v(kau_c,sl); ax.fill_between(m*100,p5v(kau_lo,sl),p5v(kau_hi,sl),color=VAC,alpha=0.12,lw=0); ax.plot(m*100,cc,color=VAC,lw=1.8,ls='--')
        ax.text(24,cc[-1]+0.5,'vacant lot, interpolated',ha='right',va='bottom',fontsize=7,color=INK); houses(False)
        ax.text(-29,24.3,'No public property values: nothing measured.\nVacant curve: shared slope, other islands’ levels.',fontsize=6.5,color=MUT,va='top')
    ax.set_ylim(0,25); ax.set_yticks([0,5,10,15,20]); ax.set_xlim(-30,25)
    for a_ in (top,ax):
        a_.grid(color='#e6e5e1',lw=0.6); [a_.spines[s].set_visible(False) for s in ['top','right']]; a_.tick_params(labelsize=7.2,colors=MUT,length=0); a_.axvline(0,color='#bdbcb6',lw=0.8)
        a_.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(decimals=0))
    top.spines['bottom'].set_visible(False); plt.setp(top.get_xticklabels(),visible=False)
    ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda q,_:f'{q:+.0f}%' if q else '0%'))
    if c==1: plt.setp(ax.get_yticklabels(),visible=False); plt.setp(top.get_yticklabels(),visible=False)
fig.text(0.54,0.083,'Estimated profit from building (after paying for the lot and any existing house; each island’s costs set so its typical vacant lot breaks even)',fontsize=7.6,color=MUT,ha='center')
fig.text(0.035,0.5,'Share built within 5 years (axis broken between 25% and 60%)',fontsize=8,color=MUT,rotation=90,va='center')
fig.text(0.07,0.968,'How likely a lot is to be built within five years, by island',fontsize=12.5,fontweight='bold')
fig.text(0.07,0.944,'Solid lines are measured on that island; dotted or dashed lines are borrowed. Shading is the 90% range.',fontsize=7.5,color=MUT)
fig.text(0.07,0.034,'Approved projects: 13 Council-approved 201H projects (2019–21) with a building permit 3–4 years later (DPP, Feb 2024). Vacant lots: homes completed on assessment rolls,',fontsize=5.9,color=MUT)
fig.text(0.07,0.018,'one profit slope shared by all islands. Lots with a house: Honolulu permits 2022–mid 2025, typical lot (not steep, not coastal). Single-family zones only.',fontsize=5.9,color=MUT)
fig.subplots_adjust(left=0.1,right=0.98,top=0.91,bottom=0.12)
fig.savefig('../../results/pdev_by_island.png',facecolor='white')

import numpy as np, pandas as pd
from scipy.optimize import minimize
x = pd.read_pickle('x.pkl'); lnR = np.log(x.R.values); y = x.ev.values.astype(float); T = 3.5
def fit(l):
    def nll(t):
        p = 1 / (1 + np.exp(-(t[0] + t[1] * l))); q = np.clip(1 - (1 - p) ** T, 1e-9, 1 - 1e-9)
        return -(y * np.log(q) + (1 - y) * np.log(1 - q)).sum()
    return minimize(nll, [-5.4, 8.9], method='Nelder-Mead', options=dict(xatol=1e-4, fatol=1e-3, maxiter=3000)).x
SIG = 0.104; rng = np.random.default_rng(0); out = []
for lam in [0, 0.5, 1, 1.5, 2]:
    reps = 1 if lam == 0 else 6
    th = np.mean([fit(lnR + rng.normal(0, SIG * np.sqrt(lam), len(lnR))) for _ in range(reps)], axis=0); out.append((lam, *th)); print(lam, th.round(3))
o = np.array(out)
# quadratic extrapolation to lambda = -1 (no measurement error)
a0 = np.polyval(np.polyfit(o[:, 0], o[:, 1], 2), -1); b0 = np.polyval(np.polyfit(o[:, 0], o[:, 2], 2), -1)
print('noise-corrected a=%.2f b=%.2f' % (a0, b0))
for m in [-0.1, 0, 0.08, 0.15, 0.3]:
    for nm, a, b in [('observed', o[0, 1], o[0, 2]), ('corrected', a0, b0)]:
        p = 1 / (1 + np.exp(-(a + b * np.log(1 + m)))); print(f'  margin {m:+.0%} {nm:9s} per yr {p:6.2%}  5 yrs {1-(1-p)**5:6.1%}')
np.save('simex.npy', np.r_[o[0, 1:], a0, b0])

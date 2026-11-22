import numpy as np, pandas as pd
R = pd.read_pickle('proj.pkl').set_index('area')
h = pd.read_pickle('haw_prepped.pkl'); un = pd.read_csv('units2024.tsv', sep='\t', dtype={'TMK': str})
MISS = 659 / 110000                       # Oahu: share of built homes the units layer misses (used to net out old homes)
WIN = {'central': 3.0, 'low': 3.5, 'high': 2.5}   # years from the layer's dwelling-data date (~Oct 2022, dated on Oahu) to the 2026 roll
rates = {}
for k, g in h[h.cls != 'other'].groupby('cls'):
    nl = g[~g.has_units]; built = (nl.bldgvalue > 75000).sum(); old = MISS * g.has_units.sum(); new = built - old
    rates[k] = {w: 1 - (1 - new / len(nl)) ** (1 / yrs) for w, yrs in WIN.items()}
    print(f'{k}: vacant at layer date {len(nl)}, new homes since {new:.0f}, per year {rates[k]["central"]:.3%} (range {rates[k]["low"]:.3%}–{rates[k]["high"]:.3%})')
# Hawaii County 5-yr projection: vacant lots now x measured rate; built lots x pooled curve (from proj.py results, built share only)
import importlib.util, sys
rows = []
for k, g in h[h.cls != 'other'].groupby('cls'):
    vac_now = (g.bldgvalue == 0).sum()
    out = {w: vac_now * (1 - (1 - rates[k][w]) ** 5) for w in WIN}
    rows.append((f'Hawaiʻi County: {k}', len(g), vac_now, out['central'], out['low'], out['high'], 'vacant-lot rate measured on the island'))
for name in ['Oʻahu', 'Maui (excl. Lahaina)']:
    r = R.loc[name]; rows.append((name, r.lots, r.vacant, r.central, r.low, r.high, 'fitted on the island (roll-to-roll, 2020–26)'))
# Kauai: borrowed; range spans the measured vacant-lot rates on the other islands
kv = R.loc['Kauaʻi (values borrowed from Maui and Hawaiʻi County)']
vac_rates = [0.0187, 0.0212, rates['RS/RD single-family']['central']]          # Maui, Oahu (roll-to-roll), Hawaii RS/RD
built_part = kv.central - kv.vacant * (1 - (1 - 0.0187) ** 5) * 0 if False else None
lo = kv.vacant * (1 - (1 - min(vac_rates)) ** 5); hi = kv.vacant * (1 - (1 - max(vac_rates)) ** 5)
rows.append(('Kauaʻi', kv.lots, kv.vacant, kv.central, min(kv.central, lo), max(kv.central, hi + (kv.central - lo)), 'borrowed from neighbor islands; no public values'))
T = pd.DataFrame(rows, columns=['Island / area', 'Lots', 'Vacant now', '5-yr new homes (central)', 'Low', 'High', 'Basis'])
T['Per year (central)'] = T['5-yr new homes (central)'] / 5
print(T.round(0).to_string(index=False))
T.to_pickle('islands.pkl')

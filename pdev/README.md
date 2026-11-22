# Probability of development (p-dev)

Patrick Spence. Draft, November 2026.

## What this is for

Feasim tells us whether a project pencils on a lot. It doesn't tell us how likely the lot is to actually be built in the next five years. That's the number we need to turn "feasible" into "homes produced." This folder holds the evidence for that step and a small set of numbers the tool can use.

## The idea in one paragraph

An owner builds when a new project is worth more than the property is worth today plus the cost of building. So for each lot we compare the new project's value with the lot's own assessed land and building value, not one land price for every parcel. Then, instead of assuming how often profitable lots get built, we measured it: we matched every Honolulu new-home permit from January 2022 to June 2025 to the 2022 assessment roll.

## What we found

![Oʻahu build rates](results/oahu_build_rates.png)

| Kind of lot | Share built within 5 years |
|---|---|
| Lot with a house, owner lives there | Typical Oʻahu lot: about 1% at break-even, 2% at a 10% profit, 3% at 20%. |
| Lot with a house, rented or second home | Typical Oʻahu lot: about 2.5% at break-even, 4.5% at a 10% profit, 7% at 20%. Owner-occupied homes are rebuilt at about 40% of this rate. |
| Vacant lot | Rises with profit, but gently: about 11% at a 20% loss, 16% at break-even, 21% at a 20% profit. Lots far below break-even (a 40% loss or worse) almost never get built: 1 of 112 on Oʻahu. |
| Lot a developer already controls (active subdivision) | Up to about 90%, but this is an upper bound: those lots were found by where building clustered, so the rate is inflated by construction. |
| 201H project approved by Council | About 77% of projects (90% of units) had a building permit 3–4 years later |

Full numbers are in `pdev_table.csv`; the tool can read `pdev_params.json`.

**How to use it:** for any set of parcels, expected new homes = sum over parcels of (chance it's built) × (net new units). We don't try to pick *which* lots get built; nobody can. A map can show the lots that become viable and the expected total.

## How we know it works, and where it doesn't (yet)

- **Holding out parts of Oʻahu:** fitted on the other TMK zones, it predicts the island total within about 10%. Individual districts are off by about 30% on average (urban Honolulu is under-predicted).
- **Holding out years: it fails.** Fitted on Jan 2022–Sep 2023 and tested on Oct 2023–Jun 2025, it under-predicts by 32–42%. Rebuilding on existing lots roughly halved in 2023 and recovered in 2024. Mortgage rates and home prices don't explain that swing.
- **The fitting window was slow.** 2022–mid 2025 ran at 76% of the 2005–2025 average for rebuilding on existing lots. So for a typical five years, multiply by about 1.3 (range 1.05–1.44, from every 5-year window since 2005).
- **Other islands:** the average vacant-lot rate was measured directly on Oʻahu (2.3% a year), Maui (2.5%) and Hawaiʻi County (2.1–2.7%), all with the same rules. Kauaʻi publishes no assessed values, so it borrows the others' median. The existing-house curve can only be fitted on Oʻahu, because only Honolulu publishes parcel-level permits. A version built on lot characteristics predicted Maui within 12%. It doesn't work on the Big Island's very cheap land.
- **Mainland check:** in 8 Arizona and Oregon counties (2.1 million parcels), vacant lots outside developer subdivisions get built at 2–4% a year, the same range as Hawaiʻi. The county median predicts each Hawaiʻi area within about 30%. A more detailed lot-level model did *not* transfer, so we don't use one.

## Other splits tested (held out by neighborhood, every lot)

Slope and hazard flags were joined to all 157,402 lots in the test sets: the 10 m USGS slope raster and the State's FEMA flood, extreme-tsunami, 3.2 ft sea-level-rise, lava and fire-risk layers.

**Kept, lots with a house (Oʻahu):**
- Owner-occupied (homeowner exemption): rebuilt at 0.43x the rate.
- Building value relative to land: each doubling cuts the rate to about 0.8x (houses with little building for their lot are torn down more).
- Steep lot (20%+ slope, 11.5% of lots): 0.50x.
- Extreme-tsunami zone: 0.73x. Sea-level-rise (3.2 ft) zone: 0.72x.
- Together these cut held-out error from 3444 to 3417 (profit alone: 3504).

**Rejected:**
- FEMA flood zone: no effect on rebuilds or vacant lots.
- Slope on vacant lots: no gain (land value already reflects it).
- Big Island lava zones: slightly lower rates, but too small a gain to use.
- High fire risk: vacant lots there are built *more* often (1.3x). That reflects where growth is (dry leeward areas), not fire, so it isn't used.
- House built since 2005, zone district, lot size: no gain once profit is in the model.

## What it can't tell you

- **Apartment and business zones.** Too few were built in 2022–25 to fit a curve. The TOD, parking and fee scenarios currently borrow the single-family curve; that is an assumption, not a measurement. Older assessment rolls (2010–2021) would fix this.
- ADUs (not fitted; Honolulu permits since 2016 suggest new options take about two years to ramp up).
- Which specific lots get built.
- Big swings in the market. The range above is what history shows, not a forecast.

## Files

- `pdev_table.csv`, `pdev_params.json`: the numbers.
- `results/`: chart, district checks, held-out tests, quarterly rebuilding counts, county table for AZ/OR/HI.
- `code/oahu/`: build the Oʻahu dataset, fit the curve, run the tests (Python 3.11; pandas, numpy, scipy, shapely, statsmodels, matplotlib).
- `code/hawaii_islands/`: Maui and Hawaiʻi County measurements.
- `code/mainland_check/`: the Arizona and Oregon comparison.
- `DATA_SOURCES.md`: where every dataset comes from. Raw data isn't committed; the scripts expect it in the working folder.

Analysis done with AI assistance (Claude), to be listed in DISCLOSURES.md.

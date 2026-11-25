# Probability of development (p-dev)

Patrick Spence. Draft, November 2026. Version 2 (November 25): the existing-house curve is now fitted on nine years of Honolulu assessments, 2017–2025.

## Purpose

Feasim, the parcel-level pro forma model in this repository, estimates whether a housing project is financially feasible on a given parcel. It does not estimate how likely that parcel is to actually be built within the next five years. That likelihood is what turns feasible capacity into expected housing production. This folder holds the estimates for that step and the parameters the simulator reads.

## Method

An owner builds when the value of a new project exceeds the property's current value plus the cost of construction. For each parcel we compute a profit ratio:

> profit ratio = value of the new project ÷ (construction and soft costs + the parcel's current assessed land value + its current assessed building value)

A ratio of 1.0 is break-even. "10% profit" means a ratio of 1.10; "20% loss" means 0.80. Using each parcel's own assessed value, rather than one land price for every parcel, means an existing house counts as a cost of redevelopment.

The share of parcels built at each profit level is measured, not assumed:

- Parcels with an existing house (Oʻahu): each year's assessed values for tax years 2017–2025 were matched to the new-home building permits issued that calendar year. That is 1.05 million lot-years and 1,468 permits. Values for 2017–2021 come from UHERO's scraped assessor records; 2022–2025 match the City's public rolls. Construction cost is $150 per square foot in late-2021 dollars, adjusted each year by the national construction materials price index.
- Vacant parcels (Oʻahu, Maui, Hawaiʻi County): a parcel counts as built when a new building appears on a later assessment roll (Oʻahu 2022 to 2026 and Maui 2020 to 2025; in Hawaiʻi County, a statewide dwelling-units layer from about October 2022 compared with the 2026 roll).

Each curve is a logistic function of the profit ratio, fitted to annual probabilities and converted to a five-year probability. Only single-family residential zones are covered (see Limitations).

Two definitions used throughout:

- Developer subdivision: a group of vacant lots being built out as one project, so its timing is set by the developer's schedule rather than by individual owners. Identified as a tax-map plat (Hawaiʻi's parcel numbering groups neighboring lots into plats) with at least five new homes on vacant lots during the window. For the cross-island vacant-lot curves, the group can also be a 400 m grid cell, and its annual build rate must be at least 5.6%. These lots are reported separately and excluded from the vacant-lot curves.
- Typical lot: a lot with the median building-to-land value ratio for Oʻahu (0.285 on the 2025 roll), not steep and not in a coastal hazard zone.

## Results

![Share of lots built within five years, by island](results/pdev_by_island.png)

Share of lots built within five years:

| Parcel type | 20% loss | Break-even | 20% profit |
|---|---|---|---|
| House, owner-occupied (typical Oʻahu lot) | 0.2% | 0.8% | 2.3% |
| House, rented or second home (typical Oʻahu lot) | 0.5% | 1.8% | 5.4% |
| Vacant lot, Oʻahu | 6.8% | 10.6% | 15.2% |
| Vacant lot, Maui | 6.0% | 9.4% | 13.5% |
| Vacant lot, Hawaiʻi County residential zones (RS/RD) | 9.1% | 14.0% | 19.8% |
| Vacant lot, Hawaiʻi County rural and small agricultural lots | 2.9% | 4.7% | 6.8% |
| Vacant lot, Kauaʻi (estimated, range in `pdev_table.csv`) | 7.2% | 11.2% | 16.0% |

Other cases do not depend on profit:

- Lot in an active developer subdivision: up to about 90% (Oʻahu, 141 lots). This is an upper bound. These lots were identified by where construction clustered during the same window, so the rate is inflated by the construction itself.
- Project approved under Chapter 201H of the Hawaiʻi Revised Statutes (a state law that lets the county council waive zoning and other rules for projects with affordable units): 77% of Oʻahu projects approved in 2019–2021, representing 90% of their units, had a building permit three to four years later.

House rates count building permits issued. About 73% of those homes are finished within the same five years, so on a finished-homes basis the house rates are 0.73 times the figures above (both versions are in `pdev_table.csv`). Vacant-lot rates already count finished homes.

Owner-occupied houses are identified by the homeowner property-tax exemption, which only applies to an owner's primary residence. They are rebuilt at about 40% of the rate of rented houses and second homes. On the other islands, the existing-house curves are borrowed from Oʻahu (see Validation). The 20% profit column is slightly beyond the profit levels observed for existing houses (99% fall below 15%).

The full curves are in `pdev_table.csv`, and the simulator reads `pdev_params.json`.

Expected new homes for any set of parcels = the sum over parcels of (probability of development) × (net new units). The model estimates totals. It does not predict which individual parcels will be built.

Observed rates on Oʻahu from the first version (2022 roll, permits to mid-2025), grouped by profit and before any curve fitting, are shown below. The vacant-lot bars come from the smaller permit-matched sample and are noisy (wide intervals); the vacant-lot curves above use the larger assessment-roll sample from all three counties.

![Observed Oʻahu build rates by profit band](results/oahu_build_rates.png)

## Validation

All tests below are out-of-sample: the model is fitted on one part of the data and scored on parcels it has not seen.

- Geographic holdout (first version, 2022–2025 data). Oʻahu is divided into nine tax-map zones. Fitted on eight zones and tested on the ninth, in turn, the model predicts the Oʻahu total within about 10%. Individual zones are off by about 30% on average, with urban Honolulu under-predicted.
- Holdout by year. Fitted on 2017–2021, the model predicts 2022–2025 permits within 10% (517 predicted, 575 observed). Fitted on 2022–2025, it predicts 2017–2021 within 15%. Single years are harder: leaving out one year at a time, the average error is 25%. The first version, fitted on 2022–2025 alone, failed this test by 32–42%.
- What fixed it: construction costs. Materials prices rose about 40% in 2021–2022, which cut profit on every lot. With cost held fixed instead, the same tests miss by +62% and −42%. Rebuilding dipped in 2022–2023 and recovered in 2024, and rising costs account for most of that.
- Market range. Because the curve now covers 2017–2025 and follows costs, no adjustment is applied by default. For a range, use 0.88 to 1.25 times the base estimate. The low end is the weakest five-year stretch of 2017–2025 relative to the model. The high end is how much busier rebuilding was in a strong five-year stretch since 2005 (the 90th percentile of five-year windows), a period the assessed values don't reach back to.
- Vacant lots on other islands. Vacant lots outside developer subdivisions were measured with the same rules on every island (residential and rural lots of 3,500 sq ft to 10 acres). Average build rates across all such lots are similar: Oʻahu 2.3% a year, Maui 2.5%, Hawaiʻi County residential zones 2.7% and rural lots 2.1%. All islands share one profit slope. On held-out plats, this predicts better than a flat rate and as well as a separate slope for each island. Construction costs are set separately for each island ($150 per sq ft on Oʻahu, $123 on Maui, $92 in Hawaiʻi County towns, $38 for rural lots) so that each island's median vacant lot is at break-even. This makes the curves comparable within an island, but not across islands.
- Kauaʻi publishes no assessed values, so nothing could be measured there. Its vacant-lot curve uses the average level of Oʻahu, Maui and Hawaiʻi County residential zones, with their range as the uncertainty band. Building permits per resident were tested as a way to place Kauaʻi among the other islands, but did not line up with the measured rates.
- Existing houses on other islands. The existing-house curve can only be fitted on Oʻahu, because only Honolulu publishes parcel-level building permits. An alternative model based on lot characteristics, which detects rebuilds from changes in assessed building value rather than permits, predicted Maui within 12%, but did not work in Hawaiʻi County, where land values are very low. Maui data also show owner-occupied homes being rebuilt less often.
- Mainland comparison. In eight Arizona and Oregon counties (2.1 million parcels), vacant lots outside developer subdivisions are built at 2–4% a year, the same range as Hawaiʻi. The mainland county median predicts each Hawaiʻi area within about 30%. A detailed parcel-level mainland model did not transfer to Hawaiʻi and is not used.

## Variables tested

Each variable was kept only if it improved out-of-sample predictions. For this test, the tax-map plats were split into five groups, each group was held out in turn, and the whole procedure was repeated three times with different splits. All 157,402 parcels in the test sets were joined to the USGS 10 m slope data (served by the Hawaiʻi Statewide GIS Program) and to the State's FEMA flood, extreme-tsunami, 3.2 ft sea-level-rise, lava and wildfire-risk layers.

Retained for existing houses (Oʻahu), as multipliers on the annual rebuild rate:

- Owner-occupied: 0.41×.
- Building value relative to land value: each doubling lowers the rate to about 0.8×. Houses with little building value for their lot are replaced more often.
- Steep lot (slope of 20% or more, 11.5% of lots): 0.56×.
- Extreme-tsunami evacuation zone: 0.79×. Area exposed to coastal flooding with 3.2 ft of sea-level rise: 0.87×.

These are from the 2017–2025 fit. The variables were chosen on the 2022–2025 data and keep the same direction and similar size on the longer panel.

Rejected:

- FEMA flood zone: no effect on rebuilds or on vacant lots.
- Slope on vacant lots: no improvement, since land value already reflects it.
- Hawaiʻi County lava zones: slightly lower rates, but too small an improvement to include.
- High wildfire risk: vacant lots in these areas are built more often (1.3×). This reflects where growth is happening (dry leeward areas), not fire risk, so it is excluded.
- House built since 2005, zoning district and lot size: no improvement once profit is included.

## Limitations

- Apartment and commercial zones. Even with nine years of assessments, too few apartment buildings went up on Oʻahu's privately held apartment and business-zoned lots to fit a profit curve: 29 buildings of five or more units in 2017–2025. The raw rates are low: about 1.2% of vacant or parking lots in five years, and well under 0.5% of lots with buildings. They swing by a factor of three between 2017–2021 and 2022–2025. The simulator's parcels are mostly in these zones, and its transit-oriented development, parking-reduction and fee-reduction scenarios currently apply the single-family curves to them. That is an assumption, not a measurement, and the single-family curves are likely high for these lots. Feasim's per-parcel profit for the same lots would let us test a profit slope on these 29 projects.
- Outcomes. House and 201H rates count building permits; vacant-lot rates count finished homes. The house curve can be converted to finished homes (× 0.73, above). The 201H rate has not been converted: buildings of 100 or more units took a median of 30 months from permit to completion, so fewer than 77% would be finished within five years.
- The existing-house curve was fitted on profit ratios between about 0.6 and 1.15 (1st to 99th percentile). Values outside that range are extrapolation.
- Accessory dwelling units (ADUs) are not modeled. After Honolulu began allowing ADUs (permits from 2016), annual ADU permits took about two years to reach a steady level.
- Individual parcels. The model estimates totals and does not identify which parcels will be built.
- Large market shifts. The ranges above reflect historical variation and are not a forecast.

## Files

- `pdev_params.json`: model coefficients, read by the simulator.
- `pdev_table.csv`: the same curves as a lookup table.
- `results/`: charts, zone-level checks, out-of-sample tests (including `panel_holdout.csv` and `panel_leave_one_year_out.csv`), quarterly rebuilding counts and the Arizona, Oregon and Hawaiʻi county table.
- `code/oahu/`: builds the Oʻahu dataset and the first version of the existing-house curve (Python 3.11; pandas, numpy, scipy, shapely, statsmodels, matplotlib).
- `code/oahu_panel/`: the 2017–2025 panel, the current existing-house curve, the year tests, the apartment-zone rates and the permit-to-finished conversion.
- `code/hawaii_islands/`: Maui and Hawaiʻi County measurements, the vacant-lot curves, slope and hazard joins, and the island chart.
- `code/mainland_check/`: the Arizona and Oregon comparison.
- `DATA_SOURCES.md`: the source of every dataset. Raw data is not committed; the scripts expect it in the working folder.

Analysis was conducted with AI assistance (Claude).

# County of Kauaʻi config: notes, reasoning and sources

`src/localities/hi/kauai/` is the County of Kauaʻi's `Locality`: zoning in `zones.ts`, parking, tax and income limits in `rules.ts`, estimates in `assumptions.ts`. It follows the pattern in [ADDING_A_COUNTY.md](ADDING_A_COUNTY.md).

- **Id:** `hi-kauai`.
- **Pathways:** current zoning only (`pathways: ["current"]`).
- **Status:** zoning, parking, property tax and income limits come from Kauaʻi sources. Loading, fees and water charges are Maui's for now, marked "Maui's" in `rules.ts`, until Kauaʻi's are read. The market estimates are Honolulu's, as for Maui and Hawaiʻi County.

## Contents

1. [Locality settings](#locality-settings)
2. [Still carried from Maui](#still-carried-from-maui)
3. [Choices to revisit](#choices-to-revisit)
4. [Modeling assumptions](#modeling-assumptions)
5. [Known limitations](#known-limitations)
6. [Not modeled](#not-modeled)
7. [Zoning](#zoning)
8. [Parking](#parking)
9. [Property tax](#property-tax)
10. [Income limits and affordable rents](#income-limits-and-affordable-rents)
11. [Workforce housing (Chapter 7A)](#workforce-housing-chapter-7a)
12. [Estimates](#estimates)
13. [Engine changes](#engine-changes)
14. [Tests](#tests)
15. [Sources](#sources)

## Locality settings

| Setting | Value | Why |
| --- | --- | --- |
| `id` | `"hi-kauai"` | State and county |
| `pathways` | `["current"]` | Honolulu's ordinances don't apply |
| `unknown_zone` | `"error"` | A zone not in `zones.ts` stops the run, so a missing district is noticed |
| `state` | Hawaiʻi's state rules | Shared with the other counties |

## Still carried from Maui

These are placeholders so the model runs. Each is `maui.*` in `rules.ts`.

| Rule | Kauaʻi's own, to replace it |
| --- | --- |
| `loading` | Off-street loading in the CZO |
| `fees.building_permit`, `fees.plan_review` | Building code fees (Chapter 12) |
| `fees.grading`, `grubbing`, `stockpiling` | Grading (Chapter 22) |
| `fees.wastewater` | Sewer connection charge and wastewater treatment capacity assessment (Chapter 25) |
| `fees.park_dedication` | Park dedication (Chapter 9) |
| Other `fees` (EA, TCO, trenching) | The matching Kauaʻi charges |
| `water` | Department of Water facilities reserve charge (Rules, Part 5) |

## Choices to revisit

| Choice | Current value | Alternative | Why it matters |
| --- | --- | --- | --- |
| Loading, fees and water | Maui's | Kauaʻi's | Placeholders only |
| Market estimates (cap rate, vacancy, cost escalation, opex and assessment growth, parking costs, timing) | Honolulu's | Kauaʻi figures | These drive land value directly |
| Engine defaults: hard cost, land cost, sale prices | $450/sqft, $130/sqft, Honolulu HHFDC sale tables | Kauaʻi figures | They live in the engine, so the county inherits Honolulu's |
| Property tax rate | $9.40 per $1,000, the top Non-Owner-Occupied Residential tier | The blended rate for the building's value ($8.47 at $8 million) | The engine takes one rate; most of a building's value is in the top tier |
| Workforce housing | None (multiple-family at full density is exempt until October 2030) | 20% for projects over 10 units that don't qualify | A project held below the density limit, or in CN or CG, may not qualify |
| Commercial yards | 5 ft front, no side or rear yard | The residential side yard and a 10 ft rear next to a residential district | The parcel data has no neighboring zone |
| CN density | R-10's | An adjoining residential district's, where higher | Not known from the parcel data |
| Income limits year | HHFDC 2025 (median $132,900) | HHFDC 2026 | 2025 matches the other counties; move all four together |

## Modeling assumptions

- **Units are the lot over the land per unit,** at 43,560 sqft per acre over the district's units per acre (R-20: 2,178 sqft). A fraction of 65% or more counts as a whole unit; less is dropped (8-4.6).
- **No FAR.** None of these districts sets one, so the building fills the height, coverage and yard envelope up to the unit cap, building only the floor area the units need.
- **Coverage counts buildings and pavement,** as the model's coverage does buildings and parking (8-4.3(d), 8-6.3(g)).
- **Side and rear yards at the full height.** They are 5 ft or half the building wall's height, whichever is greater (8-4.3(b)), taken at the most stories the height allows.
- **The standards for development without subdivision apply** (8-4.3): one building on an existing lot. The 50% coverage for multiple-family subdivision lots (8-4.4) does not.
- **Commercial dwellings park like residential ones,** 2 stalls per unit.
- **Tax class by use.** Kauaʻi taxes by actual use, not zoning, so a building of long-term rentals is Non-Owner-Occupied Residential.

## Known limitations

- Loading, fees and water are Maui's; see [Still carried from Maui](#still-carried-from-maui).
- Hard cost, land cost and sale prices are Honolulu engine defaults, and the market estimates are Honolulu's; only AMI and rent growth are the county's own.
- Height comes from each parcel's `height`, so the parcel data must carry the right limit: 40 ft and 4 stories for multiple-family in R-10 and R-20 (and no more than 10 ft above a residence within 30 ft); 35 ft and 2 stories in CN; 50 ft in CG.
- Zoning was read from a mirror of the CZO (current to Ord. 1173, May 2025), not the County's own text. Which districts permit multiple-family dwellings (Table 8-2.4) still needs checking, since the mirror loses the table's columns.
- Retail parking leaves out the 1 stall per 3 employees and the minimum of 4.

## Not modeled

| Rule or cost | Source | Why not |
| --- | --- | --- |
| R-1 to R-6, R-40 | CZO 8-4.2, 8-4.3, Table 8-2.4 | Multiple-family not confirmed in R-1 to R-6; R-40's coverage not found |
| Resort districts RR-10, RR-20 | CZO Article 5; 7A-2.1(b) | Hotel standards, visitor destination areas and the resort workforce rule |
| Form-based districts (Līhuʻe Town Core, Kōloa, Kalāheo, Kapaʻa-Wailua) | Chapter 10 | Their own codes and standards |
| Constraint (S-) and special treatment (ST-) overlays | CZO Articles 9, 11 | No overlay data on the parcel |
| Minimum lot and frontage for 2 or more units (25 ft frontage, 60 ft average width); CN 6,000 sqft, CG 8,500 sqft | CZO 8-4.3(e), 8-6.3(a), (d) | No lot-size check in the engine |
| 10 ft between structures; 15 ft per story above two between commercial buildings | CZO 8-4.3(c), 8-6.3(c) | The model builds one building |
| Zoning permit and use permit fees (Class I $30 to Class IV $800; use permit $300) | CZO 8-3.1, 8-3.2 | Small and not per unit |
| Long-Term Affordable Rental tax class ($2.59) | Res. 2026-11 | Applies only to qualifying affordable units |
| Workforce housing in-lieu fees ($278,240 / $151,280 / $83,080 per 80% / 100% / 120% unit, 2020, CPI-adjusted) | 7A-3.1 | The exemption applies; see [Workforce housing](#workforce-housing-chapter-7a) |
| State parking cap (HB 1919, SB 2981, 2026) | 2026 session | Not law |
| General excise tax (4.5%) | HRS 237 | Not modeled for any county |

## Zoning

Kauaʻi limits density by dwelling units per acre: the number in a residential district's name is its maximum units per acre (8-4.2). So every zone uses `current.lot_area_per_unit` (43,560 / units per acre) with `units_round_up_at: 0.65`, and none sets `far`.

| Zone | Units per acre | Land per unit (sqft) | Coverage | Yards (front / side / rear) | Source |
| --- | --- | --- | --- | --- | --- |
| R-10 | 10 | 4,356 | 80% | 10 ft / 5 ft or ½ height / 5 ft or ½ height | 8-4.2, 8-4.3 |
| R-20 | 20 | 2,178 | 90% | Same | 8-4.2, 8-4.3 |
| CN | 10 (R-10's) | 4,356 | 80% | 5 ft / 0 / 0 | 8-6.3, 8-6.6 |
| CG | 20 (R-20's) | 2,178 | 90% | 5 ft / 0 / 0 | 8-6.3, 8-6.6 |

The commercial districts permit commercial uses, so `commercial_coverage` is 1; the residential districts' is 0. No district requires bicycle parking.

## Parking

| Field | Value | Source |
| --- | --- | --- |
| `residential_stalls_per_unit` | 2 | CZO 8-4.5(a): at least 2 off-street stalls per dwelling unit |
| `retail_sqft_per_stall` | 300 | CZO 8-6.3(e)(3): 1 per 300 sqft of gross floor area, plus 1 per 3 employees (not modeled), at least 4 |
| `joint_use` | 1 | No shared-parking reduction found |
| `round_up` | Not set (half-up) | No rounding rule found |

## Property tax

FY 2026–27 rates (Resolution 2026-11; unchanged from FY 2025–26), per $1,000 of net assessed value:

| Class | Rate |
| --- | --- |
| Owner-Occupied | $2.59 |
| Non-Owner-Occupied Residential | $5.45 to $1.3 million; $6.05 to $2 million; $9.40 above |
| Vacation Rental | $11.30 to $1 million; $11.75 to $2.5 million; $12.20 above |
| Hotel and Resort | $11.75 |
| Commercial, Industrial | $8.10 |
| Agricultural, Conservation | $6.75 |
| Owner-Occupied Mixed-Use | $5.05 |
| Long-Term Affordable Rental | $2.59 |

`property_tax_rate` is 0.0094, the top Non-Owner-Occupied Residential tier, since the engine takes one rate and an apartment building's value is mostly above $2 million.

## Income limits and affordable rents

`income_limits` is HHFDC's 2025 Kauaʻi County schedule (median family income $132,900), by AMI % for household sizes 1–8. It reproduces HHFDC's 2025 rent guidelines, for example:

| AMI | Studio | 1 BR | 2 BR | 3 BR | 4 BR |
| --- | --- | --- | --- | --- | --- |
| 60% | $1,396 | $1,496 | $1,795 | $2,073 | $2,313 |
| 80% | $1,862 | $1,995 | $2,394 | $2,765 | $3,084 |
| 100% | $2,327 | $2,493 | $2,992 | $3,456 | $3,855 |
| 120% | $2,793 | $2,992 | $3,591 | $4,147 | $4,626 |

## Workforce housing (Chapter 7A)

The Housing Policy applies to projects of more than 10 dwelling units in residential, resort and commercial districts. As amended by Ord. 1081 (October 2020), it requires 20% workforce housing for residential projects.

It also exempts multiple-family projects in residential or mixed-use districts of R-10 density or more that are built at or above the maximum density, outside visitor destination areas and SMAs (7A-1.4.2). The exemption expires ten years after adoption, so in October 2030. Projects in the Līhuʻe, Kōloa and Kalāheo form-based districts are also exempt.

The model builds to the maximum density, so R-10 and R-20 projects qualify, and there is no `inclusionary` rule. Two cases may still owe the 20%: CN and CG (commercial, not residential or mixed-use), and a project held below the density limit by its yards. Both are in [Choices to revisit](#choices-to-revisit). This reading is from the 2020 ordinance; later amendments to Chapter 7A have not been checked.

## Estimates

| Field | Value | Source |
| --- | --- | --- |
| `timing` | 18 and 12 months | Honolulu's |
| `market.cap_rate`, `vacancy` | 5.1%; 7.4% residential, 12.6% retail | Honolulu's |
| `market.cost_inflation` | 1.056 | Honolulu's (RLB Honolulu) |
| `market.ami_escalation` | 1.036 | HHFDC Kauaʻi 100% AMI for 4 people, $86,500 (2013) to $132,900 (2025) |
| `market.annual_rent_growth` | 3.6% | Affordable caps track AMI; market rent growth not checked |
| `market.annual_opex_growth`, `annual_assessment_growth` | 3.5%, 2% | Honolulu's |
| `market.parking` | 330 sqft and $190/sqft structured; 360 sqft and $30/sqft surface; $100 a month per stall | Honolulu's |
| `default_zone.excavation_depth_ft` | 4 ft | Honolulu's default |

## Engine changes

Two optional fields, so Honolulu, Maui and Hawaiʻi County are unchanged:

| Change | File | Why |
| --- | --- | --- |
| `CurrentZoningRules.units_round_up_at`: a fractional unit at or above this share counts | `core/locality.ts`, `core/zoning.ts` | Kauaʻi counts a fraction of 65% or more (8-4.6) |
| `YardRules.side_rear_height_fraction`: side and rear yards are at least this share of the building's height | `core/locality.ts`, `calc-bill6.ts` | Kauaʻi's 5 ft or half the wall height (8-4.3(b)) |

`checkLocality` checks that both are shares (0 to 1).

## Tests

- `test/kauai-config.test.ts`: density and rounding, coverage, yards, unlisted districts, parking, tax, income limits and rents, the workforce exemption, an end-to-end run and completeness.
- `test/current-zoning.test.ts`: the two engine options on the generic test county.

## Sources

| Source | Used for |
| --- | --- |
| Kauaʻi County Code Chapter 8 (CZO), Articles 2, 3, 4, 6, via the Zoneomics mirror (current to Ord. 1173, May 2025) | Districts, density, coverage, yards, height, parking |
| [Ord. 1081 (Bill 2774, Draft 5), amending Chapter 7A, signed October 29, 2020](https://www.kauai.gov/files/assets/public/v/1/housing-agency/documents/ordinance-no.-1081_bill-no.-2774-draft-5_amending-ch.7a-cok-code-1987_housing-policy_signed-mayor-october-29-2020.pdf) | Workforce housing requirement and exemption |
| [Notice of publication, Resolution 2026-11 (FY 2026–27 tax rates)](https://www.kauai.gov/files/assets/public/v/1/county-council/documents/budget/2026-06-03-notice-of-publication-re-resolution-no.-2026-11.pdf) | Property tax rates |
| [FY 2025–26 tax rates, Real Property Assessment](https://www.kauai.gov/files/assets/public/v/1/finance/rpa/2026-tax-reliefexemption-forms/2025-assessment-year-tax-rates_-no-pitt_-rev-9.24.2025-printable.pdf) | Rates unchanged year to year |
| [HHFDC 2025 Kauaʻi County income schedule](https://dbedt.hawaii.gov/hhfdc/files/2025/05/Kauai-County-2025.pdf) | Income limits, affordable rents |
| [HHFDC 2013 Kauaʻi County income schedule](https://files.hawaii.gov/dbedt/hhfdc/resources/2013Kauai.pdf) | AMI growth |

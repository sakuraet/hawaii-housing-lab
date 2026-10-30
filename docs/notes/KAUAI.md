# County of Kauaʻi config: notes, reasoning and sources

`src/localities/hi/kauai/` is the County of Kauaʻi's `Locality`: zoning in `zones.ts`; parking, loading, fees, water, tax and income limits in `rules.ts`; estimates in `assumptions.ts`. It follows the pattern in [ADDING_A_COUNTY.md](ADDING_A_COUNTY.md).

- **Id:** `hi-kauai`.
- **Pathways:** current zoning only (`pathways: ["current"]`).
- **Status:** every rule comes from the County's own code or rules. The market estimates are Honolulu's, as for Maui and Hawaiʻi County.

## Contents

1. [How the data was gathered](#how-the-data-was-gathered)
2. [Locality settings](#locality-settings)
3. [Choices to revisit](#choices-to-revisit)
4. [Modeling assumptions](#modeling-assumptions)
5. [Known limitations](#known-limitations)
6. [Not modeled](#not-modeled)
7. [Zoning](#zoning)
8. [Parking, loading and bicycle parking](#parking-loading-and-bicycle-parking)
9. [Fees](#fees)
10. [Water](#water)
11. [Property tax](#property-tax)
12. [Income limits and affordable rents](#income-limits-and-affordable-rents)
13. [Workforce housing (Chapter 7A)](#workforce-housing-chapter-7a)
14. [Estimates](#estimates)
15. [Engine changes](#engine-changes)
16. [Tests](#tests)
17. [Sources](#sources)

## How the data was gathered

1. **County code:** Chapters 5A (real property tax), 7A (housing policy), 8 (Comprehensive Zoning Ordinance, "CZO"), 9 (subdivisions), 12 (building code), 22 (grading, Article 7) and 25 (sewers), from eCode360, downloaded October 29, 2026.
2. **Department of Water:** Rules Part 5, Facilities Reserve Charge (rev. June 15, 2020). Part 4 (rev. September 24, 2026) sets monthly rates only.
3. **Property tax rates:** the County's FY 2026–27 rate notice (Resolution 2026-11) and FY 2025–26 rate sheet.
4. **Income limits:** HHFDC's 2025 and 2013 Kauaʻi County schedules.
5. **Honolulu's figures:** market estimates and timing, marked "Honolulu's" in `assumptions.ts`, as for Maui and Hawaiʻi County.

## Locality settings

| Setting | Value | Why |
| --- | --- | --- |
| `id` | `"hi-kauai"` | State and county |
| `pathways` | `["current"]` | Honolulu's ordinances don't apply |
| `unknown_zone` | `"error"` | A zone not in `zones.ts` stops the run, so a missing district is noticed |
| `state` | Hawaiʻi's state rules | Shared with the other counties |

## Choices to revisit

The ones most likely to move results come first.

| Choice | Current value | Alternative | Why it matters |
| --- | --- | --- | --- |
| Market estimates (cap rate, vacancy, cost escalation, opex and assessment growth, parking costs, timing) | Honolulu's | Kauaʻi figures | These drive land value directly |
| Engine defaults: hard cost, land cost, sale prices | $450/sqft, $130/sqft, Honolulu HHFDC sale tables | Kauaʻi figures | They live in the engine, so the county inherits Honolulu's |
| Parking | 2 stalls per unit | — | Twice Hawaiʻi County's 1.25; it drives the parking cost and often the unit count |
| Property tax rate | $9.40 per $1,000, the top Non-Owner-Occupied Residential tier | The blended rate for the building's value ($8.47 at $8 million); Commercial $8.10 with retail | The engine takes one rate |
| Workforce housing | None | 20% for R-1 to R-6 projects over 10 units, CN and CG | The exemption covers multiple-family at full density in residential districts of R-10 or more; the engine's rule is county-wide, so it can't apply by zone |
| Building permit by unit | Table 1-A on each unit's value | On the whole project's value | The code values the whole permit (109.3), and the table's rate falls as value rises, so per unit overstates the fee; kept per unit to match the other counties |
| Grading fee | 0.5% of an assumed $30 per cubic yard | The County Engineer's estimate | The cost per cubic yard is an assumption; the fee is small either way |
| Water facilities reserve charge | $9,880 per unit at every size | The larger of that and the meter-size charge | Smaller projects on large meters are undercharged |
| Commercial yards | 5 ft front, no side or rear | The residential side yard and a 10 ft rear next to a residential district | The parcel data has no neighboring zone |
| CN density | R-10's | An adjoining residential district's, where higher | Not known from the parcel data |
| Income limits year | HHFDC 2025 (median $132,900) | HHFDC 2026 | 2025 matches the other counties; move all four together |

## Modeling assumptions

- **Units are the lot over the land per unit,** at 43,560 sqft per acre over the district's units per acre (R-20: 2,178 sqft). A fraction of 65% or more counts as a whole unit; less is dropped (8-4.6(f)).
- **No FAR.** None of these districts sets one, so the building fills the height, coverage and yard envelope up to the unit cap, building only the floor area the units need.
- **Coverage counts buildings and pavement,** as the model's coverage does buildings and parking (8-4.3(d)(3), 8-6.3(g)).
- **Side and rear yards at the full height.** They are 5 ft or half the building wall's height, whichever is greater (8-4.3(b)), taken at the most stories the height allows.
- **Development without subdivision.** One building on an existing lot follows 8-4.3; the 50% coverage for multiple-family subdivision lots (8-4.4) does not apply.
- **Commercial dwellings park like residential ones,** 2 stalls per unit; the CZO sets no dwelling parking in commercial districts.
- **Tax class by use.** Kauaʻi taxes by actual use, not zoning (5A-6.4(a)), so a building of long-term rentals is Non-Owner-Occupied Residential.
- **Sewer charges for every unit.** The model assumes County sewer; parcels on septic pay none.
- **Grading at $30 per cubic yard,** an assumed earthwork cost, so the 0.5% fee is $0.15 per cubic yard of excavation.

## Known limitations

- Hard cost, land cost and sale prices are Honolulu engine defaults, and the market estimates are Honolulu's; only AMI and rent growth are the county's own.
- Height comes from each parcel's `height`, so the parcel data must carry the right limit:
    - 40 ft and 4 stories for multiple-family in residential districts, and no more than 10 ft above a residence within 30 ft (8-4.5(b)(2));
    - 35 ft and 2 stories in CN; 50 ft in CG (8-6.3(f)).
- Side and rear yards are taken at the full height, so shorter buildings get slightly less floor area than they could.
- Retail parking leaves out the 1 stall per 3 employees and the minimum of 4.
- The workforce housing rule is not applied anywhere, though R-1 to R-6, CN and CG projects of more than 10 units may owe 20%.

## Not modeled

| Rule or cost | Source | Why not |
| --- | --- | --- |
| R-40 | CZO 8-2.1, 8-4.2 | Not in Table 8-2.4 or the coverage limits, so its uses and standards aren't set |
| Resort districts RR-10, RR-20 | Table 8-2.4(h), (i) | Multiple-family is not among their uses |
| Form-based districts (Līhuʻe Town Core, Kōloa, Kalāheo) | Chapter 10 | Their own codes and standards |
| Constraint (S-) and special treatment (ST-) overlays | CZO | No overlay data on the parcel |
| Parcel frontage and width for 2 or more units (25 ft, 60 ft average); commercial minimum lots (CN 6,000, CG 8,500 sqft) | CZO 8-4.3(d)(1), 8-6.3(a), (d) | No lot-size check in the engine |
| Front yard from driveways and parking lots serving more than 3 units; paved parking 5 ft from the street | CZO 8-4.3(b)(1), 8-4.5(a)(9) | The model doesn't lay out parking |
| 10 ft between structures; 15 ft per story above two between commercial buildings | CZO 8-4.3(c), 8-6.3(c) | The model builds one building |
| Elderly housing parking (1 per 3 units) | CZO 8-4.5(a)(5) | The model's units are not elderly housing |
| Zoning and use permit fees (Class I $30 to Class IV $800; use permit $300) | CZO 8-3.1, 8-3.2 | Small and not per unit |
| Additional plan review fees for revised plans | KCC 12-1.3 (109.5) | Case by case |
| Park dedication of $150 per unit for the first six units of a building subdivision | KCC 9-2.8(d)(4) | Applies to building subdivisions only |
| Affordable water rate ($4,940 per unit, County Housing Agency projects) | DOW Part 5, III.3(d) | County partnership projects only |
| Long-Term Affordable Rental tax class ($2.59) | KCC 5A-11A.1 | Every dwelling on the parcel must qualify |
| Monthly water and sewer charges | DOW Part 4; KCC 25-13 | Operating costs, in the opex ratio |
| Workforce housing in-lieu fees ($278,240 / $151,280 / $83,080 per 80% / 100% / 120% unit, 2020, CPI-adjusted) | KCC 7A-3.1 | No workforce rule is applied |
| School impact fee | HRS 302A | No Kauaʻi school impact district; $0 as for the other counties |
| State parking cap (HB 1919, SB 2981, 2026) | 2026 session | Not law |
| General excise tax (4.5%) | HRS 237 | Not modeled for any county |

## Zoning

Kauaʻi limits density by dwelling units per acre: the number in a residential district's name is its maximum units per acre (8-4.2(b)). So every zone uses `current.lot_area_per_unit` (43,560 over the units per acre) with `units_round_up_at: 0.65`, and none sets `far`.

Multiple-family dwellings are permitted by right in every residential district R-1 to R-20 (Table 8-2.4(b)), in CN (8-2.4(j)(9)) and in CG (8-2.4(k)(22)).

| Zone | Units per acre | Land per unit (sqft) | Coverage | Yards (front / side / rear) | Source |
| --- | --- | --- | --- | --- | --- |
| R-1 | 1 | 43,560 | 60% | 10 ft / 5 ft or ½ height / 5 ft or ½ height | 8-4.2, 8-4.3 |
| R-2 | 2 | 21,780 | 60% | Same | 8-4.2, 8-4.3 |
| R-4 | 4 | 10,890 | 60% | Same | 8-4.2, 8-4.3 |
| R-6 | 6 | 7,260 | 60% | Same | 8-4.2, 8-4.3 |
| R-10 | 10 | 4,356 | 80% | Same | 8-4.2, 8-4.3 |
| R-20 | 20 | 2,178 | 90% | Same | 8-4.2, 8-4.3 |
| CN | 10 (R-10's) | 4,356 | 80% | 5 ft / 0 / 0 | 8-6.3, 8-6.6(a) |
| CG | 20 (R-20's) | 2,178 | 90% | 5 ft / 0 / 0 | 8-6.3, 8-6.6(b) |

The commercial districts permit commercial uses, so `commercial_coverage` is 1; the residential districts' is 0.

## Parking, loading and bicycle parking

| Field | Value | Source |
| --- | --- | --- |
| `parking.residential_stalls_per_unit` | 2 | CZO 8-4.5(a)(5) |
| `parking.retail_sqft_per_stall` | 300 | CZO 8-6.3(e)(3)(A): plus 1 per 3 employees (not modeled), at least 4 |
| `parking.joint_use` | 1 | No shared-parking reduction; off-site stalls within 200 ft (8-6.3(e)(3)(G)) don't reduce the count |
| `parking.round_up` | Not set (half-up) | No rounding rule in the CZO |
| `loading` | None | The CZO sets no off-street loading requirement |
| `bicycle` | None | No bicycle parking requirement |

## Fees

| Field | Value | Notes | Source |
| --- | --- | --- | --- |
| `building_permit` | Table 1-A (below), on each unit's value | "Or fraction thereof", so each step rounds up. Low-income housing is exempt and gap-group housing pays half, which the fee toggle covers | KCC 12-1.3, Table 1-A |
| `plan_review` | 15% of the building permit fee | Rounded to the dollar in the code, not in the model | KCC 12-1.3 (109.5) |
| `environmental` | $0 | No County EA or EIS review fee | — |
| `temp_occupancy_cert` | $0 | No certificate of occupancy fee in the Building Code | — |
| `escp` | $0 | Part of the grading permit | KCC 22-7 |
| `installation_trench`, `service_connection` | $0 | The lateral is built at the applicant's cost and credited against the sewer connection charge; the sewer permit has no fee | KCC 25-9.4, 25-10.1 |
| `grading` | $0.15 per cubic yard | 0.5% of the work's estimated cost, at an assumed $30 per cubic yard | KCC 22-7.12(a) |
| `grubbing`, `stockpiling` | $0 | In the same grading permit fee | KCC 22-7.12(a) |
| `wastewater` | $2,523 per unit | Sewer connection charge $593 plus wastewater treatment capacity assessment $1,930 per multi-family unit (eff. July 1, 2023). Affordable housing is exempt and gap-group pays half | KCC 25-11.1, 25-11.2, 25-12.1, 25-12.3 |
| `park_dedication` | 160.1 sqft per unit, all but 1 unit | 1.75 acres per 1,000 people × 2.1 people per multi-family unit; assessed at building permit for all but one unit on a lot. The fee in lieu is the raw land's value plus half its rise on subdivision, taken as the parcel's land cost | KCC 9-2.8(c)(2)(E), (d), (e) |
| `school_impact_per_unit` | $0 | No Kauaʻi school impact district | HRS 302A |

### Building permit table

| Valuation | Fee |
| --- | --- |
| $1 to $500 | $15 |
| $501 to $2,000 | $15 + $2 per $100 over $500 |
| $2,001 to $25,000 | $45 + $8 per $1,000 over $2,000 |
| $25,001 to $50,000 | $229 + $7 per $1,000 over $25,000 |
| $50,001 to $100,000 | $404 + $6 per $1,000 over $50,000 |
| $100,001 to $1,000,000 | $704 + $5 per $1,000 over $100,000 |
| $1,000,001 to $25,000,000 | $5,204 + $4 per $1,000 over $1 million |
| $25,000,001 to $50,000,000 | $101,204 + $3 per $1,000 over $25 million |
| Over $50,000,000 | $176,204 + $2 per $1,000 over $50 million |

A $350,000 unit pays $1,954, plus $293 plan review. After-the-fact permits pay double, not modeled.

## Water

The Department of Water's facilities reserve charge for multi-family development is the larger of the approved meter's charge and $9,880 per unit (Part 5, III.3(b), rev. June 15, 2020). `water.wsfc_per_fu` is $9,880, with one charge per dwelling (`demand_per_unit` 1 for every type).

| Meter | Charge |
| --- | --- |
| 5/8 in | $14,115 |
| 3/4 in | $21,170 |
| 1 in | $35,290 |
| 1½ in | $70,580 |
| 2 in | $112,920 |
| 3 in | $225,840 |
| 4 in | $352,880 |
| 6 in | $705,750 |
| 8 in | $1,129,200 |

Per unit is the larger above 35 units on a 4-inch meter and 71 on a 6-inch. The per-unit charge is used at every size, so smaller projects on large meters are undercharged. County Housing Agency affordable projects pay $4,940 per unit (III.3(d)), and affordable projects may defer, not skip, the charge (IV.8), so `waiver_unit_cap` is 0. Monthly service, use and fire service charges (Part 4) are operating costs.

## Property tax

FY 2026–27 rates (Resolution 2026-11; the same as FY 2025–26), per $1,000 of net assessed value:

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

Property is classed by actual use (5A-6.4(a)), so a building of long-term rentals is Non-Owner-Occupied Residential. `property_tax_rate` is 0.0094, the top tier, since the engine takes one rate and an apartment building's value is mostly above $2 million.

A building with retail has two uses and takes the higher rate, comparing tiered classes at their lowest tier (5A-6.4(d)), so it would be Commercial at $8.10. Long-Term Affordable Rental needs every dwelling on the parcel to be a qualifying affordable rental (5A-11A.1(b)).

## Income limits and affordable rents

`income_limits` is HHFDC's 2025 Kauaʻi County schedule (median family income $132,900), by AMI % for household sizes 1–8. It reproduces HHFDC's 2025 rent guidelines, for example:

| AMI | Studio | 1 BR | 2 BR | 3 BR | 4 BR |
| --- | --- | --- | --- | --- | --- |
| 60% | $1,396 | $1,496 | $1,795 | $2,073 | $2,313 |
| 80% | $1,862 | $1,995 | $2,394 | $2,765 | $3,084 |
| 100% | $2,327 | $2,493 | $2,992 | $3,456 | $3,855 |
| 120% | $2,793 | $2,992 | $3,591 | $4,147 | $4,626 |

## Workforce housing (Chapter 7A)

The Housing Policy applies to building permits for more than 10 dwelling units on a lot in any residential, resort or commercial district (7A-1.4.1(c)(2)). Residential projects owe 20% workforce housing, sold at 80% to 120% of Kauaʻi median income (7A-2.1(a)). Projects of 26 or more units split it 30% / 40% / 30% at 80% / 100% / 120%.

Two exemptions apply (7A-1.4.2(b), Ord. 1081, adopted October 29, 2020, expiring 10 years later):

- multiple-family projects in residential or mixed-use districts of R-10 density or more, outside visitor destination areas and SMAs, built at or above the maximum density;
- projects in the Līhuʻe Town Core, Kōloa and Kalāheo form-based districts.

The model builds R-10 and R-20 to the maximum density, so those projects qualify. R-1 to R-6 projects of more than 10 units (only possible on lots of about 2 acres or more) and CN and CG projects may not, since CN and CG are commercial districts. The engine's `inclusionary` rule is county-wide, so none is set, and this is in [Choices to revisit](#choices-to-revisit).

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
| Lease-up (engine default) | 9 months | Honolulu's |

## Engine changes

Two optional fields, so Honolulu, Maui and Hawaiʻi County are unchanged:

| Change | File | Why |
| --- | --- | --- |
| `CurrentZoningRules.units_round_up_at`: a fractional unit at or above this share counts | `core/locality.ts`, `core/zoning.ts` | Kauaʻi counts a fraction of 65% or more (8-4.6(f)) |
| `YardRules.side_rear_height_fraction`: side and rear yards are at least this share of the building's height | `core/locality.ts`, `calc-bill6.ts` | Kauaʻi's 5 ft or half the wall height (8-4.3(b)) |

`checkLocality` checks that both are shares (0 to 1). The template and [ADDING_A_COUNTY.md](ADDING_A_COUNTY.md) describe both.

## Tests

- `test/kauai-config.test.ts`:
    - zoning: density and rounding, coverage, yards, districts left out;
    - parking and loading;
    - fees: building permit, plan review, grading, sewer, park land;
    - water, tax, income limits and rents, the workforce exemption;
    - an end-to-end run, and completeness.
- `test/current-zoning.test.ts`: the two engine options on the generic test county.

## Sources

| Source | Used for |
| --- | --- |
| Kauaʻi County Code Chapter 8, Comprehensive Zoning Ordinance (eCode360, downloaded Oct. 29, 2026) | Districts, uses (Table 8-2.4), density, coverage, yards, height, parking |
| Kauaʻi County Code Chapter 7A, Housing Policy | Workforce housing requirement and exemption |
| Kauaʻi County Code Chapter 12, Building Code (12-1.3, Table 1-A) | Building permit and plan review fees |
| Kauaʻi County Code Chapter 22, Article 7 (22-7.12) | Grading permit fee |
| Kauaʻi County Code Chapter 25, Sewers (Articles 9–12) | Sewer connection charge, treatment capacity assessment |
| Kauaʻi County Code Chapter 9, Subdivisions (9-2.8) | Park dedication |
| Kauaʻi County Code Chapter 5A, Real Property Tax (5A-6.4, 5A-11A.1) | Tax classes |
| [Kauaʻi DOW Rules Part 5, Facilities Reserve Charge (rev. June 15, 2020)](https://www.kauaiwater.org/wp-content/uploads/rules_part5.pdf) | Water facilities reserve charge |
| [Kauaʻi DOW Rules Part 4, Rates (rev. Sept. 24, 2026)](https://www.kauaiwater.org/wp-content/uploads/Part-4-Fixing-Rates-for-the-Furnishing-of-Water-Service-in-the-COK-rev.-09-24-26.pdf) | Monthly rates only, no one-time charges |
| [Notice of publication, Resolution 2026-11 (FY 2026–27 tax rates)](https://www.kauai.gov/files/assets/public/v/1/county-council/documents/budget/2026-06-03-notice-of-publication-re-resolution-no.-2026-11.pdf) | Property tax rates |
| [FY 2025–26 tax rates, Real Property Assessment](https://www.kauai.gov/files/assets/public/v/1/finance/rpa/2026-tax-reliefexemption-forms/2025-assessment-year-tax-rates_-no-pitt_-rev-9.24.2025-printable.pdf) | Rates unchanged year to year |
| [HHFDC 2025 Kauaʻi County income schedule](https://dbedt.hawaii.gov/hhfdc/files/2025/05/Kauai-County-2025.pdf) | Income limits, affordable rents |
| [HHFDC 2013 Kauaʻi County income schedule](https://files.hawaii.gov/dbedt/hhfdc/resources/2013Kauai.pdf) | AMI growth |

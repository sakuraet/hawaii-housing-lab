# County of Maui config: notes and choices

Maui is a registered county in the model: parcels with `locality: "hi-maui"` run the current-zoning (`bill6`) pathway end to end. Every rule comes from Maui County Code (Municode, version of Sep 14, 2026), the FY 2027 budget appendices or HHFDC's 2025 Maui income table. Estimates without a Maui source carry Honolulu's figures, marked as such.

- **Where it lives:** `src/localities/hi/maui/` (`zones.ts`, `rules.ts`, `assumptions.ts`, `index.ts`), tested in `test/maui-config.test.ts`.
- **Check:** a made-up A-2 lot of 20,000 sqft at 60 ft gives 18,000 sqft of floor area (FAR 0.9), 28 units and 56 stalls (2 per unit), 6 of them workforce housing (MCC 2.96).

## Choices to revisit

These are judgment calls made to fit Maui's rules into the model; each is also noted in the code where it is made. The ones most likely to move results come first.

| Choice | Current value | Alternative | Why it matters |
| --- | --- | --- | --- |
| Market estimates (cap rate, vacancy, cost escalation, opex and assessment growth, parking costs, timing) | Honolulu's figures | Maui-specific sources | These drive land value directly; none have a Maui source yet |
| Workforce housing: how it's met | On-site rentals, 25% of market units, rents at the 80/100/120% AMI caps | 20% if conveyed to a qualified provider in perpetuity; or the in-lieu fee | The in-lieu fee may be cheaper than building the units; the model doesn't compare them |
| Workforce units' fees and park land | Charged like Honolulu's affordable units under the fee toggle (waived fees, no park land) | Maui's actual treatment: 50% building permit fee, 250 sqft park land per unit | The toggle waives these units' fees in full; Maui gives only partial relief |
| School impact fee | $0, as for Honolulu | Maui DOE school impact districts (Central, South, West Maui): about $3,300–5,300 per multifamily unit in 2019 (from the team's rule sheet, not yet checked against DOE's current rates) | The team set Honolulu's to $0; worth deciding the same way for both |
| Setbacks | The model's default 10 ft setback | A-1/A-2: 15 ft front and rear (20 above 35 ft), 10 ft side (15 above 35 ft) | Deeper setbacks shrink A-zone floor plates; needs the setback rule kind in the generic refactor |
| Minimum lot size | Not checked | A and H zones 10,000–20,000 sqft, B zones 6,000 sqft | Smaller lots can't use the zone at all |
| Engine defaults: hard cost, land cost, sale prices | $450/sqft hard cost, $130/sqft land, Honolulu HHFDC sale tables | Maui figures | They live in the engine, not the county config, so Maui currently inherits Honolulu's |
| Wastewater service area | Wailuku-Kahului, $4.57/gal | Kīhei $4.65/gal; $0 outside both systems | The model has one rate per county; parcels outside these systems are overcharged |
| Wastewater flow per unit | 255 gpd | Confirm with WWRD | The flow table is dated 2006 and hasn't been confirmed current |
| Studio bedrooms for water ESDs | 0 bedrooms (0.4 ESD) | 1 bedroom (0.5 ESD) | DWS counts any room that could be slept in as a bedroom |
| Water connection charge | $1,250 DWS review fee in the meter slot | Add an actual-cost meter installation estimate | DWS bills meter installs at cost (with a $1,000 deposit for meters over 1 inch) |
| Fire plan review | Left out | Add 17.5% of the building permit fee | Honolulu's config has no fire review fee, so it was left out to match |
| Property tax class | Apartment, $3.50/$1,000 | Long-Term Rental tiers ($2.90 / $5.00 / $8.50) | Units with a long-term rental exemption are taxed in that class instead |
| Ground-floor retail in B-2 and B-3 | None assumed | A share like Honolulu's BMX (60%) | Retail is allowed but not required; matches Honolulu's B-2 |
| B-1 and B-CT districts | Left out (parcels there stop with an error) | Model them by height and setbacks | Neither district has an FAR or a lot coverage limit, and the engine needs an FAR |
| Road trenching permit | $0 | $250 + $200 per project | Charged per project, but the model's field is per unit |
| Parking reductions | Not modeled | Up to 50% at the director's discretion | Case by case (MCC 19.36B.110(A)) |
| Park land for workforce housing | 500 sqft per unit | 250 sqft per workforce unit | Only matters if the model tracks workforce units separately |

## Zoning

Eight zone codes (seven districts) that allow multifamily housing by right are configured. Any other zone stops the run with an error rather than quietly getting no FAR, so a missing district gets noticed.

| District | FAR | Lot coverage | Source |
| --- | --- | --- | --- |
| A-1 Apartment | 0.5 on lots under 3 acres; 0.4 on 3 acres or more | 25% | MCC 19.12.050 |
| A-2 Apartment | 0.9 | 35% | MCC 19.12.050 |
| H-1 Hotel | 0.5 | 25% | MCC 19.14.050 |
| H-M Hotel | 1.0 | 30% | MCC 19.14.050 |
| H-2 and Hotel | 1.5 | 35% | MCC 19.14.050 |
| B-2 Community Business | 2.0 | 100% (no limit) | MCC 19.18.050 |
| B-3 Central Business | 4.0 | 100% (no limit) | MCC 19.20.050 |

- **Hotel districts** allow any use permitted in the apartment districts (MCC 19.14.020(A)). "Hotel" is listed alongside H-2 because the code's table heads that column "H-2 & Hotel".
- **B-2 and B-3** list multifamily dwellings as a permitted use and set no lot coverage limit or front setback, so coverage is 100%.
- **Height** isn't set in the config. It varies within a district by community plan area (B-2: 90 ft on Maui island, 45 ft in West Maui, Hāna and on Lānaʻi, 35 ft on Molokaʻi), so it comes from each parcel's `height`.
- **Left out:**
    - B-1 and B-CT: no FAR or coverage limit. B-1 allows dwellings only above or below a business use, and B-CT excludes Lānaʻi and Molokaʻi.
    - SBR, R and D: single-family and duplex only.
- **Not modeled:** Maui's open-space incentive bonus (MCC 19.56). The engine's bonus formula is Honolulu's, so applying it to Maui would be wrong.

## Parking, loading and bicycle parking

Maui requires 2 stalls per dwelling unit under 3,000 sqft, whatever its size or bedroom count. Honolulu's minimum is by floor area instead, so the model now takes either form (see Engine changes).

| Rule | Maui (MCC 19.36B) | In the model |
| --- | --- | --- |
| Housing parking | 2 stalls per unit under 3,000 sqft | `residential_stalls_per_unit: 2` |
| Retail parking | 1 per 500 sqft, at least 3 | 1 per 500 sqft; the minimum of 3 isn't modeled |
| Joint use | No reduction in the code | 1 (no reduction) |
| Loading | By non-dwelling floor area: 1 space for 2,000–10,000 sqft, 2 above | Housing needs none; retail by that schedule |
| Loading space sizes | Small, medium and large, depending on floor area | Small (8.5 × 19 ft) and large (12 × 35 ft) only; medium isn't a model size |
| Bicycle parking | Not required | `bicycle_required: false` in every zone |

A proposed Council change (Resolution 25-152) would base housing parking on bedrooms: 1 stall for a studio or one-bedroom, 2 for two or three bedrooms. Its status should be checked before submission, because it would halve parking for the model's default one-bedroom mix.

## Workforce housing (MCC 2.96)

Every Maui project creating 10 or more dwelling units must provide workforce housing equal to 25% of its market-rate units, rounded up, which works out to about a fifth of all units. It applies at building permit, so by-right projects are covered, and 201H projects too (MCC 2.96.030(E)). Honolulu has no such rule, so this is the biggest difference between the two counties in the model.

| Rule | Maui (MCC 2.96, as amended by Ord. 5875, 2025) | In the model |
| --- | --- | --- |
| Threshold | 10 or more dwelling units | `inclusionary.min_units: 10` |
| Required units | 25% of market-rate units, rounded up (20% if conveyed to a qualified housing provider and kept affordable in perpetuity) | 25%: the least W with W ≥ 0.25 × (N − W), so 6 of 28 |
| Rental income mix | One-third each at 80% AMI or less, over 80–100%, over 100–120% | Each third rents at its band's cap (80, 100, 120% AMI); the three rents are averaged |
| Alternatives | In-lieu fee per unit (3-bedroom price gap between 100% and 160% AMI), land, or credits | Not modeled |
| Exemptions | Wailuku redevelopment area; government and community land trust projects | Not modeled |

The model's market rent is the 120% AMI rent, so the top third of workforce units rents at market. Only the 80% and 100% thirds cut income.

## Fees, water, wastewater and property tax

Maui's code leaves the fee amounts to the annual budget, so they come from the FY 2027 appendices (July 1, 2026 to June 30, 2027). Pages below are the appendix page numbers.

| Item | Maui value | Source |
| --- | --- | --- |
| Building permit | $30 to $5,880 plus $10 per $1,000 above $1M, on each unit's construction value; each step rounds up | County App. B p. 36 |
| Plan review | 35% of the building permit fee | County App. B p. 50 |
| Environmental assessment | $1,895; no separate EIS fee | County App. B p. 31 |
| Certificate of occupancy | $50 | County App. B p. 37 |
| Grading | $60 per 100 cu yd up to 500; then $300 + $25 per 100 to 10,000; then $2,675 + $8 per 100 | County App. B p. 48 |
| Grubbing | $100 for the first acre, $50 for each further acre | County App. B p. 48 |
| Stockpiling, erosion control plan, utility trenching | $0 (stockpiling and erosion control are covered by the grading permit; trenching is charged per project) | County App. B p. 48 |
| Park dedication | 500 sqft per unit in excess of 3, paid in lieu at land value; no application fee | MCC 18.16.320; App. B p. 30 |
| Wastewater assessment | $4.57 per gallon × 255 gpd per unit = about $1,165 per unit | MCC 14.35; App. B p. 11; WWRD flow standards |
| Water system development fee | $5,491 per ESD ($3,541 source + $900 transmission + $1,050 storage) | DWS App. B p. 64 |
| Water review fee | $1,250 per non-single-family building permit | DWS App. B p. 64 |
| Property tax | Apartment class, $3.50 per $1,000 | MCC 3.48.305(B)(3); App. B p. 12 |
| School impact fee | $0, as for Honolulu | HRS 302A |

- **Water by ESD, not fixture units:** since Jan 1, 2026 (Ord. 5759), DWS sizes water demand in equivalent single dwellings (300 gallons a day each), using ESD = (1.15 × baths^1.3 + beds + 3) / 10, rounded to 0.1. With the model's beds and baths per unit type: studio 0.4, one-bedroom 0.5, two-bedroom 0.7, three-bedroom 0.9, four-bedroom 1.0. A one-bedroom pays about $2,746.
- **No affordable waiver for water:** the DWS appendix lists none, so `waiver_unit_cap` is 0.
- **Affordable discounts the model handles with its fee toggle:** affordable housing under MCC 2.86 pays 50% of the building permit fee, and 100% workforce housing projects are exempt from it and from the wastewater assessment.
- **The monthly water rates** on DWS's Water Charges page ($5.09 per 1,000 gallons for multi-family) are operating costs, not development fees, so they aren't in this config.

## Estimates

Only AMI and rent growth have a Maui source so far; everything else is Honolulu's figure, carried over so the model runs. These are the team's choices, not law.

| Estimate | Value | Basis |
| --- | --- | --- |
| AMI growth | 3.9% a year | HHFDC Maui 100% AMI for 4 people: $84,900 (2013) to $134,600 (2025) |
| Rent growth during the hold | 3.9% a year | Affordable caps track the income limits; Maui market rent growth not checked |
| Permitting and construction | 18 and 12 months | Honolulu's |
| Cap rate | 5.1% | Honolulu's |
| Vacancy | 7.4% residential, 12.6% retail | Honolulu's |
| Construction cost escalation | 5.6% a year | Honolulu's (RLB Honolulu) |
| Opex and assessment growth | 3.5% and 2% a year | Honolulu's |
| Parking | 330 sqft and $190/sqft structured; 360 sqft and $30/sqft surface; $100 a month per stall | Honolulu's (Ulupono 2020, RLB Q2 2026) |
| Excavation depth | 3 ft (A-1, H-1), 5 ft (A-2, H-M, H-2, Hotel, B-2), 9 ft (B-3); 4 ft otherwise | Honolulu's depths for districts of like density |

Honolulu's AMI growth (4%) is measured on median family income, while Maui's (3.9%) is measured on the HHFDC 100% row the model actually uses for rents. Maui's median family income grew more slowly over the same years ($84,900 to $110,900, 2.25% a year).

## Engine changes

Six small changes let the engine read Maui's rules. Each one is optional or a default that leaves Honolulu's results the same, and the v0.2.1 snapshots still match.

| Change | Why Maui needs it | Why Honolulu is unchanged |
| --- | --- | --- |
| `residential_stalls_per_unit` in ParkingRules (now one of it or `residential_sqft_per_stall`); `checkLocality` requires exactly one | Maui's minimum is per unit, not per sqft | Honolulu keeps `residential_sqft_per_stall: 1000` |
| `park_dedication.exempt_units` | Maui exempts the first 3 units | Defaults to 0 |
| `calcFarBill6` and `lotCoverageBill6` take the lot size | Maui A-1's FAR drops from 0.5 to 0.4 at 3 acres; lot size 0 was always used before | Honolulu's current-zoning schedules are flat |
| `water.demand_per_unit`, used by `mixFixtureUnits` | Maui charges per ESD by beds and baths, not per fixture unit | Unset for Honolulu, so fixture units are used as before |
| `article6Parking` follows the zone's `bicycle_required` in bill6 | Maui requires no bicycle parking; its zeroed bicycle figures produced NaN | Every Honolulu zone with a bill6 FAR requires bicycle parking |
| `rules.inclusionary`, read by `requiredAffordableUnits` and `inclusionaryRent` in bill6 | Maui requires workforce units in every project of 10+ units | Absent for Honolulu, so bill6 keeps 0 affordable units |

The template's parking comment (`templates/locality/rules.ts`) now offers both forms of the housing minimum.

## Sources

- [Maui County Code, Municode](https://library.municode.com/hi/county_of_maui/codes/code_of_ordinances) (version of Sep 14, 2026): Chapters 19.11, 19.12, 19.14, 19.15, 19.16, 19.18, 19.20 (zoning), 19.36B (parking and loading), 18.16.320 (parks), 14.07 (water system development fees), 14.35 (wastewater assessment), 3.48.305 (tax classes)
- [MCC 2.96 Residential workforce housing policy](https://library.municode.com/hi/county_of_maui/codes/code_of_ordinances?nodeId=TIT2ADPE_CH2.96REWOHOPO) (applicability, 25% requirement, income mix)
- [County of Maui FY 2027 Appendix B, Revenues - Fees, Rates, Assessments and Taxes](https://www.mauicounty.gov/DocumentCenter/View/159446/005---FY-2027-App-B-Rates-and-Fees_Clean-PDF)
- Department of Water Supply FY 2027 Appendix B, Water Fund - Water Rates and Fees (linked from [DWS Water Charges](https://www.mauicounty.gov/216/Water-Charges))
- [DWS Water Use Calculation Method](https://www.mauicounty.gov/2895/Water-Use-Calculation-Method) (ESD formula, Ord. 5759)
- [County of Maui WWRD Wastewater Flow Standards](https://www.mauicounty.gov/DocumentCenter/View/6775/Wastewater-Flow-Standards) (255 gpd per apartment unit; taken from a search summary of the document, to be confirmed)
- [HHFDC 2025 Maui County income schedule](https://dbedt.hawaii.gov/hhfdc/files/2025/05/Maui-County-2025.pdf)
- [HHFDC 2013 Maui County income schedule](https://files.hawaii.gov/dbedt/hhfdc/resources/2013Maui.pdf)
- [Molokaʻi Planning Commission minutes, Jan 14, 2026](https://www.mauicounty.gov/AgendaCenter/ViewFile/Minutes/_01142026-546) (Resolution 25-152, bedroom-based parking proposal)

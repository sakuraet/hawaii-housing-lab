# County of Maui config: notes, reasoning and sources

Maui is a registered county in the model: parcels with `locality: "hi-maui"` run the current-zoning (`bill6`) pathway end to end. This note explains every value in Maui's config: what it is, where it came from, why it was fitted to the model the way it was, and what is left to decide. Read it alongside the code; each choice below is also noted in a comment where it is made.

- **Where it lives:** `src/localities/hi/maui/` (`zones.ts` zoning, `rules.ts` law and fee schedules, `assumptions.ts` estimates, `index.ts` the `Locality`), tested in `test/maui-config.test.ts`.
- **Coverage:** the County of Maui is Maui island, Molokaʻi and Lānaʻi. One config covers all three; where rules differ by island or community plan area, the note says how that's handled.
- **Pathways:** current zoning only (`pathways: ["bill6"]`). Standard (pre-Bill 6), Bill 7, TOD and Waikīkī are Honolulu ordinances and don't apply. Asking for another pathway throws.
- **Check:** a made-up A-2 lot of 20,000 sqft at 60 ft gives 18,000 sqft of floor area (FAR 0.9), 28 units and 56 stalls (2 per unit), 6 of them workforce housing (MCC 2.96).

## Contents

1. [How the data was gathered](#how-the-data-was-gathered)
2. [Choices to revisit](#choices-to-revisit)
3. [Zoning](#zoning)
4. [Parking, loading and bicycle parking](#parking-loading-and-bicycle-parking)
5. [Workforce housing (MCC 2.96)](#workforce-housing-mcc-296)
6. [Fees](#fees)
7. [Water](#water)
8. [Wastewater](#wastewater)
9. [Property tax](#property-tax)
10. [Income limits and affordable rents](#income-limits-and-affordable-rents)
11. [Estimates](#estimates)
12. [Engine changes](#engine-changes)
13. [The team's rule sheet, row by row](#the-teams-rule-sheet-row-by-row)
14. [Tests](#tests)
15. [Sources](#sources)

## How the data was gathered

Every rule was taken from a primary document wherever one could be read. Values are trusted in this order, and each value below says which kind it is:

1. **Code text:** Maui County Code on Municode, version of Sep 14, 2026, read section by section. Zoning, parking, loading, park dedication, workforce housing, the water and wastewater fee chapters and the tax classes come from here.
2. **The FY 2027 budget appendices:** the code leaves most fee amounts to the annual budget, so amounts come from the County of Maui FY 2027 Appendix B ("Revenues - Fees, Rates, Assessments and Taxes") and the Department of Water Supply's own FY 2027 Appendix B ("Water Fund - Water Rates and Fees"). Both cover July 1, 2026 to June 30, 2027. The County's website blocks automated downloads, so the team downloaded both PDFs and they were read in full. Page numbers in this note and the code are the appendix's own page numbers (its footers), not PDF page numbers.
3. **Official tables:** HHFDC's 2013 and 2025 Maui County income schedules, and DWS's Water Use Calculation Method page.
4. **Search summaries:** used only where the primary document couldn't be opened. Two values rest on one: the 255 gallons a day of wastewater flow per unit, and the school impact fee range. Both are flagged below.
5. **Honolulu's figures:** where no Maui source has been found (market estimates, timing, parking costs), Honolulu's value is carried over so the model runs, and marked "Honolulu's" in the code.

**The team's rule sheet.** The team's Maui County Rule Sheet (researched October 2026) listed every rule Honolulu's model uses with its Maui counterpart. It was used as the checklist for this config and cross-checked line by line. Where the sheet relied on search summaries (fees, water, tax), this config uses the primary appendices instead, and the differences are listed in [the team's rule sheet, row by row](#the-teams-rule-sheet-row-by-row). The sheet's zoning table, income limits and affordable rents are reproduced in this note.

## Choices to revisit

These are judgment calls made to fit Maui's rules into the model. The ones most likely to move results come first.

| Choice | Current value | Alternative | Why it matters |
| --- | --- | --- | --- |
| Market estimates (cap rate, vacancy, cost escalation, opex and assessment growth, parking costs, timing) | Honolulu's figures | Maui-specific sources | These drive land value directly; none have a Maui source yet |
| Engine defaults: hard cost, land cost, sale prices | $450/sqft hard cost, $130/sqft land, Honolulu HHFDC sale tables | Maui figures (post-fire rebuilding may push costs up) | They live in the engine, not the county config, so Maui currently inherits Honolulu's |
| Workforce housing: how it's met | On-site rentals, 25% of market units, rents at the 80/100/120% AMI caps | 20% if conveyed to a qualified provider in perpetuity; or the in-lieu fee | The in-lieu fee may be cheaper than building the units; the model doesn't compare them |
| Workforce units' fees and park land | Charged like Honolulu's affordable units under the fee toggle (waived fees, no park land) | Maui's actual treatment: 50% building permit fee, 250 sqft park land per unit | The toggle waives these units' fees in full; Maui gives only partial relief |
| Parking minimum | 2 stalls per unit | 1 stall for a studio or one-bedroom if Resolution 25-152 passes | Would halve parking for the default one-bedroom mix; check its status before submission |
| School impact fee | $0, as for Honolulu | Maui DOE school impact districts (Central, South, West Maui): about $3,300–5,300 per multifamily unit in 2019 (from the rule sheet, via a 2019 DOE report; current rates not checked) | The team set Honolulu's to $0; worth deciding the same way for both |
| Setbacks | The model's default 10 ft setback | A-1/A-2: 15 ft front and rear (20 above 35 ft), 10 ft side (15 above 35 ft); B-2/B-3: 0 ft front | Deeper setbacks shrink A-zone floor plates; needs the setback rule kind in the generic refactor |
| Minimum lot size | Not checked | A zones 10,000 sqft and 70 ft wide; B zones 6,000 sqft and 60 ft wide | Smaller lots can't use the zone at all |
| Wastewater service area | Wailuku-Kahului, $4.57/gal | Kīhei $4.65/gal; $0 (and a septic cost) outside both systems | The model has one rate per county; parcels outside these systems are overcharged |
| Wastewater flow per unit | 255 gpd | Confirm with WWRD | Taken from a search summary of a 2006 table; not confirmed current |
| Studio bedrooms for water ESDs | 0 bedrooms (0.4 ESD) | 1 bedroom (0.5 ESD) | DWS counts any room that could be slept in as a bedroom |
| Water connection charge | $1,250 DWS review fee in the meter slot | Add an actual-cost meter installation estimate | DWS bills meter installs at cost (with a $1,000 deposit for meters over 1 inch) |
| Fire plan review | Left out | Add 17.5% of the building permit fee | Honolulu's config has no fire review fee, so it was left out to match |
| Property tax class | Apartment, $3.50/$1,000 | Long-Term Rental tiers ($2.90 / $5.00 / $8.50) | Units with a long-term rental exemption are taxed in that class instead |
| Ground-floor retail in B-2 and B-3 | None assumed | A share like Honolulu's BMX (60%) | Retail is allowed but not required; matches Honolulu's B-2 |
| B-1 and B-CT districts | Left out (parcels there stop with an error) | Model them by height and setbacks | Neither district has an FAR or a lot coverage limit, and the engine needs an FAR |
| Height by community plan area | From each parcel's `height` | A community plan area field on the parcel and a height table | The parcel data must carry the right height for West Maui, Hāna, Lānaʻi and Molokaʻi |
| Road trenching permit | $0 | $250 + $200 per project | Charged per project, but the model's field is per unit |
| Parking reductions | Not modeled | Up to 50% at the director's discretion | Case by case (MCC 19.36B.110(A)); could be an optional slider |
| Retail parking minimum of 3 stalls | Not modeled | Add a floor of 3 | Only matters for very small retail areas |
| State parking cap (HB 1919, 2026) | Not modeled | 0.5 stalls per unit from 7/1/2027 | Passed the House; no sign it became law |
| Hāna, Lānaʻi and Molokaʻi AMI | County-wide HHFDC table | Adjusted medians allowed under 2.96 | Workforce rents there may be set on a different median |

## Zoning

`zones.ts` lists the eight zone codes (seven districts) that allow multifamily housing by right. Only the `bill6` (current zoning) FAR and lot coverage are set, because other counties run only that pathway; the name `bill6` is Honolulu's and is kept until the generic "current zoning" refactor.

| District | FAR | Lot coverage | Height | Min. lot | Yards (ft) | Source |
| --- | --- | --- | --- | --- | --- | --- |
| A-1 Apartment | 0.5 on lots under 3 acres; 0.4 on 3 acres or more | 25% | 35 ft | 10,000 sqft, 70 ft wide | Front/rear 15 (20 above 35 ft); side 10 (15 above 35 ft) | MCC 19.12.020, 19.12.050 |
| A-2 Apartment | 0.9 | 35% | 60 ft | 10,000 sqft, 70 ft wide | Same as A-1 | MCC 19.12.020, 19.12.050 |
| H-1 Hotel | 0.5 | 25% | By district table | Not checked | Not checked | MCC 19.14.050 |
| H-M Hotel | 1.0 | 30% | By district table | Not checked | Not checked | MCC 19.14.050 |
| H-2 and Hotel | 1.5 | 35% | By district table | Not checked | Not checked | MCC 19.14.050 |
| B-2 Community Business | 2.0 | 100% (no limit) | 90 ft on Maui island; 45 West Maui, Hāna, Lānaʻi; 35 Molokaʻi | 6,000 sqft, 60 ft wide | Front 0; side/rear 0 or the adjoining zone's | MCC 19.18.020, 19.18.050 |
| B-3 Central Business | 4.0 | 100% (no limit) | 144 ft on Maui island; 45 West Maui, Hāna, Lānaʻi; 35 Molokaʻi | 6,000 sqft, 60 ft wide | Same as B-2 | MCC 19.20.020, 19.20.050 |

Only FAR and lot coverage are in the config. Height comes from the parcel; minimum lots and yards are recorded here for the refactor and aren't modeled.

### Why it's set up this way

- **FAR is the density control, as in Honolulu.** No A or B district caps units per acre, so the unit count follows from floor area. The code states FAR as a percent of lot area (A-2 "90%"), entered as a ratio (0.9).
- **A-1's FAR depends on lot size.** It's a two-band schedule, 0.5 below 130,680 sqft (3 × 43,560) and 0.4 at or above. Before this config the engine always looked FAR up at lot size 0, so `calcFarBill6` and `lotCoverageBill6` now take the lot size (see [Engine changes](#engine-changes)).
- **Hotel districts** allow any use permitted in the apartment districts (MCC 19.14.020(A)), so they're included. Shops there are accessory to hotels only, so no ground-floor retail is modeled. "Hotel" is listed as its own code alongside H-2 because the code's table heads that column "H-2 & Hotel".
- **B-2 and B-3** list multifamily dwellings as a permitted use and set no lot coverage limit or front setback, so coverage is 1.0 (100%). Retail is allowed but not required; like Honolulu's B-2, no ground-floor retail is assumed (`commercial_coverage: 0`).
- **Height** isn't set in the config. It varies within a district by community plan area (see the table), so it comes from each parcel's `height`.
- **Unknown zones stop the run** (`unknown_zone: "error"`). A missing district gets noticed instead of quietly getting FAR 0.
- **Every zone sets `bicycle_required: false`**, because Maui has no bicycle parking minimum (MCC 19.36B).
- **Long-term occupancy:** apartment district dwellings must be occupied long-term, and transient vacation rentals there end 12/31/2028 in West Maui and 12/31/2030 elsewhere (MCC 19.12.010(C), 19.12.070). The model already assumes long-term rentals, so nothing changes.

### Left out

| District | Why |
| --- | --- |
| B-1 Neighborhood Business | No FAR or coverage limit (the envelope is height and setbacks only), and dwellings are allowed only above or below a business use (MCC 19.16.030) |
| B-CT Country Town Business | No FAR or coverage limit; follows community design guidelines; multifamily allowed except on Lānaʻi and Molokaʻi (MCC 19.15.020, 19.15.040) |
| SBR Service Business Residential | Single-family, duplex and mixed use only (MCC 19.11.020) |
| R, D | Single-family and duplex only |
| Wailuku Redevelopment Area districts | Their own height, yard and parking rules (MCC 19.39); not researched |

**Not modeled:** Maui's open-space incentive bonus (MCC 19.56). The engine's bonus formula is Honolulu's, so applying it to Maui would be wrong.

## Parking, loading and bicycle parking

Maui requires 2 stalls per dwelling unit under 3,000 sqft, whatever its size or bedroom count. Honolulu's minimum is by floor area instead, so the model now takes either form (see [Engine changes](#engine-changes)).

| Field (`rules.ts`) | Value | Reasoning | Source |
| --- | --- | --- | --- |
| `parking.residential_stalls_per_unit` | 2 | 2 stalls per unit under 3,000 sqft, regardless of bedrooms; tandem allowed. Larger units add 1 per extra 1,000 sqft, but the model's units are all under 1,300 sqft | MCC 19.36B.020 |
| `parking.retail_sqft_per_stall` | 500 | General merchandising, office and services: 1 per 500 sqft. The minimum of 3 isn't modeled; restaurants (1 per 100 sqft of dining) aren't a model use | MCC 19.36B.020 |
| `parking.joint_use` | 1 | The code has no joint-use reduction. The director may cut parking up to 50% case by case, which isn't modeled | MCC 19.36B.110(A) |
| Rounding | Half up | A fraction under ½ is dropped, ½ or more rounds up, as in Honolulu | MCC 19.36B.020 |
| `loading.min_lot_sqft` | 0 | No lot-size threshold; the requirement is by floor area | MCC 19.36B.030 |
| `loading.multifamily_spaces` | 0 | Dwelling floor area is excluded, so an all-residential building needs no loading space | MCC 19.36B.030 |
| `loading.retail_spaces` | 0 under 2,000 sqft; 1 to 10,000; 2 above | By non-dwelling floor area | MCC 19.36B.030 |
| `loading.small_space_sqft`, `large_space_sqft` | 8.5 × 19 ft; 12 × 35 ft | The code has small, medium and large sizes (small 2,000–5,000 sqft; medium 5,001–10,000; small + medium to 20,000; medium + large to 50,000; 2 large above). The model has small and large only, so medium isn't used | MCC 19.36B.030 |
| `bicycle.*` | All 0 | No bicycle minimum; these are never read, since every zone sets `bicycle_required: false`. Bicycle stalls may replace up to 2 required non-dwelling stalls (1 per 10 bike stalls) | MCC 19.36B.110(C) |

A proposed Council change (Resolution 25-152, discussed at the Molokaʻi Planning Commission on Jan 14, 2026) would base housing parking on bedrooms: 1 stall for a studio or one-bedroom, 2 for two or three bedrooms. Its status should be checked before submission.

## Workforce housing (MCC 2.96)

Every Maui project creating 10 or more dwelling units must provide workforce housing equal to 25% of its market-rate units, rounded up. It applies at building permit, so by-right projects are covered, and 201H projects too (MCC 2.96.030(E)). Honolulu has no such rule, so this is the biggest difference between the two counties in the model. The rule is current as amended by Ord. 5875 (October 2025).

| Rule | Maui (MCC 2.96) | In the model (`rules.inclusionary`) |
| --- | --- | --- |
| Threshold | 10 or more dwelling units (2.96.030(A)) | `min_units: 10` |
| Required units | 25% of market-rate units, rounded up; 20% if conveyed to a qualified housing provider and kept affordable in perpetuity (2.96.040(A)) | `share_of_market: 0.25` |
| Rental income mix | One-third each at 80% AMI or less, over 80–100%, over 100–120% (2.96.040(C)(2)) | `rent_ami: [80, 100, 120]`; each third rents at its band's cap and the three rents are averaged |
| Ownership income mix | 30% at 80–100% AMI, 50% at 100–120%, 20% at 120–140% (2.96.040(C)) | Not used; the model's units are rentals |
| Alternatives | In-lieu fee per unit (the price gap for a 3-bedroom single-family home between 100% and 160% AMI for a family of four, from HUD sales price guidelines), land, or credits (2.96.040(B)) | Not modeled |
| Exemptions | Wailuku Redevelopment Area; government and community land trust projects | Not modeled |

### How the count is worked out

The 25% is of the *market-rate* units, not of all units, so the required count W depends on itself. With N total units, W is the least whole number with W ≥ 0.25 × (N − W), which is W = ⌈0.25 × N / 1.25⌉ = ⌈N / 5⌉. That's about a fifth of all units. `requiredAffordableUnits` in `calc-shared.ts` computes it for any share (⌈s × N / (1 + s)⌉); the `- 1e-9` guards against floating-point error at exact multiples, such as 25 units giving exactly 5.

| Total units | Workforce | Market | Check: 25% of market |
| --- | --- | --- | --- |
| 9 | 0 | 9 | Under the threshold |
| 10 | 2 | 8 | 2 |
| 25 | 5 | 20 | 5 |
| 26 | 6 | 20 | 5 (5 would leave 21 market, needing 5.25, so 6) |
| 28 | 6 | 22 | 5.5, rounded up to 6 |
| 100 | 20 | 80 | 20 |

### How the rent is worked out

`inclusionaryRent` averages the rent at each AMI cap. For the default one-bedroom mix with the 2025 Maui table: $2,020 at 80%, $2,525 at 100% and $3,030 at 120%, so workforce units average $2,525 a month. The model's market rent defaults to the 120% AMI rent (the `market_ami` slider), so the top third of workforce units rents at market and only the 80% and 100% thirds cut income.

### Where it runs

In `calc-bill6.ts`, `afd_rent_units = requiredAffordableUnits(max_units, loc)` and the affordable rent is `inclusionaryRent` when the locality has a rule (otherwise the affordable AMI slider, as before). The workforce units then flow through the bill6 pro forma like Honolulu's affordable units, including the affordable fee toggle; see [Choices to revisit](#choices-to-revisit) for why that over-relieves them.

## Fees

Maui's code sets how most fees work but leaves the amounts to the annual budget, so they come from the FY 2027 County Appendix B ("App. B" below, with its page). Each row is a `FeeRules` field in `rules.ts`.

| Field | Maui value | Reasoning | Source |
| --- | --- | --- | --- |
| `building_permit` | Stepped valuation table (below), on each unit's construction value | Same structure as Honolulu's. "Or fraction thereof", so each step rounds up (the schedule's default rounding). Affordable housing under MCC 2.86 pays 50%; 100% workforce projects are exempt (handled by the fee toggle) | App. B p. 36 (MCC 16.25.109) |
| `plan_review` | 35% of the building permit fee | Building plan review. Fire plan review (17.5%, MCC 16.04E.060, App. B p. 20) is left out because Honolulu's config has none | App. B p. 50 (MCC 16.25.109.2.1) |
| `environmental.ea` | $1,895 | Planning Department review of a nonexempt environmental assessment (HRS 343) | App. B p. 31 |
| `environmental.eis` | $0 | App. B lists no separate EIS fee | App. B p. 31 |
| `temp_occupancy_cert` | $50 | Certificate of occupancy issuance | App. B p. 37 |
| `escp` | $0 | No separate erosion control plan fee; it's part of the grading permit | App. B p. 48 |
| `installation_trench`, `service_connection` | $0 | Maui charges trenching in County roads per permit ($250 plus $200 for up to 100 lineal feet, MCC 12.04.025), which a per-unit field can't express | App. B p. 48 |
| `grubbing` | $100 for the first acre, $50 for each further acre or fraction | By lot area; second band steps by 43,560 sqft | App. B p. 48 (MCC 12.04.025, 20.08.090) |
| `grading` | $60 per 100 cu yd up to 500; $300 + $25 per 100 to 10,000; $2,675 + $8 per 100 above | By excavation or fill volume, per 100 cu yd or fraction | App. B p. 48 (MCC 20.08.090) |
| `stockpiling` | $0 | No separate stockpiling permit; fill counts in the grading volume | App. B p. 48 |
| `wastewater` | $4.57 per gallon × 255 gpd | See [Wastewater](#wastewater) | App. B p. 11 (MCC 14.35) |
| `park_dedication.sqft_per_unit` | 500 | 500 sqft of park land per unit in excess of 3 (250 sqft for workforce units, not modeled), or a fee: that area × the average assessed land value per sqft of non-owner-occupied and apartment land in the community plan area, which the model takes as the parcel's land cost | MCC 18.16.320; App. B p. 30 |
| `park_dedication.exempt_units` | 3 | "In excess of 3" | MCC 18.16.320 |
| `park_dedication.floor_area_fraction` | 1 | Maui has no floor-area alternative; 1 means the per-unit area governs | MCC 18.16.320 |
| `park_dedication.application_fee` | $0 and $0 | App. B lists no park assessment application fee | App. B p. 30 |
| `school_impact_per_unit` | $0 | Set as for Honolulu; see [Choices to revisit](#choices-to-revisit) | HRS 302A |

### Building permit table

| Valuation | Fee | Model band |
| --- | --- | --- |
| $500 or less | $30 | flat |
| $501 to $2,000 | $30 + $3 per $100 over $500 | step 100 |
| $2,001 to $25,000 | $75 + $10 per $1,000 over $2,000 | step 1,000 |
| $25,001 to $50,000 | $305 + $9 per $1,000 over $25,000 | step 1,000 |
| $50,001 to $100,000 | $530 + $7 per $1,000 over $50,000 | step 1,000 |
| $100,001 to $500,000 | $880 + $5 per $1,000 over $100,000 | step 1,000 |
| $500,001 to $1,000,000 | $2,880 + $6 per $1,000 over $500,000 | step 1,000 |
| Over $1,000,000 | $5,880 + $10 per $1,000 over $1,000,000 | step 1,000 |

A $350,000 unit pays $880 + 250 × $5 = $2,130, plus $745.50 plan review. This is the same table as the 2018 schedule the rule sheet cites, now confirmed current in the FY 2027 appendix.

## Water

Since Jan 1, 2026 (Ord. 5759), Maui's Department of Water Supply (DWS) charges its water system development fee per equivalent single dwelling (ESD, 300 gallons a day), not per fixture unit as Honolulu's Board of Water Supply does. The model's `WaterRules` was built for fixture units, so Maui's values go into the same fields with the meanings below.

| Field | Maui value | Reasoning | Source |
| --- | --- | --- | --- |
| `wsfc_per_fu` | $5,491 at both heights | Per ESD: $3,541 source + $900 transmission + $1,050 storage. The rate doesn't change with height | DWS App. B p. 64 (MCC 14.07) |
| `demand_per_unit` | Studio 0.4, one-bed 0.5, two-bed 0.7, three-bed 0.9, four-bed 1.0 | ESDs per unit (table below), used by `mixFixtureUnits` in place of fixture units | DWS Water Use Calculation Method |
| `low_rise_max_stories` | 3 | Only names a threshold; both rates are equal | — |
| `min_fu` | 0 | No minimum charge | DWS App. B p. 64 |
| `waiver_unit_cap` | 0 | The appendix lists no affordable waiver, and MCC 14.07.080 allows only those "set forth in the annual budget" | DWS App. B; MCC 14.07.080 |
| `fire_meter_charge` | $1,250 for each size | Maui has no fixed connection charge: DWS bills meter installation at actual cost (with a $1,000 deposit for meters over 1 inch, pp. 57–60). The fixed one-time charge is the $1,250 building permit review fee for a non-single-family building, carried in this slot so it's counted | DWS App. B p. 64 |

### ESDs per unit

DWS's formula is ESD = (1.15 × baths^1.3 + beds + 3) / 10, rounded to 0.1 as in its table. The beds and baths are the model's for each unit type (`BATHS_BY_UNIT_TYPE`), with a studio as 0 bedrooms.

| Unit type | Beds | Baths | Raw ESD | ESD used | Fee per unit |
| --- | --- | --- | --- | --- | --- |
| Studio | 0 | 1 | 0.415 | 0.4 | $2,196 |
| One-bedroom | 1 | 1 | 0.515 | 0.5 | $2,746 |
| Two-bedroom | 2 | 1.5 | 0.695 | 0.7 | $3,844 |
| Three-bedroom | 3 | 2 | 0.883 | 0.9 | $4,942 |
| Four-bedroom | 4 | 2 | 0.983 | 1.0 | $5,491 |

The monthly water rates on DWS's Water Charges page ($5.09 per 1,000 gallons for multi-family) are operating costs, not development fees, so they aren't in this config.

## Wastewater

Maui charges a wastewater facility expansion assessment per gallon of a project's daily flow, in two service areas: Wailuku-Kahului $4.57 (MCC 14.35.060) and Kīhei $4.65 (MCC 14.34.060). Other areas have none (and parcels there would need a septic cost, not modeled). The model has one rate per county, so it uses Wailuku-Kahului, the central Maui system.

The fields are named for Honolulu's ESDU charge, so `charge_per_esdu` holds the $ per gallon and `esdu_per_unit` holds the gallons per day per unit. The code leaves residential flow to the Wastewater Reclamation Division's standards (MCC 14.35.030); those give 255 gpd for an apartment or condominium unit, whatever its size. That figure came from a search summary of the 2006 flow standards and should be confirmed with WWRD. A unit pays 255 × $4.57 = $1,165.35. 100% workforce housing projects are exempt, which the fee toggle covers.

## Property tax

A building of 5 or more dwellings that aren't vacation rentals is classed Apartment (MCC 3.48.305(B)(3)), taxed at $3.50 per $1,000 in FY 2027 (App. B p. 12), so `property_tax_rate: 0.0035`. The same rate appears in Tax Rate Resolution 26-69, which the rule sheet cites.

| Class (FY 2026–27, per $1,000) | Rate | Used |
| --- | --- | --- |
| Apartment | $3.50 | Yes |
| Long-term rental | $2.90 to $1.5M, $5.00 to $3M, $8.50 above | No: needs a long-term rental exemption and a tiered rate |
| Non-owner-occupied | $6.25 / $9.00 / $17.00 | No |
| TVR-STRH | $13 / $15 / $17 | No |
| Owner-occupied | $1.65 / $1.80 / $5.00 | No |

The general excise tax (4% state + 0.5% county surcharge since Jan 1, 2024, 4.5% total) is the same as Honolulu's and isn't modeled for either.

## Income limits and affordable rents

`income_limits` is HHFDC's 2025 Maui County schedule (median family income $110,900; Honolulu's is $129,300), by AMI % for household sizes 1–8. It has the same shape as Honolulu's table and matches the rule sheet's copy row for row.

| AMI | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10% | 9,430 | 10,770 | 12,120 | 13,460 | 14,540 | 15,620 | 16,700 | 17,770 |
| 20% | 18,860 | 21,540 | 24,240 | 26,920 | 29,080 | 31,240 | 33,400 | 35,540 |
| 30% | 28,290 | 32,310 | 36,360 | 40,380 | 43,620 | 46,860 | 50,100 | 53,310 |
| 40% | 37,720 | 43,080 | 48,480 | 53,840 | 58,160 | 62,480 | 66,800 | 71,080 |
| 50% | 47,150 | 53,850 | 60,600 | 67,300 | 72,700 | 78,100 | 83,500 | 88,850 |
| 60% | 56,580 | 64,620 | 72,720 | 80,760 | 87,240 | 93,720 | 100,200 | 106,620 |
| 70% | 66,010 | 75,390 | 84,840 | 94,220 | 101,780 | 109,340 | 116,900 | 124,390 |
| 80% | 75,440 | 86,160 | 96,960 | 107,680 | 116,320 | 124,960 | 133,600 | 142,160 |
| 90% | 84,870 | 96,930 | 109,080 | 121,140 | 130,860 | 140,580 | 150,300 | 159,930 |
| 100% | 94,300 | 107,700 | 121,200 | 134,600 | 145,400 | 156,200 | 167,000 | 177,700 |
| 110% | 103,730 | 118,470 | 133,320 | 148,060 | 159,940 | 171,820 | 183,700 | 195,470 |
| 120% | 113,160 | 129,240 | 145,440 | 161,520 | 174,480 | 187,440 | 200,400 | 213,240 |
| 130% | 122,590 | 140,010 | 157,560 | 174,980 | 189,020 | 203,060 | 217,100 | 231,010 |
| 140% | 132,020 | 150,780 | 169,680 | 188,440 | 203,560 | 218,680 | 233,800 | 248,780 |

Affordable rent is a statewide rule: 30% of income, utilities included (`state.affordable_rent_income_share`). `rentByAmi` averages the incomes of the household sizes for each unit type (studio 1; one-bedroom 1 and 2; two-bedroom 3; three-bedroom 4 and 5; four-bedroom 6) and floors the monthly result, as HHFDC does. With Maui's table that reproduces HHFDC's 2025 Maui rent table (monthly):

| AMI | Studio | 1 bedroom | 2 bedroom | 3 bedroom | 4 bedroom |
| --- | --- | --- | --- | --- | --- |
| 30% | 707 | 757 | 909 | 1,050 | 1,171 |
| 50% | 1,178 | 1,262 | 1,515 | 1,750 | 1,952 |
| 60% | 1,414 | 1,515 | 1,818 | 2,100 | 2,343 |
| 80% | 1,886 | 2,020 | 2,424 | 2,800 | 3,124 |
| 100% | 2,357 | 2,525 | 3,030 | 3,500 | 3,905 |
| 120% | 2,829 | 3,030 | 3,636 | 4,200 | 4,686 |
| 140% | 3,300 | 3,535 | 4,242 | 4,900 | 5,467 |

## Estimates

`assumptions.ts` holds the team's choices, not law. Only AMI and rent growth have a Maui source so far; everything else is Honolulu's figure, carried over so the model runs.

| Field | Value | Basis |
| --- | --- | --- |
| `market.ami_escalation` | 1.039 (3.9% a year) | HHFDC Maui 100% AMI for 4 people: $84,900 (2013) to $134,600 (2025), (134,600 / 84,900)^(1/12) = 1.039 |
| `market.annual_rent_growth` | 3.9% a year | Affordable caps track the income limits; Maui market rent growth not checked |
| `timing.permitting_months`, `construction_months` | 18 and 12 | Honolulu's; a slider setting overrides them |
| `market.cap_rate` | 5.1% | Honolulu's |
| `market.vacancy` | 7.4% residential, 12.6% retail | Honolulu's |
| `market.cost_inflation` | 1.056 (5.6% a year) | Honolulu's (RLB Honolulu construction cost escalation) |
| `market.annual_opex_growth`, `annual_assessment_growth` | 3.5% and 2% a year | Honolulu's |
| `market.parking` | 330 sqft and $190/sqft structured; 360 sqft and $30/sqft surface; $100 a month per stall | Honolulu's (Ulupono 2020, RLB Q2 2026) |
| `zones.*.excavation_depth_ft` | 3 ft (A-1, H-1: FAR 0.5 or less), 5 ft (A-2, H-M, H-2, Hotel, B-2: FAR 0.9–2.0), 9 ft (B-3: FAR 4.0) | Honolulu's depths for districts of like density |
| `default_zone` | 4 ft excavation | Honolulu's default |

Honolulu's AMI growth (4%) is measured on median family income, while Maui's (3.9%) is measured on the HHFDC 100% row the model actually uses for rents. Maui's median family income grew more slowly over the same years ($84,900 to $110,900, 2.25% a year).

## Engine changes

Six small changes let the engine read Maui's rules. Each is optional or a default that leaves Honolulu's results the same, and the v0.2.1 snapshots still match.

| Change | Where | Why Maui needs it | Why Honolulu is unchanged |
| --- | --- | --- | --- |
| `residential_stalls_per_unit` in `ParkingRules`, now one of it or `residential_sqft_per_stall`; `checkLocality` requires exactly one | `core/locality.ts`, `legalParkingRatio`, `core/check.ts` | Maui's minimum is per unit, not per sqft | Honolulu keeps `residential_sqft_per_stall: 1000` |
| `park_dedication.exempt_units` | `core/locality.ts`, `calcParkArea` | Maui exempts the first 3 units | Defaults to 0 |
| `calcFarBill6` and `lotCoverageBill6` take the lot size | `calc-shared.ts`, `calc-bill6.ts`, `parcels.ts` | Maui A-1's FAR drops from 0.5 to 0.4 at 3 acres; lot size 0 was always used before | Honolulu's current-zoning schedules are flat |
| `water.demand_per_unit`, used by `mixFixtureUnits` | `core/locality.ts`, `calc-shared.ts` | Maui charges per ESD by beds and baths, not per fixture unit | Unset for Honolulu, so fixture units are used as before |
| `article6Parking` follows the zone's `bicycle_required` in bill6 | `calc-shared.ts` | Maui requires no bicycle parking; its zeroed bicycle figures produced NaN | Every Honolulu zone with a bill6 FAR requires bicycle parking |
| `rules.inclusionary`, read by `requiredAffordableUnits` and `inclusionaryRent` in bill6; `checkLocality` checks the share, threshold and AMI levels | `core/locality.ts`, `calc-shared.ts`, `calc-bill6.ts`, `core/check.ts` | Maui requires workforce units in every project of 10+ units | Absent for Honolulu, so bill6 keeps 0 affordable units |

The template (`templates/locality/rules.ts`) now offers both forms of the housing parking minimum and an optional, commented-out inclusionary block for counties with a similar rule.

## The team's rule sheet, row by row

Every row of the team's Maui County Rule Sheet, with what the config does. "Matches" means the config has the same value; where it differs, the config's source is newer or primary.

| Rule sheet row | Rule sheet says | Config |
| --- | --- | --- |
| Zone list | A-1, A-2, B-1, B-2, B-3, B-CT, SBR; also R, D, H, M, P, Wailuku districts | A-1, A-2, H-1, H-M, H-2, Hotel, B-2, B-3. Hotel districts added (they allow apartment uses); B-1, B-CT, SBR left out (see [Zoning](#zoning)) |
| Density method | FAR, no units-per-area cap | Matches |
| FAR by zone | A-1 50%/40%, A-2 90%, B-2 200%, B-3 400% | Matches |
| Lot coverage | A-1 25%, A-2 35%, B none | Matches (B = 100%) |
| Height limit | By district and community plan area | From the parcel's `height` |
| Yards / step-backs | A: 15/20 front and rear, 10/15 side | Not modeled; in [Choices to revisit](#choices-to-revisit) |
| Minimum lot | A 10,000 sqft, B 6,000 sqft | Not modeled; in [Choices to revisit](#choices-to-revisit) |
| Multifamily permitted | A, B-2, B-3 yes; B-CT except Lānaʻi and Molokaʻi; B-1 above/below business only | Matches; B-1 and B-CT left out for lack of an FAR |
| Long-term occupancy | A-zone TVRs end 2028/2030 | No change needed; the model assumes long-term rentals |
| Design guidelines | B-CT and SBR follow community guidelines | Both left out |
| Dwelling stalls | 2 per unit under 3,000 sqft | Matches |
| Commercial stalls | 1 per 500 sqft (min. 3); restaurants 1 per 100 | 1 per 500 sqft; the minimum of 3 and restaurants not modeled |
| Rounding | Half up | Matches the engine |
| Reductions | Up to 50%, discretionary | Not modeled (an optional slider later) |
| Bicycle | No minimum | Matches (`bicycle_required: false`) |
| Loading spaces | By non-dwelling floor area, small/medium/large | Matches in count; medium size not a model size |
| State parking cap (HB 1919) | Pending, not law | Not modeled |
| Building permit fee | 2018 table, "verify: dated" | Same table, confirmed in FY 2027 App. B p. 36 |
| Plan review | 35%; fire 12.5% (search summary) | 35% (App. B p. 50). Fire review is 17.5% in FY 2027 (App. B p. 20), left out to match Honolulu |
| Water system development fee | FY 2026: $12,060 per 5/8-inch meter (search summary) | FY 2027: $5,491 per ESD (DWS App. B p. 64). DWS moved to per-ESD charging on Jan 1, 2026 |
| Wastewater assessment | $4.65 Kīhei, $4.57 Wailuku-Kahului | Matches; Wailuku-Kahului used, at 255 gpd per unit |
| Park dedication | 500 sqft per unit beyond the third, 250 for workforce units; fee at assessed land value | Matches; the 250 sqft workforce rate not modeled |
| School impact fee | $3,300–5,300 per unit (2019) | $0, as for Honolulu; in [Choices to revisit](#choices-to-revisit) |
| Workforce housing requirement | 10+ units, 25% of market units (20% if conveyed) | 25% modeled; 20% option not |
| Workforce income mix | Rental thirds at 80/100/120% | Matches; ownership mix not used |
| Workforce in-lieu fee | 3-bedroom price gap, 100% vs 160% AMI | Not modeled |
| 100% workforce fast track (MCC 2.97) | County-level 201H | Not modeled (current zoning only) |
| Income limits | HHFDC 2025 Maui | Matches row for row |
| Affordable rent rule | 30% of income | Matches; reproduces HHFDC's rent table |
| Property tax rate | Apartment $3.50 (search summary of Res. 26-69) | Matches, from App. B p. 12 and MCC 3.48.305 |
| General excise tax | 4.5% | Not modeled, as for Honolulu |
| 201H | Applies statewide | Not yet a Maui pathway |
| Bill 6, Bill 7, TOD, Waikīkī | Honolulu only | Matches: Maui runs current zoning only |
| Wailuku Redevelopment Area | Own districts; exempt from 2.96 | Not modeled |
| Timing, hard cost, rents, cap rate | Not researched | Honolulu's figures (see [Estimates](#estimates)) |
| Water availability, SMA, fire rebuild | Not covered | Not modeled |

## Tests

`test/maui-config.test.ts` checks the config against the code it comes from:

- **Zoning:** FAR and coverage for every district; A-1's 3-acre break; B-1 and B-CT stop the run; no zone requires bicycle parking.
- **Parking, loading and parks:** 2 stalls per unit for any mix; loading at the 2,000 and 10,000 sqft edges; park land of 500 sqft per unit over 3.
- **Income limits:** the 2025 table, with 100% AMI equal to twice the 50% row.
- **Fees:** the building permit table at each band edge and the $350,000 example; plan review; grading and grubbing steps; the Apartment tax rate.
- **Water and wastewater:** ESDs per unit; the $5,491 fee and $1,250 review fee; 255 gpd at $4.57.
- **Workforce housing:** the count table above; 0 for Honolulu; the rent average.
- **End to end:** the A-2 parcel (18,000 sqft, 28 units, 56 stalls, 6 workforce, every result a finite number) and TOD throwing.
- **Completeness:** `checkLocality(maui)` finds nothing missing.

## Sources

| Source | Used for | How it was read |
| --- | --- | --- |
| [Maui County Code, Municode](https://library.municode.com/hi/county_of_maui/codes/code_of_ordinances) (version of Sep 14, 2026) | Chapters 19.11, 19.12, 19.14, 19.15, 19.16, 19.18, 19.20 (zoning), 19.36B (parking and loading), 19.56 (open-space bonus), 18.16.320 (parks), 14.07 (water system development fees), 14.34 and 14.35 (wastewater assessments), 3.48.305 (tax classes), 12.04.025 and 20.08.090 (road and grading permits) | Code text, directly |
| [MCC 2.96 Residential workforce housing policy](https://library.municode.com/hi/county_of_maui/codes/code_of_ordinances?nodeId=TIT2ADPE_CH2.96REWOHOPO) (as amended by Ord. 5875, Oct 2025) | Applicability, 25% requirement, income mix, in-lieu fee | Code text, directly |
| [County of Maui FY 2027 Appendix B, Revenues - Fees, Rates, Assessments and Taxes](https://www.mauicounty.gov/DocumentCenter/View/159446/005---FY-2027-App-B-Rates-and-Fees_Clean-PDF) | Building permit (p. 36), certificate of occupancy (p. 37), plan review (p. 50), fire plan review (p. 20), EA (p. 31), park (p. 30), site work (p. 48), wastewater (p. 11), property tax (p. 12) | Full PDF, downloaded by the team |
| Department of Water Supply FY 2027 Appendix B, Water Fund - Water Rates and Fees (linked from [DWS Water Charges](https://www.mauicounty.gov/216/Water-Charges)) | Water system development fee and review fee (p. 64), meter installation (pp. 57–60) | Full PDF, downloaded by the team |
| [DWS Water Use Calculation Method](https://www.mauicounty.gov/2895/Water-Use-Calculation-Method) | ESD formula and per-dwelling ESDs (Ord. 5759) | Web page, directly |
| [County of Maui WWRD Wastewater Flow Standards](https://www.mauicounty.gov/DocumentCenter/View/6775/Wastewater-Flow-Standards) | 255 gpd per apartment unit | Search summary only; to be confirmed |
| [HHFDC 2025 Maui County income schedule](https://dbedt.hawaii.gov/hhfdc/files/2025/05/Maui-County-2025.pdf) | Income limits, affordable rents | PDF, directly |
| [HHFDC 2013 Maui County income schedule](https://files.hawaii.gov/dbedt/hhfdc/resources/2013Maui.pdf) | AMI growth since 2013 | PDF, directly |
| [Tax Rate Resolution 26-69 FD2](https://www.mauicounty.gov/DocumentCenter/View/161952/2026-Tax-Rate-Resolution-No-26-69-FD2-PDF) | Cross-check of tax rates by class | Via the rule sheet |
| [DOE school impact fee report (2019)](https://www.hawaiipublicschools.org/Reports/LEG19_School%20Impact%20Fees.pdf) | School impact fee range | Via the rule sheet |
| [Molokaʻi Planning Commission minutes, Jan 14, 2026](https://www.mauicounty.gov/AgendaCenter/ViewFile/Minutes/_01142026-546) | Resolution 25-152 (bedroom-based parking proposal) | PDF, directly |
| [Hawaiʻi Legislature, HB 1919 (2026)](https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=HB&billnumber=1919&year=2026) | State parking cap status | Via the rule sheet |
| The team's Maui County Rule Sheet (October 2026) | Checklist and cross-check for every rule | Internal working sheet |

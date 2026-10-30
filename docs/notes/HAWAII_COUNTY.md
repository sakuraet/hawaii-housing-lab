# County of Hawaiʻi config: notes, reasoning and sources

Hawaiʻi County is a registered county in the model: parcels with `locality: "hi-hawaii"` run the current-zoning pathway (`current`) end to end. This note explains every value in the county's config: what it is, where it came from, why it was fitted to the model the way it was, and what is left to decide. Each choice is also noted in a comment where it's made.

- **Where it lives:** `src/localities/hi/hawaii/` (`zones.ts` zoning, `rules.ts` law and fee schedules, `assumptions.ts` estimates, `index.ts` the `Locality`), tested in `test/hawaii-county-config.test.ts`.
- **Check:** a made-up RM-2 lot of 20,000 sqft at 45 ft gives 10 units (20,000 ÷ 2,000 sqft per unit), 6,250 sqft of floor area and 13 stalls (1.25 × 10, rounded up).
- **Status:** every rule comes from the County's own code or schedules. The market estimates are Honolulu's, as for Maui. Every value was cross-checked against the team's Hawaiʻi County Rule Sheet; see [the rule sheet, row by row](#the-teams-rule-sheet-row-by-row).

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
13. [Estimates](#estimates)
14. [Engine changes](#engine-changes)
15. [The team's rule sheet, row by row](#the-teams-rule-sheet-row-by-row)
16. [Tests](#tests)
17. [Sources](#sources)

## How the data was gathered

Values are trusted in this order, and each value below says which kind it is:

1. **Code text.** Hawaiʻi County's code isn't on Municode. The County publishes each chapter as a PDF on its [County Code page](https://hawaiicounty.gov/our-county/legislative/office-of-the-county-clerk/county-code), which blocks automated downloads, so the team downloaded these and they were read in full:
    - Chapter 25 Zoning, Supp. 20 (7-2026), with the County's unofficial advance sheet updated August 5, 2026;
    - Chapter 5 Construction Administrative Code: building permit and plan review fees;
    - Chapter 8 Dedication of Land: park dedication;
    - Chapter 10 Erosion and Sedimentation Control: grading, grubbing and stockpiling fees;
    - Chapter 11 Housing: affordable housing requirements;
    - Chapter 19 Real Property Taxes: tax classes;
    - Chapter 21 Sewers;
    - Chapter 23 Subdivisions;
    - the permitted uses table and the County GIS zoning definitions.
2. **Official tables:** the DWS rates brochure and HHFDC's 2013 and 2025 Hawaiʻi County income schedules, read directly.
3. **Official notices:** the FY 2026–27 property tax rates, from the published legal notice of Resolution 574-26.
4. **Honolulu's figures:** market estimates and timing, marked "Honolulu's", as for Maui.

**The team's rule sheet.** The team's Hawaiʻi County Rule Sheet (researched October 2026) was the checklist. Its zoning and parking came from an unofficial 2017 copy of Chapter 25 (Supp. 2), and its fees and tax rates from County documents and news reports. Each of its rows was checked against the current chapters:
- its income limits and affordable rents were compared cell by cell with the config: all 112 income limits and all 35 rents match;
- every other row is listed in [the rule sheet, row by row](#the-teams-rule-sheet-row-by-row) with what the config does.

## Locality settings

| Field (`index.ts`) | Value | Why |
| --- | --- | --- |
| `id` | `"hi-hawaii"` | State code and place, as `checkLocality` requires |
| export name | `hawaiiCounty` | `hawaii` is already the state's rules (`../state`) |
| `name` | County of Hawaiʻi | The official name |
| `state` | `hawaii` | Statewide rules: affordable rent at 30% of income, the 201H threshold |
| `pathways` | `["current"]` | Bill 6, Bill 7, TOD and Standard are Honolulu ordinances; 201H isn't modeled for the county yet |
| `unknown_zone` | `"error"` | A zone not in `zones.ts` stops the run, so a missing code is noticed |
| `inclusionary` | not set | HCC Chapter 11 applies to rezonings only (see [Income limits](#income-limits-and-affordable-rents)) |

## Choices to revisit

These are judgment calls with a realistic alternative. The ones most likely to move results come first.

| Choice | Current value | Alternative | Why it matters |
| --- | --- | --- | --- |
| Market estimates (cap rate, vacancy, cost escalation, opex and assessment growth, parking costs, timing) | Honolulu's figures | Hawaiʻi County sources (Hilo and Kona may differ) | These drive land value directly |
| Engine defaults: hard cost, land cost, sale prices | $450/sqft hard cost, $130/sqft land, Honolulu HHFDC sale tables | County figures (shipping and labor likely raise hard cost) | They live in the engine, so the county inherits Honolulu's |
| Property tax class | Apartment, $11.70/$1,000 | Long-Term Rental, $7.75 | Long-Term Rental excludes property "used for commercial or income-producing purposes" (19-53(k)(4)), so whether a rental apartment building qualifies is unclear; it would cut the tax by a third |
| Lot coverage in RM, RCX and V | 80% | Coverage of buildings only, with parking counted separately | The code has no coverage cap; it requires 20% landscaping that can't include parking, so 80% is an upper bound for buildings and parking together |
| Side yard by story | Taken at the most stories the height allows | The stories actually built | A building shorter than the limit gets a narrower side yard than modeled, so floor area is slightly understated |
| Park dedication exemptions | 457.8 sqft per unit everywhere | $150 per unit for 6 or fewer units (8-7(c)); none in districts already above 5 acres of park per 1,000 residents (8-4(a)(1)) | The district exemption could remove the park cost in some districts; which ones qualify isn't known |
| Sewer | No one-time charge (Ch. 21 has none); lateral not modeled | The lateral at the County's cost; septic off the County system | Much of the island has no County sewer |
| Water facilities charge | $6,095 per unit at every size | The larger of that and the meter-size charge | Smaller projects on large meters are undercharged |
| CDH parking | 1 stall per unit | 1.25 per unit for a project less dense than 1,000 sqft per unit | Only a project well below CDH's density would differ |
| Excavation depth | 4 ft everywhere (Honolulu's default) | Depth by density | Honolulu's depths are by FAR, which these districts don't have |
| AMI growth | 4.7% a year (2013 to 2025) | A shorter base period | HHFDC's 2013 and 2025 100% rows may be defined differently (see [Estimates](#estimates)) |
| Income limits year | HHFDC 2025 (median $98,800) | HHFDC 2026 (median $98,300) | 2025 matches Honolulu and Maui; move all three together |
| State parking cap (HB 1919, 2026) | Not modeled | 0.5 stalls per unit from 7/1/2027, as an optional state rule | Passed the House 58–1; no sign it became law |

## Modeling assumptions

How the code's rules were read where the model needed a single number. Each is in a comment in the code.

- **Units are the lot area over the land per unit, rounded down.** A fraction of a unit isn't allowed.
- **No FAR.** None of these districts sets one, so `far` is Infinity and the building fills the height, coverage and yard envelope up to the unit cap. Only the floor area those units need is built.
- **Coverage from landscaping.** RM, RCX and V must landscape 20% of the site, not counting parking (25-5-37), so 80% is used as the lot coverage. The commercial districts landscape only their front yards (25-5-107), so they take 100%.
- **Side yard at the full height.** RM, RCX and V side yards grow 2 ft per story, taken at the most stories the height allows.
- **CDH parking at 1 per unit.** The code's 1 per unit applies to projects denser than 1,000 sqft per unit, which CDH's 500 sqft density is.
- **Loading space size.** Both model sizes are 12 × 50 ft: a single space in a building over 5,000 sqft is that size (25-4-58(b)), and any building needing a space is that large.
- **Grading table as written.** The code's bases ($25 at 1,001 cu yd, $41 at 10,001) are used, though the steps below them reach $23 and $43.
- **Grubbing and stockpiling first steps.** "$5 for grubbing in excess of one acre, plus $2 for each additional five acres" is read as $5 for up to 5 acres beyond the first, then $2 per step; stockpiling the same way with 500 and 1,000 cu yd.
- **Park fee in lieu at land cost.** The fee is the land's fair market value (8-8), taken as the parcel's land cost.
- **Water per unit.** $6,095 per dwelling unit at every project size, rather than the larger of that and the meter-size charge.
- **Apartment tax class.** Land is classed by highest and best use with zoning given major weight (19-53(e)(2)).
- **Building permit by unit.** As for Honolulu and Maui, the fee table is applied to each unit's construction value, using the model's hard cost rather than the County's ICC valuation data (5-7-3(c)).

## Known limitations

Places where the model is approximate:

- Hard cost ($450/sqft), land cost ($130/sqft) and HHFDC sale prices are Honolulu engine defaults, and the market estimates are Honolulu's; only AMI and rent growth are the county's own.
- The 80% coverage counts buildings and parking together, while the landscaping rule only keeps parking out of the landscaped area.
- Side yards are taken at the full height, so shorter buildings are given slightly less floor area than they could have.
- Height comes from each parcel's `height`, so the parcel data must carry the right limit:
    - 45 ft in most districts;
    - 120 ft in the City of Hilo (RM, V, CG) and in CDH;
    - 90 ft for V at Keauhou and Kahaluʻu Bays;
    - 40 ft in CN and 30 ft in CV.
- Parking exemptions (25-4-59.2) are carried only by the parcel's `parking_exempt`: dwellings at 1,000 sqft per unit or denser in the downtown Hilo core, the Kainaliu frontage and the DPC district.
- The zone codes come from the County GIS list (rev. April 22, 2020). A code in the parcel data that isn't on it stops the run and needs adding.
- Several loading spaces are slightly overstated, since half may be 10 × 22 ft.

## Not modeled

| Rule or cost | Source | Why not |
| --- | --- | --- |
| Minimum building site (7,500 sqft; V 15,000; commercial: the district number × 1,000) and average width (60 ft; V 90 ft) | HCC 25-5-34, 25-5-35 and matching sections | No lot-size check in the engine, as for Maui |
| Side yards next to a residential district in CN, CG, CV | HCC 25-5-106, 25-5-116, 25-5-126 | The parcel data has no neighboring zone |
| 15 ft separation between main buildings | HCC 25-5-38(b) | The model builds one building |
| Planned unit developments | HCC 25-5-38(d), Art. 6 | Discretionary (Planning Commission) |
| MCX housing | HCC 25-5-132(b) | Needs a use permit |
| RCX commercial units counting against density | HCC 25-5-41(a) | No commercial is modeled in RCX |
| Bicycle stall credit (5 bike stalls replace 1 car stall) and 33% compact stalls | HCC 25-4-52(c), (d) | Optional for the developer; would lower parking cost slightly |
| Shared parking for uses at different times | HCC 25-4-51(c) | Discretionary |
| Park dedication: $150 per unit for 6 or fewer units; district exemption | HCC 8-7(c), 8-4(a)(1) | Small projects only; no district park data |
| Sewer lateral at the County's cost; septic outside the County system; monthly sewer charges ($52 per unit; Bill 183 would raise them to $125 by 2031) | HCC 21-23, 21-36.1 | Not per-unit one-time charges; monthly charges sit in the opex ratio |
| Water meter installation for meters over 2 inches; the first 5/8-inch connection's $1,319 | DWS brochure, sections F, G | Not listed in the brochure / minor |
| Plan review resubmittal fees, extra inspection fees, electrical and plumbing permits | HCC 5-7-1(b), 5-7-5, Ch. 5D, 5F | Not in the model for any county |
| School impact fee in the West Hawaiʻi district (about $1,796 per multifamily unit plus land, 2010) | HRS 302A | Reported as not collected; $0 as for Honolulu and Maui |
| Affordable housing on rezoned parcels (20% for 5+ units) | HCC 11-4 | By-right projects only |
| Long-Term Rental and Affordable Rental Housing tax classes | HCC 19-53(h), (k) | See [Property tax](#property-tax) |
| General excise tax (4% state + 0.5% county = 4.5%) | HRS 237 | Not modeled for any county |
| State parking cap (HB 1919) | 2026 session | Not law |
| 201H and other programs | HRS 201H | Current zoning only for now |
| Lava hazard zones 1–2 (insurance and lending), shoreline SMA permits, DWS water availability | USGS hazard map; HRS 205A; DWS | No parcel data for them yet; water availability is a yes/no gate |

## Zoning

Hawaiʻi County limits density by land area per unit, not FAR, so every zone uses `current.lot_area_per_unit` and none sets `far`.

| District | Density (land per unit) | Coverage in the model | Yards (ft) | Height | Min. site | Sections |
| --- | --- | --- | --- | --- | --- | --- |
| RM Multiple-Family Residential | Designation × 1,000 sqft (RM-2 = 2,000) | 80% | Front 20, rear 20, side 8 + 2 per added story | 45 ft; 120 in Hilo | 7,500 sqft, 60 ft wide | HCC 25-5-30 to 25-5-38 |
| RCX Residential-Commercial Mixed Use | Designation × 1,000 sqft (dwelling or commercial unit) | 80% | Same as RM | 45 ft | 7,500 sqft, 60 ft wide | HCC 25-5-40 to 25-5-49 |
| V Resort-Hotel | Designation × 1,000 sqft | 80% | Same as RM | 45 ft; 120 in Hilo; 90 at Keauhou and Kahaluʻu Bays | 15,000 sqft, 90 ft wide | HCC 25-5-90 to 25-5-98 |
| CN Neighborhood Commercial | 1,250 sqft | 100% | Front 15, rear 15, side 0 | 40 ft | District no. × 1,000 sqft (at least 7,500), 60 ft wide | HCC 25-5-100 to 25-5-108 |
| CG General Commercial | 1,250 sqft | 100% | Front 15, rear 15, side 0 | 45 ft; 120 in Hilo | District no. × 1,000 sqft (at least 7,500), 60 ft wide | HCC 25-5-110 to 25-5-118 |
| CV Village Commercial | 1,250 sqft | 100% | Front 15, rear 15, side 0 | 30 ft | District no. × 1,000 sqft (at least 7,500), 60 ft wide | HCC 25-5-120 to 25-5-128 |
| CDH Downtown Hilo Commercial | 500 sqft | 100% | None (set at plan approval) | 120 ft | 7,500 sqft, 60 ft wide | HCC 25-7-20 to 25-7-27 |

Only density, coverage and yards are in the config (`current` in `zones.ts`). Height comes from the parcel, and the minimum site isn't checked.

### Why it's set up this way

- **Zone codes carry a number.** An RM, RCX or V code's number is the land area per unit in thousands of sqft (25-5-31(a)). A CN, CG or CV code's number is the minimum building site in thousands of sqft (25-5-101), and their density is a flat 1,250 sqft per unit (25-5-102(a)(14) and the matching CG and CV sections). The engine looks zones up by exact code, so `zones.ts` builds one entry per code on the County GIS zoning definitions list (rev. April 22, 2020; the March 2017 copy has the same codes):
    - RM: .75, 1, 1.25, 1.5, 2, 2.5, 3, 3.5, 4, 5, 5.5, 6, 7, 8, 10, 14.5, 15, 20
    - RCX: 2, 10, 20
    - V: .75, 1, 1.0, 1.25, 1.5, 1.75, 2, 2.0, 2.25, 4, 6.0, 7, 25
    - CN: 7.5, 10, 20, 40; CG: 7.5, 10, 20; CV: 7.5, 10, 15, 20; and CDH

  RM-1.25 and RM-14.5 aren't among 25-5-31(d)'s steps but are on the map. Codes are written as the list writes them ("RM-.75", "V-1.0").
- **Densest designation.** RM and RCX go down to .75 (750 sqft per unit) in steps of .75, 1, 1.5, 2, 2.5, 3, 3.5, 4 and then 0.5 (25-5-31(c), (d)); V recommends 0.25 steps (25-5-91(d)). In dormitories, two beds count as one unit, which doesn't apply to the model's apartments.
- **Ground-floor retail.** RCX allows commercial uses, but no floor may hold both dwellings and commercial (25-5-48(b)), so no retail goes under housing (`commercial_coverage: 0`). CN, CG, CV and CDH permit commercial uses throughout (`commercial_coverage: 1`); none is required, and the model's default has no retail.
- **Bicycle parking** isn't required in any district (`bicycle_required: false`).

### Left out

| District | Why |
| --- | --- |
| MCX Industrial-Commercial Mixed Use | Multiple-family dwellings need a use permit (25-5-132(b)), so they aren't by right |
| Bare V, CV and MCX codes | No number on the GIS list, so no density |
| RS, RD, RA, A and other districts | Single-family, duplex or agricultural |

## Parking, loading and bicycle parking

| Field (`rules.ts`) | Value | Reasoning | Source |
| --- | --- | --- | --- |
| `parking.residential_stalls_per_unit` | 1.25 | Multiple-family dwellings, whatever the unit size | HCC 25-4-51(a)(6) |
| CDH `current.residential_stalls_per_unit` | 1 | 1 per unit for a property denser than 1,000 sqft of land per unit | HCC 25-4-51(a)(6), 25-7-27(b) |
| `parking.round_up` | true | Any fraction is the next whole number, unlike Honolulu's half-up | HCC 25-4-52(a) |
| `parking.retail_sqft_per_stall` | 300 | Commercial uses, including retail and office | HCC 25-4-51(a)(4) |
| `parking.joint_use` | 1 | Stalls may be shared only by uses at different times; not modeled | HCC 25-4-51(c) |
| `loading.multifamily_spaces` | 0 under 20 units; 1 to 150; 2 to 300; +1 per 200 or major fraction | The code's table prints garbled in the PDF; its rows were matched up by hand | HCC 25-4-56 |
| `loading.retail_spaces` | 0 under 5,000 sqft; 1 to 10,000; 2, 3 and 4 to 40,000; 5 to 60,000; +1 per 50,000 or major fraction | Same table, commercial rows | HCC 25-4-56 |
| `loading.min_lot_sqft` | 0 | The threshold is buildings of 5,000 sqft or more, which the schedules already cover | HCC 25-4-56 |
| `loading.small_space_sqft`, `large_space_sqft` | 12 × 50 ft each | See [Modeling assumptions](#modeling-assumptions) | HCC 25-4-58 |
| `bicycle.*` | All 0 | No bicycle minimum | HCC 25-4-52(c) |

**Exemptions (25-4-59.2):** no parking is required for:
- dwellings at 1,000 sqft per unit or denser in the downtown Hilo core, bounded by Kinoʻole Street, Ponahawai Street, Hilo Bay and the Wailuku River;
- the Kainaliu frontage of the Belt Highway;
- property wholly in the DPC district (added by Ord. 26-57, 2026).

The parcel's `parking_exempt` carries these.

## Fees

Fee amounts are set in the code itself, not in an annual budget appendix as in Maui. Each row is a `FeeRules` field in `rules.ts`.

| Field | Hawaiʻi County value | Reasoning | Source |
| --- | --- | --- | --- |
| `building_permit` | Stepped valuation table (below), on each unit's construction value | "Or fraction thereof", so each step rounds up. No affordable-housing exemption: only Habitat for Humanity and the Community College's model home are exempt (5-7-3(h)) | HCC 5-7-3(b) |
| `plan_review` | 20% of the permit fee, at least $50 | Resubmittals after the second cost $250, $500, then $1,000 each (5-7-1(b)); not modeled | HCC 5-7-1(a) |
| `environmental` | $0 and $0 | No County EA review fee found; Chapter 25's filing fees are for variances ($250), use permits ($500) and other discretionary actions | HCC 25-2-52, 25-2-62 |
| `temp_occupancy_cert` | $200 | On issuing a temporary certificate of occupancy | HCC 5-7-6 |
| `escp` | $0 | No separate erosion control plan fee; it's part of the grading permit | HCC Ch. 10 |
| `installation_trench`, `service_connection` | $0 | The sewer lateral is billed at the County's cost against a deposit (21-23), and the permit to connect is free (21-25(c)) | HCC 21-23, 21-25 |
| `grading` | $5 to 100 cu yd; $5 + $2 per 100 to 1,000; $25 + $2 per 1,000 to 10,000; $41 + $2 per 1,000 above | By the volume of excavation or fill | HCC 10-11(a) |
| `grubbing` | $0 to 1 acre; $5 to 6 acres; +$2 per further 5 acres | See [Modeling assumptions](#modeling-assumptions) | HCC 10-11(b) |
| `stockpiling` | $0 to 500 cu yd; $5 to 1,500; +$2 per further 1,000 | Same reading | HCC 10-11(c) |
| `wastewater` | $0 | No one-time County sewer charge; monthly charges (21-36.1) are operating costs | HCC 21-25(c) |
| `park_dedication.sqft_per_unit` | 457.8 | 2.1 persons per multiple-family unit (8-6(b)(2)) × 218 sqft of park per person, or 5 acres per 1,000 (8-7(a)(3)). It applies at building permit to a building of 2 or more units (8-2(a)(1), (11)) | HCC 8-2, 8-6, 8-7 |
| `park_dedication` other fields | No exempt units, no floor-area alternative, no application fee | The fee in lieu is the land's fair market value (8-8) | HCC 8-8 |
| `school_impact_per_unit` | $0 | The West Hawaiʻi district was set up in 2010 but is reported as not collecting | HRS 302A |

### Building permit table

| Valuation | Fee | Model band |
| --- | --- | --- |
| $500 or less | $10 | flat |
| $501 to $2,000 | $10 + $1.50 per $100 over $500 | step 100 |
| $2,001 to $25,000 | $32.50 + $7.50 per $1,000 over $2,000 | step 1,000 |
| $25,001 to $50,000 | $205 + $6 per $1,000 over $25,000 | step 1,000 |
| Over $50,000 | $355 + $3 per $1,000 over $50,000 | step 1,000 |

A $350,000 unit pays $355 + 300 × $3 = $1,255, plus $251 plan review: well under Maui's $2,130 + $745.50.

## Water

The Department of Water Supply charges its facilities charge per dwelling unit, not per fixture unit, so the model's `demand_per_unit` is 1 for every unit type.

| Field | Value | Reasoning | Source |
| --- | --- | --- | --- |
| `wsfc_per_fu` | $6,095 at both heights | Per lot, dwelling unit or equivalent unit, or the meter-size charge if larger | DWS rates brochure, eff. July 1, 2025, section G |
| `demand_per_unit` | 1 for every unit type | One charge per dwelling, whatever its size | Same |
| `low_rise_max_stories` | 3 | Only names a threshold; both rates are equal | — |
| `min_fu`, `waiver_unit_cap` | 0, 0 | No minimum and no affordable waiver in the brochure | Same |
| `fire_meter_charge` | $0 | The brochure lists service lateral installation for meters of 2 inches or less only | Same, section F |

The per-unit charge is the larger above 16 units on a 4-inch meter ($97,518), 25 on a 6-inch ($152,372) and 50 on an 8-inch ($304,744). The brochure is still current: it lists power cost charges through October 1, 2026, with no newer facilities charge.

## Property tax

FY 2026–27 rates (Resolution 574-26, adopted May 21, 2026), per $1,000, buildings and land alike:

| Class | Rate | Used |
| --- | --- | --- |
| Apartment | $11.70 | Yes (`property_tax_rate: 0.0117`) |
| Long-Term Rental (new for FY 2026–27) | $7.75 | No: it excludes property "used for commercial or income-producing purposes" (19-53(k)(4)), so a rental apartment building may not qualify |
| Affordable Rental Housing | $5.75 (FY 2025–26: $5.95) | No: every unit must rent at affordable rates (19-53(h)(1)) |
| Residential | $11.10 / $14.50 / $17.00 | No |
| Homeowner | $5.75 | No |
| Commercial, Industrial | $10.70 | No |
| Hotel and Resort, Conservation | $11.55 | No |
| Agricultural or Native Forests | $9.35 | No |

Land is classed by highest and best use, with zoning given major weight (19-53(e)(2)), so an apartment building on RM or commercial land is in the Apartment class. The Apartment rate is unchanged from FY 2025–26. It's more than three times Maui's ($3.50), which weighs on residual land value.

## Income limits and affordable rents

`income_limits` is HHFDC's 2025 Hawaiʻi County schedule (median family income $98,800; Honolulu $129,300, Maui $110,900). HHFDC's 2026 table (median $98,300) is out, but 2025 is used to match Honolulu and Maui.

| AMI | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10% | 8,470 | 9,680 | 10,890 | 12,090 | 13,060 | 14,030 | 15,000 | 15,960 |
| 20% | 16,940 | 19,360 | 21,780 | 24,180 | 26,120 | 28,060 | 30,000 | 31,920 |
| 30% | 25,410 | 29,040 | 32,670 | 36,270 | 39,180 | 42,090 | 45,000 | 47,880 |
| 40% | 33,880 | 38,720 | 43,560 | 48,360 | 52,240 | 56,120 | 60,000 | 63,840 |
| 50% | 42,350 | 48,400 | 54,450 | 60,450 | 65,300 | 70,150 | 75,000 | 79,800 |
| 60% | 50,820 | 58,080 | 65,340 | 72,540 | 78,360 | 84,180 | 90,000 | 95,760 |
| 70% | 59,290 | 67,760 | 76,230 | 84,630 | 91,420 | 98,210 | 105,000 | 111,720 |
| 80% | 67,760 | 77,440 | 87,120 | 96,720 | 104,480 | 112,240 | 120,000 | 127,680 |
| 90% | 76,230 | 87,120 | 98,010 | 108,810 | 117,540 | 126,270 | 135,000 | 143,640 |
| 100% | 84,700 | 96,800 | 108,900 | 120,900 | 130,600 | 140,300 | 150,000 | 159,600 |
| 110% | 93,170 | 106,480 | 119,790 | 132,990 | 143,660 | 154,330 | 165,000 | 175,560 |
| 120% | 101,640 | 116,160 | 130,680 | 145,080 | 156,720 | 168,360 | 180,000 | 191,520 |
| 130% | 110,110 | 125,840 | 141,570 | 157,170 | 169,780 | 182,390 | 195,000 | 207,480 |
| 140% | 118,580 | 135,520 | 152,460 | 169,260 | 182,840 | 196,420 | 210,000 | 223,440 |

Affordable rent is a statewide rule: 30% of income, utilities included. `rentByAmi` averages the incomes of the household sizes for each unit type (studio 1; one-bedroom 1 and 2; two-bedroom 3; three-bedroom 4 and 5; four-bedroom 6) and floors the monthly result. It reproduces HHFDC's 2025 Hawaiʻi County rent table exactly:

| AMI | Studio | 1 bedroom | 2 bedroom | 3 bedroom | 4 bedroom |
| --- | --- | --- | --- | --- | --- |
| 30% | 635 | 680 | 816 | 943 | 1,052 |
| 50% | 1,058 | 1,134 | 1,361 | 1,571 | 1,753 |
| 60% | 1,270 | 1,361 | 1,633 | 1,886 | 2,104 |
| 80% | 1,694 | 1,815 | 2,178 | 2,515 | 2,806 |
| 100% | 2,117 | 2,268 | 2,722 | 3,143 | 3,507 |
| 120% | 2,541 | 2,722 | 3,267 | 3,772 | 4,209 |
| 140% | 2,964 | 3,176 | 3,811 | 4,401 | 4,910 |

These limits aren't for tax-credit (LIHTC) projects, which use HHFDC's separate MTSP chart.

No required affordable set-aside is modeled. HCC Chapter 11 requires affordable housing credits equal to 20% of units for projects of 5 or more, but only on new rezonings and on prior rezonings with affordable housing conditions (11-4(a), (b)), not on by-right projects.

## Estimates

`assumptions.ts` holds the team's choices, not law. The rule sheet left all of these as "your data"; only AMI and rent growth have a county source so far.

| Field | Value | Basis |
| --- | --- | --- |
| `market.ami_escalation` | 1.047 (4.7% a year) | HHFDC Hawaiʻi County 100% AMI for 4 people: $69,800 (2013) to $120,900 (2025) |
| `market.annual_rent_growth` | 4.7% a year | Affordable caps track the income limits; market rent growth not checked |
| `timing` | 18 and 12 months | Honolulu's; the rule sheet expects permitting to be longer here |
| `market.cap_rate`, `vacancy` | 5.1%; 7.4% residential, 12.6% retail | Honolulu's |
| `market.cost_inflation` | 1.056 | Honolulu's (RLB Honolulu) |
| `market.annual_opex_growth`, `annual_assessment_growth` | 3.5%, 2% | Honolulu's |
| `market.parking` | 330 sqft and $190/sqft structured; 360 sqft and $30/sqft surface; $100 a month per stall | Honolulu's (Ulupono 2020, RLB Q2 2026) |
| `default_zone.excavation_depth_ft` | 4 ft for every zone | Honolulu's default; its depths by FAR don't map onto districts set by land per unit |
| Lease-up (engine default, `leaseup_months`) | 9 months | Honolulu's; the rule sheet flags Honolulu-style absorption as probably too fast here |

AMI growth here (4.7%) is higher than Maui's (3.9%). HHFDC's 2025 100% row ($120,900 for 4) is well above the county's $98,800 median, because it's twice HUD's very low income limit, which HUD raises where housing costs are high. If the 2013 row was set closer to the median, part of the 4.7% is that adjustment rather than income growth. This hasn't been checked, and the same question applies to Maui.

## Engine changes

Three small changes let the engine read Hawaiʻi County's rules. Each is optional, so Honolulu and Maui are unchanged and the v0.2.1 snapshots still match.

| Change | Where | Why Hawaiʻi County needs it | Why the others are unchanged |
| --- | --- | --- | --- |
| `current.yards` (front, rear, side, side added per story), used by `floorPlates` in place of the uniform setback | `core/locality.ts`, `core/zoning.ts`, `calc-shared.ts`, `calc-bill6.ts` | RM yards are 20 / 20 / 8 + 2 per story, not the model's 10 ft all round | Without yards the setback lever applies, 10 ft by default. The `current` pathway no longer sets the lever, so a zone's yards apply unless a caller sets it |
| `parking.round_up` | `core/locality.ts`, `podiumEnvelope` | A fraction of a stall always rounds up (25-4-52(a)) | Unset, so 0.5 or more rounds up as before |
| `current.residential_stalls_per_unit`, a zone's own parking minimum | `core/locality.ts`, `core/zoning.ts`, `calc-bill6.ts` | CDH needs 1 stall per unit where the county needs 1.25 | Unset elsewhere |

Density by lot area per unit (`current.lot_area_per_unit`) was added with the generic current-zoning pathway, before this config.

## The team's rule sheet, row by row

Every row of the team's Hawaiʻi County Rule Sheet against the config. **Same** means the config uses the sheet's value. **Confirmed** means a value the sheet marked dated, secondary or pending is now confirmed against the current code. **Updated** means the current code differs from the sheet, or fills a gap it left. **Not modeled** means the rule is recorded but left out, with the reason.

| Rule sheet row | Rule sheet says | Config | Result |
| --- | --- | --- | --- |
| Zone list | RS, RD, RM, RCX, RA, FA, A, IA, V, CN, CG, CV, MCX, ML, MG, O; CDH and others | RM, RCX, V, CN, CG, CV and CDH, every numbered code on the GIS list | Same (housing districts only) |
| Density method | Land area per unit, not FAR | `lot_area_per_unit`, no FAR | Same |
| Densest designation | .75, steps of 0.5 (RM, RCX); V steps of 0.25 | Same (25-5-31(c)(d), 25-5-91(c)(d)) | Same |
| Multifamily in commercial zones | CN, CG, CV at 1,250 sqft; CDH 500; MCX unclear | Same; MCX needs a use permit (25-5-132(b)) | Updated (MCX) |
| Height limit | RM, V, CG 45 / 120 in Hilo; CN 40; CV 30; MCX 45; CDH 120; a V exception not captured | Same; the V exception is Keauhou and Kahaluʻu Bays at 90 ft (25-5-93(c)). From the parcel | Updated (V exception) |
| Minimum building site | 7,500; V 15,000; MCX 20,000; commercial: district number × 1,000 | Same | Not modeled |
| Minimum average width | 60 ft; V and MCX 90 ft | Same | Not modeled |
| Yards | RM, RCX, V 20 / 20 / 8 + 2 per story; commercial 15 / 15 / 0; MCX front 20; CDH none | Same; modeled with `yards` | Same |
| Lot coverage cap | None | No cap; 80% from the landscaping rule (RM, RCX, V), 100% elsewhere | Same |
| Landscaping minimum | 20% of site, parking excluded; commercial front yards | Same (25-5-37, 25-5-107) | Same |
| Building separation | 15 ft | — | Not modeled |
| Ground-floor commercial | RCX: no floor mixes dwellings and commercial | `commercial_coverage: 0` in RCX | Same |
| PUD exceptions | Commission may relax height, site, yards | — | Not modeled |
| Multifamily stalls | 1.25 per unit; CDH 1 | Same | Same |
| Commercial stalls | 1 per 300 sqft | Same | Same |
| Rounding and credits | Round up; 5 bike stalls replace 1 car stall; 33% compact | Round up modeled | Same (credits not modeled) |
| Exemptions | Downtown Hilo core | Same, plus the Kainaliu frontage and the DPC district (Ord. 26-57, 2026) | Updated |
| Bicycle requirement | None | Same | Same |
| Loading spaces | 20–150 units: 1; 151–300: 2; +1 per 200; table garbled | Same, confirmed in Supp. 20; commercial rows added | Confirmed |
| State parking cap (HB 1919) | Pending | — | Not modeled |
| Building permit fee | Not found | HCC 5-7-3(b): $355 + $3 per $1,000 above $50,000 | Updated |
| Plan review / resubmittal | 20% of the permit fee, $50 minimum (2021); resubmittals rise | Same, confirmed in 5-7-1 (Ord. 20-61) | Confirmed |
| Water facilities charge | $6,095 per unit, or the meter-size charge if larger (eff. 7/1/2025) | Same; the brochure is still current | Confirmed |
| Sewer connection | Not found; monthly $52 per unit; Bill 183 to $125 by 2031 | None: the permit to connect is free (21-25(c)); the lateral is at cost; monthly $52 confirmed in 21-36.1 | Updated |
| Park dedication | 458 sqft per multifamily unit (secondary) | 2.1 × 218 = 457.8, confirmed in Ch. 8 | Confirmed |
| School impact fee | West Hawaiʻi ~$1,796 per unit, not collected | $0 | Same (default to 0) |
| Grading, grubbing, stockpiling | Not researched | HCC 10-11 | Updated |
| Inclusionary requirement | Ch. 11, rezonings only; a 20% rewrite for 5+ units due early 2026 | Confirmed: 20% for 5+ units, rezonings only (11-4); none for by-right | Confirmed |
| Income limits | HHFDC 2025, median $98,800 | Same, all 112 values | Same |
| Affordable rent rule | 30% of income; reproduces HHFDC rents | Same, all 35 rents | Same |
| Property tax | FY27 Apartment $11.70, Long-Term Rental $7.75, Affordable $5.75 | Same; Apartment used, per the class rules in 19-53 | Same |
| General excise tax | 4.5% | — | Not modeled (as for Honolulu) |
| 201H | Applies statewide | — | Not modeled yet |
| Bill 6, Bill 7, TOD, Waikīkī | Don't apply | Current zoning only | Same |
| Timing, hard cost, rents, vacancy, opex, cap rate, absorption | Not researched | Honolulu's | Same (still open) |
| Lava hazard, SMA, water availability | Not covered | — | Not modeled |

## Tests

`test/hawaii-county-config.test.ts` checks:

- **Zoning:** units by land area per unit for RM, RCX, V, CN, CG and CDH; no FAR; coverage; yards; zone codes as the GIS list writes them; MCX stops the run.
- **Parking and loading:** 1.25 stalls per unit, 1 in CDH; loading at each band edge for housing and commercial.
- **Fees:**
    - the building permit table at each band edge, and the $350,000 example;
    - plan review and its $50 minimum;
    - grading, grubbing, park land, sewer and the certificate of occupancy fee.
- **Water, tax, income:** $6,095 per unit; the Apartment rate; the 2025 table and two HHFDC rents; no required set-aside.
- **End to end:**
    - the RM-2 parcel: 10 units, 6,250 sqft, 13 stalls, every result finite;
    - yards that bind before density: an RM-.75 lot at 25 ft gives 9 units, against 12 with a uniform 8 ft setback;
    - the setback lever overriding the yards;
    - `bill6` refused.
- **Completeness:** `checkLocality` finds nothing missing.

## Sources

| Source | Used for | How it was read |
| --- | --- | --- |
| [Hawaiʻi County Code](https://hawaiicounty.gov/our-county/legislative/office-of-the-county-clerk/county-code), Chapter 25 Zoning, Supp. 20 (7-2026), advance sheet updated Aug 5, 2026 | Districts, density, height, sites, yards, landscaping, parking, loading, exemptions, filing fees (25-2-52, 25-2-62, 25-4-51 to 25-4-59.2, 25-5-30 to 25-5-138, 25-7-20 to 25-7-27) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 5, Construction Administrative Code | Building permit, plan review and occupancy certificate fees (5-7-1 to 5-7-6) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 8, Dedication of Land | Park dedication (8-2 to 8-8) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 10, Erosion and Sedimentation Control | Grading, grubbing and stockpiling fees (10-11) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 11, Housing | Affordable housing requirements (11-4) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 19, Real Property Taxes | Tax classes (19-53) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 21, Sewers | Lateral, connection and monthly charges (21-23, 21-25, 21-36.1) | Full PDF, downloaded by the team |
| Hawaiʻi County Code Chapter 23, Subdivisions (2026-08) | Checked for park dedication; none there | PDF, downloaded by the team |
| [County GIS zoning definitions](https://gis.hawaiicounty.gov/public/downloads/plhyperlinks/MetadataFiles/Zoning%20Definition.pdf) (rev. April 22, 2020) | The zone codes in use | PDF, directly; the team's March 2017 copy has the same codes |
| [DWS Water Rates brochure, eff. July 1, 2025](https://www.hawaiidws.org/wp-content/uploads/2025/07/Water-Rates-Brochure-Effective-07-01-2025.pdf) | Facilities charge, service laterals | PDF, directly |
| [HHFDC 2025 Hawaiʻi County income schedule](https://dbedt.hawaii.gov/hhfdc/files/2025/05/Hawaii-County-2025.pdf) | Income limits, affordable rents | PDF, directly |
| [HHFDC 2026 Hawaiʻi County income limits](https://dbedt.hawaii.gov/hhfdc/files/2026/06/2026-HHFDC-Hawaii-County-Income-Limits_Sales-Price-Guidelines.pdf) | The newer table, not yet used (median $98,300) | Via the rule sheet |
| [HHFDC 2013 Hawaiʻi County income schedule](https://files.hawaii.gov/dbedt/hhfdc/resources/2013Hawaii.pdf) | AMI growth | PDF, directly |
| [Resolution 574-26 legal notice](https://statelegals.staradvertiser.com/?p=10994) | FY 2026–27 property tax rates | Web page, directly |
| [Big Island Now, FY 2026–27 tax rates](https://bigislandnow.com/?p=434839) | Cross-check of the tax rates | Via the rule sheet |
| [Civil Beat, Big Island sewer rates (Sept 2026)](https://www.civilbeat.org/2026/09/sewer-rate-hike-big-island-wastewater-system-is-millions-in-debt/) | Bill 183 monthly sewer increase | Via the rule sheet |
| [Honolulu Advertiser, West Hawaiʻi school impact fees (2010)](https://archives-new.honoluluadvertiser.com/article/2010/Apr/18/ln/hawaii4180369.html) | School impact fee figures | Via the rule sheet |
| [Hawaiʻi Legislature, HB 1919 (2026)](https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=HB&billnumber=1919&year=2026) | State parking cap status | Via the rule sheet |
| [Stripe, Hawaiʻi GET rates](https://stripe.com/us/resources/more/hawaii-sales-tax-rate) | GET 4% + 0.5% county (not modeled) | Via the rule sheet (third party) |
| The team's Hawaiʻi County Rule Sheet (October 2026) | Checklist and cross-check | Internal working sheet |

# Model & Assumptions Overview

This is a required deliverable. It is the single most important document for the Transparency & Explainability criterion (30% of scoring). Write it so a policymaker with no technical background can understand what your tool does, what it assumes, and what it cannot tell them.

Replace every [bracketed prompt] with your content. Keep it concise; clarity beats length.

# Purpose and Scope

[What question does this tool answer, for whom, and over what geography? Which of the five benchmark scenarios does it address (at least three are required)? State plainly what is in scope and what is out of scope.]

> **Draft** Items marked [Q#] are open decisions.

**Question:** How many more homes would be built in Hawaii over the next five years under a given reform, compared with current rules?

**Scenarios:** For the Housing Challenge, we will model the following scenarios alongside a baseline scenario: 
1. Transit-Oriented Density
2. Parking Requirement Reduction
3. Development Fee Reduction

**Time horizon:** Five years, 2027–2031.

**Geography:** Parcels in each county, added up to a statewide total. The model's rules currently cover only the City and County of Honolulu; Maui, Hawaii and Kauai counties are added through the locality refactor.

**Housing outcome:** Net new housing units under each scenario. [Q1] 

**Out of scope:** Accessory dwelling units and missing middle (2–6 units on single-family lots). The model is a multifamily rental pro forma and has no single-family or ADU pathway. For-sale housing is also out: every pathway is rental only, as in `@uhero/feasim` 0.1.0.

# Core Assumptions and Their Rationale

[List the assumptions your model makes and why each is reasonable. Be explicit about behavioral, economic, and land-use assumptions. Where you chose a parameter value, say where it came from.]

| Assumption | Value / choice | Rationale | Source |
| ---------- | -------------- | --------- | ------ |
| Share of feasible parcels that are built within five years | Measured curves: chance of a new building by profit level, parcel type and island (`pdev/pdev_params.json`) | Most parcels where a project pencils are not built in a given five years. Counting all of them would overstate production many times over | Honolulu permits matched to 2017–2025 assessments; Maui and Hawaiʻi County tax rolls; [pdev/README.md](../pdev/README.md) |
| Profit is measured against each parcel's own assessed land and building value | Profit ratio = new project value ÷ (construction and soft costs + assessed land + assessed building) | An existing building is a cost of redevelopment, so a lot with a newer house needs more profit before it is replaced | County assessment rolls |
| Construction cost changes over time | $150 per sq ft in late-2021 dollars, adjusted by the national construction materials price index | Without this, the model misses held-out years by 40–60%; with it, by 10–15% | FRED WPUSI012011 |
| Apartment and commercial zones use the single-family curves | Borrowed, not measured | Only 29 privately held apartment or business-zoned lots on Oʻahu got a 5+ unit building in 2017–2025, too few to fit a curve. Their raw rates are lower than the single-family curves, so this likely overstates production in these zones | [pdev/README.md](../pdev/README.md#limitations) |
| When a home counts as built | House and 201H rates: permit issued. Vacant lots: finished home on the tax roll. Houses convert to finished at × 0.73 | [Q1] open; the team leans toward finished homes | Honolulu permit close-out dates, 2013–2019 |
| Market conditions over the five years | Base estimate × 1.0, range 0.88–1.25 | Low end: weakest five-year stretch in 2017–2025 relative to the model. High end: 90th percentile of five-year stretches of Oʻahu rebuilding since 2005 | [pdev/README.md](../pdev/README.md#validation) |

# Data Sources and Cleaning Steps

[Summarize the datasets you used and how you prepared them. Full provenance and licensing go in DATA_PROVENANCE.md; summarize here and link to it.]

# Methodological Approach

The full methodology is in [docs/model](model/README.md): the pipeline every pathway runs ([simulator logic](model/simulator-logic.md)), each Honolulu pathway, and every variable with its source ([variables](model/variables.md)). The neighbor-island counties' rules are in [docs/notes](notes/).

[Explain how the tool works: the equations, logic flows, or rules; how a scenario changes the inputs; and how outputs are produced. Diagrams or pseudocode are welcome. Someone should be able to follow the reasoning from input to output.]

## From feasible to built: probability of development

Feasim says whether a project would make money on a parcel. The probability-of-development layer turns that into the chance the parcel is actually built within five years:

```
expected new homes = sum over parcels of P5 × net new units
P5 = 1 − (1 − p)^5,   p = 1 / (1 + e^(−z))
```

Here z depends on the parcel's profit ratio and its type, so p is the annual chance of a new building. Vacant lots get one curve per island, with one profit slope shared by all islands. Lots with a house get an Oʻahu curve that also depends on owner occupancy, building value relative to land, slope and coastal hazard zones. Approved 201H projects and developer subdivisions get flat rates. The curves, their tests and their limits are in [pdev/README.md](../pdev/README.md); the coefficients the simulator reads are in `pdev/pdev_params.json`.

## Scenario definitions (draft)

| Scenario | What changes | Model inputs it sets | Default and sensitivity range |
| -------- | ------------ | -------------------- | ----------------------------- |
| **Baseline** | Nothing: today's zoning, parking minimums and fees in each county. In Honolulu, the Standard Development Pathway (Ord. 26-7) | Honolulu: the Standard pathway (`bill6`). Other counties: current zoning (`current`) | Each county's own rules |
| **Transit-Oriented Density** | More height and density near frequent transit | Honolulu: its TOD pathway (PD-T and IPD-T), at full approval, on parcels in a TOD district. Approval needs a 20,000 sq ft lot (industrial lots without it have no housing, except up to 10 units in IMX-1 under PD-T), and its community benefits are not priced. Other counties: not defined yet; needs each parcel's distance to a frequent bus stop | [Q] Height and density rules, and the distance, off Oʻahu |
| **Parking Requirement Reduction** | No parking minimums; developers build what the market wants | `parking_ratio` (stalls per unit) | Draft 0.5; range 0 to 1.5 [Q] |
| **Development Fee Reduction** | Development fees cut by 50%: permits, plan review, environmental review, sewer, water, park dedication, grading and the rest | `fee_scale` (share of the fees); the fee source sets `fee_per_unit` | 0.5, the challenge's cut. Reported on each county's own fees (about $19,000 to $33,000 per unit) and on the challenge's $50,000 per unit, so the cut is $25,000 |

Each scenario is defined in `src/scenarios/scenarios.ts`. The design and open decisions are in [the scenario layer note](notes/SCENARIO_LAYER.md).

# Limitations and Known Edge Cases

[What does the tool get wrong or handle poorly? Where should users be cautious? Honesty here is rewarded, not penalized.]

- **Probability of development in apartment zones is borrowed.** The curves were measured on single-family lots. Apartment and business-zoned lots get the same curves until enough apartment projects can be measured against feasim's profit numbers.
- **Single years are uncertain.** The house curve predicts four-year totals within 10–15% on held-out years, but a single year can be off by 25% or more.
- **Kauaʻi is estimated, not measured,** because the county publishes no assessed values.

# Sensitivity Notes

[Which inputs move the results the most? Show what happens when key assumptions change. Ranges and sensitivity analysis are preferred over single-point claims.]

- **Market conditions:** five-year totals range from 0.88 to 1.25 times the base estimate.
- **Definition of built:** counting finished homes instead of permits lowers the house rates to 0.73 times.
- **Profit:** a lot with a rented house at break-even has about a 1.8% chance of a new-home permit within five years; at a 20% profit, about 5.4%. Vacant Oʻahu lots go from about 11% to 15%.

# Intended Users and Appropriate Use Cases

[Who should use this tool, and for what decisions? Just as important: for what decisions should it NOT be used?]

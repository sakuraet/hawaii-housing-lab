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
| [e.g., share of eligible parcels that redevelop] | [value] | [why] | [citation] |

# Data Sources and Cleaning Steps

[Summarize the datasets you used and how you prepared them. Full provenance and licensing go in DATA_PROVENANCE.md; summarize here and link to it.]

# Methodological Approach

The full methodology is in [docs/model](model/README.md): the pipeline every pathway runs ([simulator logic](model/simulator-logic.md)), each Honolulu pathway, and every variable with its source ([variables](model/variables.md)). The neighbor-island counties' rules are in [docs/notes](notes/).

[Explain how the tool works: the equations, logic flows, or rules; how a scenario changes the inputs; and how outputs are produced. Diagrams or pseudocode are welcome. Someone should be able to follow the reasoning from input to output.]

## Scenario definitions (draft)

| Scenario | What changes | Model inputs it sets | Default and sensitivity range |
| -------- | ------------ | -------------------- | ----------------------------- |
| **Baseline** | Nothing: today's zoning, parking minimums and fees in each county. In Honolulu, the Standard Development Pathway (Ord. 26-7) | Honolulu: the Standard pathway (`bill6`). Other counties: current zoning (`current`) | Each county's own rules |
| **Transit-Oriented Density** | More height and density near frequent transit | Honolulu: its TOD pathway (PD-T and IPD-T) on parcels in a TOD district. Other counties: not defined yet; needs each parcel's distance to a frequent bus stop | [Q] Height and density rules, and the distance, off Oʻahu |
| **Parking Requirement Reduction** | No parking minimums; developers build what the market wants | `parking_ratio` (stalls per unit) | Draft 0.5; range 0 to 1.5 [Q] |
| **Development Fee Reduction** | Development fees cut by 50%: permits, plan review, environmental review, sewer, water, park dedication, grading and the rest | `fee_scale` (share of the fees); the fee source sets `fee_per_unit` | 0.5, the challenge's cut. Reported on each county's own fees (about $19,000 to $33,000 per unit) and on the challenge's $50,000 per unit, so the cut is $25,000 |

Each scenario is defined in `src/scenarios/scenarios.ts`. The design and open decisions are in [the scenario layer note](notes/SCENARIO_LAYER.md).

# Limitations and Known Edge Cases

[What does the tool get wrong or handle poorly? Where should users be cautious? Honesty here is rewarded, not penalized.]

# Sensitivity Notes

[Which inputs move the results the most? Show what happens when key assumptions change. Ranges and sensitivity analysis are preferred over single-point claims.]

# Intended Users and Appropriate Use Cases

[Who should use this tool, and for what decisions? Just as important: for what decisions should it NOT be used?]

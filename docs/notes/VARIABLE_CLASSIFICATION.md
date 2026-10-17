# Variable classification (draft)

Working notes for the locality refactor. Every row of Pro-forma Variables V3 (the constants, tables, levers and functions in `@uhero/feasim` 0.1.0) is sorted into one of four classes, so we know what moves out of the engine into per-county config.

| Class | Meaning | Where it goes |
| ----- | ------- | ------------- |
| **Rule** | Law or a published schedule, with a code citation. Differs by place. | Locality config (`src/hi/honolulu/`, then each county), or state config (`src/hi/state.ts`) when state law sets it |
| **Assumption** | An estimate we chose: market, cost or finance. Has a source but no legal force. | `assumptions` config, with a sensitivity range |
| **Mechanics** | A formula or algorithm. The same everywhere. | Stays in the engine (`src/core/`) |
| **Drop** | Unused, retired or a duplicate fallback. | Removed or folded into config defaults |

A function that applies a rule table (for example `calcFAR`, `loadingSpaces`, `buildingPermitFee`) is split in two: the table becomes a **Rule** in config, and the code that evaluates it stays as **Mechanics**. These rows are marked "Rule (table) + Mechanics".

"Scope" says how far a value reaches: **County** (Honolulu today), **State** (HRS or a statewide agency), **Pathway** (only one pathway uses it) or **All**.

Notes that start with **Review:** are judgment calls to settle before the refactor. Each one says what needs deciding.

## Summary

| Class | Rows |
| ----- | ---- |
| Rule (County) | Zones, FAR, lot coverage, step-backs, Waikiki open space, TOD, parking, loading, bicycle parking, park dedication, building and site permit fees, wastewater, BWS water charges, Bill 7 |
| Rule (State) | 201H, school impact fee, HHFDC income limits and sale price tables |
| Assumption | Hard and land cost, rents and AMI levels, cap rate, vacancy, operating expenses, finance terms, timing, growth rates, feasibility thresholds |
| Mechanics | Envelope geometry, podium and parking placement, rent and price lookups, loan sizing, RLV, IRR, the verdict |
| Drop | 30 unused or retired rows, and 32 per-pathway fallback constants that duplicate `DEFAULT_INPUTS` |

## Levers (user inputs)

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| amort_years, permanent_rate, min_dscr, hold_years, equity | Assumption | All | Lender terms; per-pathway defaults |
| land_cost | Assumption | County | Market land price, $/sqft of lot; differs by county and submarket. **Review:** one value per county, or keep Honolulu's for now? |
| target_return | Assumption | All | Land carry rate |
| unit_type | Assumption | All | Unit mix choice |
| park | Rule | County | Park dedication method (exempt / in lieu); Honolulu ROH 22-7.7, 43-10.8 |
| floor_height | Assumption | All | Floor-to-floor height |
| grant_type | Rule | Pathway (Bill 7) | ROH Ch. 32 grants |
| retail_rent, include_retail / retail_share | Assumption | County | Retail market |
| hard_cost_per_sqft | Assumption | County | One rate per county today; **Review:** separate neighbor-island hard costs, or keep Honolulu's for now? |
| setback | Rule | County | Yard setback; Honolulu default 10 ft. **Review:** is this the code's yard requirement or a simplification? |
| affordable_ami / market_ami | Assumption | All | Market rent proxied as a high-AMI rent. **Review:** does this hold on the neighbor islands, where rents may not track AMI the same way? |
| affordability | Rule | State (201H) | ≥ 51% |
| FeeBasis (waivable_fee_basis) | Rule | County | Which units pay waivable fees |
| permitting_months / const_months / leaseup_months | Assumption | County | Overrides for the timing functions |
| parking_ratio / parking_exempt | Rule | County | Stalls per unit; exemption is § 21-6.20(a). **The Parking scenario changes this.** |
| building_area_per_unit | Rule | Pathway (Bill 7) | 800 sqft unit cap |
| mortgage, rental_split, sale_split | Drop | — | Not read (rental only) |
| current_unit | Drop | — | Retired |

## Zones

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| ZONE_GROUPS, ZONE_NAMES, INDUSTRIAL, APARTMENT_ZONES | Rule | County | Zone lists by group; each county has its own district names |
| zoneName | Mechanics | All | Lookup against config |
| permitsGroundFloorRetail | Rule (table) + Mechanics | County | Which zones allow ground-floor commercial |

## FAR, density and envelope

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| calcFAR, baseFar, calcFarBill6, BUSINESS_FAR, TABLE_21_3_3 | Rule (table) + Mechanics | County | FAR by zone; some lot-size-scaled. Rule shapes needed: flat, lot-scaled, tiered |
| LOT_COVERAGE, lotCoverage, lotCoverageBill6 | Rule (table) + Mechanics | County | Coverage by zone; tiered by lot size in apartment zones |
| COMMERCIAL_COVERAGE, commercialFracByZone | Rule (table) + Mechanics | County | Ground-floor commercial share |
| DEFAULT_RETAIL_SHARE | Assumption | All | |
| WAIKIKI_OPEN_SPACE | Rule | County (special district) | |
| envelopeCoverage | Mechanics | All | |
| OPEN_SPACE_FAR_CEILING | Rule | County | Bonus ceilings |
| openSpaceBonus / openSpaceBonusOver, lotAfterOpenSpace | Rule (table) + Mechanics | County | 5:1 earning ratio is ROH 21-3.120-2(b) |
| BILL7_FAR, BILL7_MAX_HEIGHT, Bill 7 lot coverage | Rule | Pathway (Bill 7) | |
| STEPBACK_ABOVE_40, zoneStepBack | Rule (table) + Mechanics | County | |
| yardFootprint, floorPlates, podiumEnvelope, livingStories | Mechanics | All | **Review:** the 2:1 lot shape inside yardFootprint is an assumption; move it to config? |
| setbackFootprint | Drop | — | Unused |

## TOD

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| TOD_ELIGIBLE_DISTRICTS, TOD_MIN_LOT_SQFT, TOD_MAX_FAR, TOD_MAX_HEIGHT_FT, DOUBLE_AFTER_BONUS, PDT_SCALED, IMX1_PDT_MAX_UNITS, PDT_FRONT_NO_PARKING_FT, TOD_PLAN_STANDARDS | Rule | County (Honolulu rail) | ROH 21-9.100 |
| calcFarTod, calcFarPdt, todHeightPdt, todHeightLimit, todUseZone, residentialUse, todIneligibleReason / todNotApplicableReason | Rule (table) + Mechanics | County | |
| todPlanCeiling, frontStripSqft, pathwayEnvelope, TodTier | Mechanics | All | |
| *(new)* major transit stop definition, distance threshold, uplift | Assumption | All | **The TOD scenario adds these.** [Q6] [Q7] |

## Park dedication

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| PARK_SQFT_PER_UNIT, PARK_FLOOR_AREA_FRACTION, exempt / in_lieu fees | Rule | County | ROH 22-7.5 |
| calcParkArea | Rule (table) + Mechanics | County | |
| PARK_BUILD_COST_PER_SQFT | Drop | — | Unused |

## Construction and units

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| RETAIL_PREMIUM, EFFICIENCY, contingency, CONSTRUCTION_MGMT_RATE | Assumption | All | BTC or assumed |
| cost_inflation | Assumption | County | 5.6%/yr; Honolulu series. **Review:** same rate statewide? |
| drawCurve | Mechanics | All | |
| UNIT_SIZE | Rule | County | ROH 32-2.9 maximum unit sizes, used as typical sizes. **Review:** treat as a rule, or as our assumption about typical units? |
| UNIT_MIX, DEFAULT_UNIT_TYPE, mixUnitSize | Assumption / Mechanics | All | Presets are assumptions; mixUnitSize is mechanics |
| COST_PER_ZONE, SITE_PREP, contractor_profit, UNIT_INDEX | Drop | — | Unused or retired |

## Vacancy, affordability and rents

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| Vacancy: default (retail 12.6%), rental (7.4%) | Assumption | County | Honolulu figures. **Review:** per-county vacancy, or keep Honolulu's? |
| Vacancy: home | Drop | — | Not read |
| AFFORDABLE_RENT_INCOME_SHARE | Rule | State (HHFDC) | 30% of income |
| INCOME_LIMITS | Rule | State (HHFDC), per county | HHFDC publishes a table for each county; Honolulu's is loaded today |
| HHFDC_RATES, HHFDC_0BR … HHFDC_4BR, HHFDC_TABLES | Rule | State (HHFDC), per county | Sale prices; only used if for-sale returns |
| RENT_HOUSEHOLD | Assumption | All | Household size per unit type |
| rentByAmi, mixRentByAmi, getAffordablePrice, mixAffordablePrice | Mechanics | All | |
| ami_escalation | Assumption | County | 4%/yr, Honolulu MFI growth |
| Affordable set-aside: Standard / Bill 6 / TOD (0) | Rule | County | ROH Ch. 29 (rental: 0) |
| Affordable set-aside: Bill 7 (80%) | Rule | Pathway (Bill 7) | |
| H201_MIN_AFD_FRAC | Rule | State (201H) | |

## Fees (soft costs)

All fee rows count toward the Development Fee Reduction scenario (see MODEL_AND_ASSUMPTIONS.md). [Q8]

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| specialDistrictFee, specialDistrictTotal, tod_application | Rule | County | TOD only |
| buildingPermitFee, planReviewFee | Rule (table) + Mechanics | County | ROH 18-7.5, 18-6.1 |
| temp_occupancy_cert, escp, installation_trench, service_connection, ea / eis | Rule | County | |
| gradingPermit, grubbingPermit, stockpilingPermit | Rule (table) + Mechanics | County | ROH 18A-2.4 |
| excavationDepthByZone | Assumption | County | Depth by zone is assumed ("Random" in V3). **Review:** keep as an assumption for every county? |
| per_dwelling (school impact fee) | Rule | State (HRS 302A) | Set to $0 today. **Review:** model the fee by school impact district, or keep $0 and note it? |
| wastewater_charge_per_esdu, wastewaterFee | Rule (table) + Mechanics | County | ROH 43-10.3 |
| calcSoftCosts | Mechanics | All | |
| grading_bond, escp_revision, utilities_repairs | Drop | — | Retired |

## BWS water charges

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| WSFC_PER_FU, WSFC_MIN_FU, WSFC_WAIVER_UNIT_CAP, FIRE_METER_CHARGE | Rule | County (each county's water department) | |
| FU_PER_UNIT, BATHS_BY_UNIT_TYPE, COMMON_AREA_FU | Assumption | All | Fixture assumptions |
| fireMeterSize | Assumption | All | Meter size by stories. **Review:** does each county's water department size meters the same way? |
| wsfcCategory / mixFixtureUnits / calcWaterFees | Mechanics | All | |

## Timing

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| constructionMonthsByZone, permittingMonthsByZone | Assumption | County | **Review:** permitting time is county-specific and policy-relevant; find each county's figures? |
| stabilization, target_occupancy, absorption_units_per_month | Assumption | All | BTC |
| resolveConstMonths | Mechanics | All | |
| monthly_sale_cap | Drop | — | For-sale only |

## Finance, hold and cap rates

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| loan_fee, construction_rate, cost_carried, disposition_cost, DEFAULT_PROFIT_MARGIN, DEFAULT_TARGET_RETURN, exit_cap_spread, DEFAULT_TARGET_SPREAD, RETAIL_CAP_SPREAD | Assumption | All | |
| rpt_residential | Rule | County | 0.35%; each county sets its own property tax rates |
| tax_exemption_years | Rule | Pathway (Bill 7, TOD) | |
| annual_rent_growth, annual_opex_growth, annual_assessment_growth | Assumption | County | **Review:** same growth rates statewide? |
| DEFAULT_CAP_RATE | Assumption | County | 5.1%, one rate for every zone. **Review:** one rate per county? |
| calcPredevEquity / equityFirstDraws, calcConstructionInterest, calcLeaseupCarry, calcAnnualLoanConstant / calcDscrMaxLoan, sizeConstructionLoan, calcPermanentLoan, calcDevRLV, calcPropertyTax / allocatePropertyTax, solveIRR, resolveCapRate | Mechanics | All | |
| amort_years (fallback) | Drop | — | Duplicates the lever |
| equity (BTC 0.1), dev_fee, annual_affordable_rent_growth, annual_market_rent_growth, metro, suburban | Drop | — | Unused or retired |

## Parking, loading and bicycle

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| residential_sqft_per_stall, retail_sqft_per_stall, joint_use | Rule | County | ROH 21-6.20, Tables 21-6.1, 21-6.2. **The Parking scenario overrides the residential minimum.** |
| legalParkingRatio, article6Parking, roundHalfUp | Rule (table) + Mechanics | County | |
| stalls_per_unit | Drop | — | TOD fallback; replaced by config |
| stall_sqft, surface_stall_sqft, cost_per_sqft, surface_cost_per_sqft, monthly_rent_per_stall | Assumption | County | Parking cost and income |
| calcParkingIncome, parking_cost | Mechanics | All | |
| Loading: min_lot_sqft, small_sqft, large_sqft | Rule | County | ROH 21-6.110, 21-6.130 |
| loadingSpaces | Rule (table) + Mechanics | County | Table 21-6.5 |
| loadingSqft | Mechanics | All | |
| Bicycle: units_per_space, retail_sqft_per_space / stalls_per_space, sqft_per_space | Rule | County | ROH 21-6.40 |
| Bicycle: cost_per_space (short and long term) | Assumption | All | |
| bicycleRequired, bicycleSpaces, calcBicycleParkingCost | Rule (table) + Mechanics | County | |

## Other income and operating expenses

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| application_fee, lease_renewal, admin income split | Assumption | All | |
| opex_ratio | Assumption | All | Per pathway (GET exemption) |
| property_mgmt_rate, property_insurance_unit, liability_insurance_unit, monitor_unit, rp_tax | Drop | — | Not read or duplicate |

## Bill 7

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| GRANT, max_units_by_law, Bill 7 tax exemption AMI | Rule | Pathway (Bill 7, Honolulu) | ROH Ch. 32 |
| DEFAULT_RETAIL_RENT, DEFAULT_HEIGHT_LIMIT, DEFAULT_PERMANENT_RATE, DEFAULT_HOLD_YEARS, DEFAULT_LAND_COST, DEFAULT_GRANT_TYPE, DEFAULT_INCLUDE_RETAIL, DEFAULT_AFFORDABLE_AMI / DEFAULT_MARKET_AMI | Drop | — | Fallbacks that duplicate `DEFAULT_INPUTS` |

## Pathway default constants

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| STD_DEFAULT_*, BILL6_DEFAULT_*, TOD_DEFAULT_*, H201_DEFAULT_* (32 rows) | Drop | — | Fallbacks that duplicate `DEFAULT_INPUTS`, and several disagree with it (hold years 10 vs 8; 201H permitting 12 vs 18 months; 201H AMI). **Review:** OK to collapse them into one source of defaults per pathway? |

## Feasibility

| Variable | Class | Scope | Note |
| -------- | ----- | ----- | ---- |
| rocLevel, rlvLevel, equityMultipleLevel, irrLevel thresholds | Assumption | All | Band edges (90/110%, 2.0/2.5×, 8/12%) are choices |
| overallLevel, LEVEL_COLOR | Mechanics | All | |
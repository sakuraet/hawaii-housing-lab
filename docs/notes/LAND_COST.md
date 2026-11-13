# Land cost defaults

The model prices land per square foot of lot (the Land Cost lever,
`land_cost`). Each county now has its own default, set in its
`assumptions.lever_defaults`. The original model used $130 everywhere, and the
pathway defaults (`DEFAULT_INPUTS`) keep that value, so the package's snapshot
tests still run at $130.

| County | Default ($/sqft) | Title Guaranty median | QPub median |
| --- | --- | --- | --- |
| Honolulu | $170 | $177.78 (83 sales) | $163.97 (140 sales); "Valid" sales only: $237.18 (45) |
| Maui | $75 | $72.70 (34) | $81.37 (68) |
| Hawaiʻi | $55 | $48.30 (285) | $44.78 (325) |
| Kauaʻi | $50 | $42.69 (24) | $79.97 (34) |

The defaults are team estimates (November 2026). We set them after looking at
the medians in the table. They aren't the output of a formula.

## The sales we looked at

- **Sources:** Title Guaranty deed records and the counties' QPub sales
  records, 2020–2025, from UHERO's housing database. MLS land listings were
  also checked, but there are none for Oʻahu and only 1 to 12 elsewhere, so
  they weren't used.
- **Land sales:** sales of land without a building. In Title Guaranty, a $0
  building value at the sale; in QPub, a $0 building assessment. Kauaʻi's QPub
  records have no land/building split, so a Kauaʻi parcel counts as land when
  no house or commercial building is on record for it today. Condominium
  units (CPRs) are left out.
- **Zones:** the multi-family, resort and business zones the model builds in,
  by each parcel's current zoning:
  - Honolulu: A-1, A-2, A-3, AMX-1 to 3, the Waikīkī apartment and resort
    precincts, B-2, BMX-3, BMX-4 and Resort (from the State GIS zoning layer).
  - Maui: A-1, A-2, H-1, H-M, H-2, B-2 and B-3.
  - Hawaiʻi: RM, RCX, V, CG, CN, CV and CDH (from the State GIS zoning layer).
  - Kauaʻi: R-10, R-20, RR-10, RR-20, CG and CN.
- **Price per square foot:** the sale price over the lot area. A deed covering
  several parcels is one sale over their combined area.
- **Cleaning:** sales under $10,000 or on less than 1,000 sqft are left out.
  On Oʻahu these included $10 transfers, slivers of a few square feet, and
  assemblages where only part of the land made it into the records.

## Limits

- **Small samples.** Maui and Kauaʻi rest on 24 to 68 sales each.
- **Current zoning.** Zoning is each parcel's today, not at the sale.
- **Not every sale is at market.** Only Honolulu's QPub records flag valid
  sales; the other counties' QPub figures include non-market transfers.
- **Kauaʻi's QPub test is weaker,** since it uses buildings on record today.
  Its QPub median ($79.97) is well above Title Guaranty's ($42.69).
- **Land, not land with a building.** Most redevelopment sites in these
  zones have a building on them, which this default doesn't price. The
  scenario layer's design uses each parcel's assessed value where it's known
  ([SCENARIO_LAYER.md](SCENARIO_LAYER.md)).

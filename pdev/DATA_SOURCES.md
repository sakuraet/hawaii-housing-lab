# Data sources

All public. Pulled October 21–23, 2026. Raw files are not committed (repo rule); download them from these sources.

| Dataset | Source | Used for |
|---|---|---|
| Honolulu assessed values, tax year 2022 (values as of Oct 1, 2021) | City & County of Honolulu Assessed Property Values, ArcGIS item e8f8041075f94f37a8211ea6426c108b | Each lot's current value, Oʻahu |
| Honolulu assessed values, ~tax year 2023 (snapshot saved Oct 26, 2023) | Honolulu GIS "Cadastral Tables by TMK", services.arcgis.com/tNJpAOha4mODLkXz/…/Cadastral_Tables_by_TMK/FeatureServer/1 | Held-out-years test |
| Honolulu assessed values, tax year 2026 | Honolulu GIS CadastralTables ASMTPITT, …/CadastralTables/FeatureServer/10 | Roll-to-roll checks |
| Honolulu parcels (lot area, location) | Honolulu "Parcels – All", …/All_Parcels/FeatureServer/0 | Lot size, location |
| Honolulu building permits, Jan 2005 – Jun 2025 | Honolulu Open Data, dataset 4vab-c87q (data.honolulu.gov). Downloaded from the city's portal, not scraped. | Which lots got built |
| Zoning, all counties | Hawaiʻi Statewide GIS Program, ParcelsZoning MapServer | Single-family zones |
| Maui certified parcels 2020, 2024, 2025 | Maui County GIS | Maui measurement |
| Hawaiʻi County parcels with 2026 values | Hawaiʻi Statewide GIS, ParcelsZoning MapServer/5 | Big Island measurement |
| Statewide dwelling-units layer (TMKs as of May 2024) | HI_Parcels_Bedrooms_Bathrooms_Units, Hawaiʻi Statewide GIS | Which Big Island lots had homes |
| Kauaʻi parcels | Hawaiʻi Statewide GIS, ParcelsZoning MapServer/9 (no assessed values published) | Kauaʻi lot counts |
| 201H project status | DPP, "Status Update of Council Approved 201H Projects in the Past 5 Years," Feb 2024 (hnldoc.ehawaii.gov, document 20117) | Approved-project conversion |
| County building permits, AZ / OR / HI, 2005–2025 | Census Building Permits Survey, www2.census.gov/econ/bps/County/ | County baselines and ranges |
| County population 2020–2024 | Census population estimates, co-est2024-alldata.csv | Market heat |
| Mortgage rate, Honolulu house prices, construction materials prices | FRED: MORTGAGE30US, ATNHPIUS46520Q, WPUSI012011 | Market-cycle test |
| Arizona and Oregon parcels with values and year built | Maricopa County (gis.maricopa.gov), Oregon Metro RLIS (Multnomah, Washington, Clackamas), Jackson, Lane, Josephine and Klamath county GIS services | Mainland check |

No personal data is used: owner names and addresses were not downloaded or were dropped.

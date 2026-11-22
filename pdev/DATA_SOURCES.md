# Data sources

All sources are public and were retrieved in October and November 2026. Raw files are not committed, per repository policy; they can be downloaded from the sources below.

| Dataset | Source | Used for |
|---|---|---|
| Honolulu assessed values, tax year 2022 (values as of Oct 1, 2021) | City & County of Honolulu Assessed Property Values, ArcGIS item e8f8041075f94f37a8211ea6426c108b | Each lot's current value, Oʻahu |
| Honolulu assessed values, ~tax year 2023 (snapshot saved Oct 26, 2023) | Honolulu GIS "Cadastral Tables by TMK", services.arcgis.com/tNJpAOha4mODLkXz/…/Cadastral_Tables_by_TMK/FeatureServer/1 | Test on held-out years |
| Honolulu assessed values, tax year 2026 | Honolulu GIS CadastralTables ASMTPITT, …/CadastralTables/FeatureServer/10 | Vacant-lot outcome on Oʻahu (new buildings, 2022 to 2026) |
| Honolulu parcels (lot area, location) | Honolulu "Parcels – All", …/All_Parcels/FeatureServer/0 | Lot size and location |
| Honolulu building permits, Jan 2005 – Jun 2025 | Honolulu Open Data, dataset 4vab-c87q (data.honolulu.gov). Downloaded from the city's open data portal. | Which lots got built |
| Zoning, all counties | Hawaiʻi Statewide GIS Program, ParcelsZoning MapServer | Identifying single-family zones |
| Maui certified parcels 2020, 2024, 2025 | Maui County GIS | Maui vacant-lot outcome (new buildings, 2020 to 2025) |
| Hawaiʻi County parcels with 2026 values | Hawaiʻi Statewide GIS, ParcelsZoning MapServer/5 | Hawaiʻi County parcel values and vacant-lot outcome |
| Statewide dwelling-units layer (TMKs as of May 2024) | HI_Parcels_Bedrooms_Bathrooms_Units, Hawaiʻi Statewide GIS | Which Hawaiʻi County lots already had homes (about 2022) |
| Kauaʻi parcels | Hawaiʻi Statewide GIS, ParcelsZoning MapServer/9 (no assessed values published) | Kauaʻi lot counts |
| 201H project status | DPP, "Status Update of Council Approved 201H Projects in the Past 5 Years," Feb 2024 (hnldoc.ehawaii.gov, document 20117) | Share of approved 201H projects that reached a building permit |
| County building permits, AZ / OR / HI, 2005–2025 | Census Building Permits Survey, www2.census.gov/econ/bps/County/ | County comparison table (AZ, OR, HI) |
| County population 2020–2024 | Census population estimates, co-est2024-alldata.csv | Permits per resident, for the county comparison |
| Mortgage rate, Honolulu house prices, construction materials prices | FRED: MORTGAGE30US, ATNHPIUS46520Q, WPUSI012011 | Market-cycle test |
| Slope | USGS 3D Elevation Program, 10 m elevation, slope derived | Steep-lot test |
| Hazard zones (FEMA flood, tsunami evacuation and extreme tsunami, 3.2 ft sea-level rise, lava flow, wildfire risk) | Hawaiʻi Statewide GIS Program hazard layers | Hazard tests |
| Arizona and Oregon parcels with values and year built | Maricopa County (gis.maricopa.gov), Oregon Metro RLIS (Multnomah, Washington, Clackamas), Jackson, Lane, Josephine and Klamath county GIS services | Mainland check |

No personal data is used in the analysis or stored in any output. On Kauaʻi, the owner-name field was used only to exclude government-owned parcels; elsewhere, owner names and mailing addresses were not downloaded or were removed.

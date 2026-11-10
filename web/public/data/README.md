# Map data

The tool reads its parcel data from this folder at runtime. Git ignores
everything here except this README.

- **Hawaiʻi, Kauaʻi and Maui:** `parcels-hi-<county>.json` and
  `parcel-shapes-hi-<county>.json`, built from public data by
  `python scripts/build_data.py` (see
  [scripts/README.md](../../../scripts/README.md)).
- **Honolulu:** UHERO's Oʻahu program files, `parcels-<pathway>.json`
  (bill6, bill7, standard, tod, h201) and `parcel-shapes.json`. No public
  script builds these; they are supplied with the submission. Put them here
  before running `npm run dev`.

The sources of both are in
[docs/DATA_PROVENANCE.md](../../../docs/DATA_PROVENANCE.md).

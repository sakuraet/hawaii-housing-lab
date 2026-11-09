# Map data

The tool reads its parcel data from this folder at runtime:
`parcels-<pathway>.json` (bill6, bill7, standard, tod, h201) and
`parcel-shapes.json`. These files are not committed; git ignores everything
here except this README. Put them here before running `npm run dev`.

The data scripts will build these files for every county (see
[scripts/README.md](../../../scripts/README.md)).

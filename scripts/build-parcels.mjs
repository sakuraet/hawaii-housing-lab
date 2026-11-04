// Builds the statewide parcel table: Oʻahu's parcels and the neighbor islands'
// export, in the columns of PARCEL_COLUMNS (src/scenarios/parcels.ts). Columns
// no one has data for yet stay blank, so land cost falls to the default.
//
// Usage (from the repo root, after npm run build):
//   node scripts/build-parcels.mjs <oahu.json> <neighbor-islands.csv> [out.csv]
//
// oahu.json is an array of parcels with an 8-digit county tmk, zone_class,
// lot_sqft, height and parking_exempt. out.csv defaults to
// data/parcels_statewide.csv, which git ignores. Run the result with
// scripts/run-parcels.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PARCEL_COLUMNS, parseParcelCsv } from "../dist/index.js";

const [oahuPath, neighborPath, outPath = join("data", "parcels_statewide.csv")] = process.argv.slice(2);
if (!oahuPath || !neighborPath) {
  console.error("usage: node scripts/build-parcels.mjs <oahu.json> <neighbor-islands.csv> [out.csv]");
  process.exit(1);
}

// the state TMK is the county's with the county digit in front; Honolulu's is 1
const oahu = JSON.parse(readFileSync(oahuPath, "utf8")).map((p) => ({
  locality: "hi-honolulu",
  tmk: `1${p.tmk}`,
  lot_sqft: p.lot_sqft,
  zone_class: p.zone_class,
  height: p.height,
  parking_exempt: p.parking_exempt,
}));
const neighbor = parseParcelCsv(readFileSync(neighborPath, "utf8"));

const rows = [...oahu, ...neighbor.parcels];
const text =
  [PARCEL_COLUMNS.join(","), ...rows.map((p) => PARCEL_COLUMNS.map((c) => p[c] ?? "").join(","))].join("\n") + "\n";

// the table has to read back whole, with one row per TMK
const { parcels, problems } = parseParcelCsv(text);
const tmks = new Set(parcels.map((p) => p.tmk));
const failures = [...neighbor.problems, ...problems];
if (tmks.size !== parcels.length) failures.push(`${parcels.length - tmks.size} duplicate TMKs`);
if (failures.length) {
  console.error(`${failures.length} problems; nothing written. First ones:`);
  console.error(failures.slice(0, 10).join("\n"));
  process.exit(1);
}

writeFileSync(outPath, text);
const counts = {};
for (const p of parcels) counts[p.locality] = (counts[p.locality] ?? 0) + 1;
console.log(`${parcels.length} parcels written to ${outPath}`);
console.table(counts);

// Runs a parcel table through the engine on current zoning and writes the
// results, totals by county, and the zones not modeled.
//
// Usage (from the repo root, after npm run build):
//   node scripts/run-parcels.mjs <parcels.csv> [out-dir] [--basis land|total]
//
// The table has the columns of PARCEL_COLUMNS (src/scenarios/parcels.ts);
// extra columns are ignored. out-dir defaults to out/parcel-runs, which git
// ignores. It writes:
//   runs.csv         one row per parcel: status, reason, verdict, key outputs
//   summary.csv      totals by county (summarizeRuns)
//   not_modeled.csv  parcels not run, by county, zone and reason, most first
//   problems.txt     rows the parser left out, and why

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseParcelCsv, runParcels, summarizeRuns } from "../dist/index.js";

const args = process.argv.slice(2);
const basisAt = args.indexOf("--basis");
const land_basis = basisAt >= 0 ? args.splice(basisAt, 2)[1] : "land";
const [input, outDir = join("out", "parcel-runs")] = args;
if (!input || (land_basis !== "land" && land_basis !== "total")) {
  console.error("usage: node scripts/run-parcels.mjs <parcels.csv> [out-dir] [--basis land|total]");
  process.exit(1);
}

const { parcels, problems } = parseParcelCsv(readFileSync(input, "utf8"));
const runs = runParcels(parcels, { land_basis });
const summary = summarizeRuns(runs);

// quotes a field only when it needs it (reasons quote zone names)
const field = (v) => {
  const s = v === undefined || v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header, rows) => [header, ...rows].map((r) => r.map(field).join(",")).join("\n") + "\n";

// the outputs worth scanning a parcel by; the full output is in the engine
const OUTPUTS = [
  "height_limit",
  "buildable_sqft",
  "max_units",
  "affordable_units",
  "parking_stalls",
  "dev_land_cost",
  "dev_total_dev_cost",
  "dev_profit",
  "dev_roc",
  "dev_levered_irr",
  "rlv",
  "rlv_sqft",
];
const runRows = runs.map((r) => [
  r.tmk,
  r.locality,
  r.zone_label,
  r.zone_class,
  r.status,
  r.reason,
  r.land_cost_source,
  r.level,
  ...OUTPUTS.map((k) => r.output?.[k]),
]);

const SUMMARY = ["locality", "parcels", "run", "not_modeled", "error", "default_land_cost", "units", "strong_units"];

const notRun = new Map();
for (const r of runs) {
  if (r.status === "run") continue;
  const key = [r.locality, r.zone_label, r.status, r.reason].join("\u0000");
  notRun.set(key, (notRun.get(key) ?? 0) + 1);
}
const notRunRows = [...notRun]
  .map(([key, n]) => [...key.split("\u0000"), n])
  .sort((a, b) => b[4] - a[4] || a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));

mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "runs.csv"),
  csv(["tmk", "locality", "zone_label", "zone_class", "status", "reason", "land_cost_source", "level", ...OUTPUTS], runRows)
);
writeFileSync(join(outDir, "summary.csv"), csv(SUMMARY, summary.map((s) => SUMMARY.map((k) => s[k]))));
writeFileSync(join(outDir, "not_modeled.csv"), csv(["locality", "zone_label", "status", "reason", "parcels"], notRunRows));
writeFileSync(join(outDir, "problems.txt"), problems.length ? problems.join("\n") + "\n" : "");

console.log(`${parcels.length} parcels run from ${input} (land basis: ${land_basis})`);
if (problems.length) console.log(`${problems.length} rows left out; see problems.txt`);
console.table(summary);
if (notRunRows.length) {
  console.log("zones not run, most parcels first:");
  console.table(notRunRows.slice(0, 15).map(([locality, zone, status, reason, n]) => ({ locality, zone, status, reason, n })));
}
console.log(`written to ${outDir}`);

import { calcParcel, overallLevel } from "@uhero/policy-simulator";

import styles from "./page.module.css";

// a made-up lot, to show the app reaching the engine; the real tool replaces it
const EXAMPLE = {
  locality: "hi-honolulu",
  tmk: "EXAMPLE",
  lot_sqft: 20000,
  zone_class: "A-2",
  height: 60,
};

export default function Home() {
  const output = calcParcel("current", EXAMPLE);
  return (
    <main className={styles.main}>
      <h1>Feasim: Hawaii Housing Lab</h1>
      <p>The tool is not built yet. This page runs the engine on a made-up lot.</p>
      <dl className={styles.result}>
        <dt>Lot</dt>
        <dd>
          {EXAMPLE.lot_sqft.toLocaleString("en-US")} sqft, {EXAMPLE.zone_class}, Honolulu
        </dd>
        <dt>Units</dt>
        <dd>{output.max_units}</dd>
        <dt>Verdict</dt>
        <dd>{overallLevel(output)}</dd>
      </dl>
    </main>
  );
}

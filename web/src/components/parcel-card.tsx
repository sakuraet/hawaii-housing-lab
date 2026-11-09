"use client";

import { useState } from "react";
import {
  getLevel,
  landPricePerSqft,
  overallLevel,
  rlvRatio,
  zoneName,
  type Level,
  type ParcelOutput,
} from "feasim-challenge";

// tags beside the zoning on the card; warnings take the calculator's orange
const TAG_CHIP =
  "rounded-full border border-slate-200 bg-white px-2 py-0.5 text-right text-[10px] font-medium text-slate-600";
const WARNING_CHIP =
  "rounded-full border border-amber-700 bg-white px-2 py-0.5 text-right text-[10px] font-medium text-amber-700";

interface Props {
  parcelId: string;
  address?: string;
  result: ParcelOutput;
  /** TOD only: the parcel's regime, e.g. "IPD-T" or "PD-T: Not Applicable" */
  todLabel?: string;
  /** TOD only: the label is a warning (housing not applicable) */
  todWarning?: boolean;
  /** a caution about the scenario, e.g. parking below the legal minimum */
  warning?: string;
  /** opens the parcel's project details */
  onOpenSummary?: () => void;
  /** phones: level tags in a row, and the button kept in view */
  compact?: boolean;
}

// Levels come from the shared classifier — same rule as the map dots, the
// scenario chips and the calculator's viability panel.

const LEVEL = {
  poor: {
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    value: "text-rose-600",
    label: "Below Target",
    // the verdict card: a tint behind dark text, and a bold-bordered tag for
    // the level
    card: "bg-rose-50 border-rose-200",
    verdict: "text-rose-800",
    tag: "border-2 border-rose-700 bg-rose-50 px-[7px] py-px font-bold text-rose-700",
  },
  marginal: {
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    value: "text-amber-600",
    label: "Marginal",
    // the verdict card: a tint behind dark text, and a bold-bordered tag for
    // the level
    card: "bg-amber-50 border-amber-200",
    verdict: "text-amber-800",
    tag: "border-2 border-amber-700 bg-amber-50 px-[7px] py-px font-bold text-amber-700",
  },
  strong: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    value: "text-emerald-600",
    label: "Strong",
    // the verdict card: a tint behind dark text, and a bold-bordered tag for
    // the level
    card: "bg-emerald-50 border-emerald-200",
    verdict: "text-emerald-800",
    tag: "border-2 border-emerald-700 bg-emerald-50 px-[7px] py-px font-bold text-emerald-700",
  },
} as const;

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtPct(n: number, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`;
}

// ROC to 2 decimals so it can't round up to the benchmark it's scored against
// (6.59% shown as 6.6% next to a marginal bar)
const fmtRoc = (n: number) => fmtPct(n, 2);

// ── Sub-components ─────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  level,
  hint,
}: {
  label: string;
  value: string | null;
  level?: Level;
  hint: string;
}) {
  const valueClass = level ? LEVEL[level].value : "text-neutral-600";
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
          {label}
        </div>
        <div className="text-[9px] text-neutral-600">{hint}</div>
      </div>
      <span className={`text-sm font-bold tabular-nums ${valueClass}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function MetricCell({
  label,
  value,
  note,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  /** small qualifier under the value, e.g. how a figure was sized */
  note?: string;
  valueClass?: string;
}) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className={`mt-0.5 font-semibold tabular-nums ${valueClass}`}>
        {value}
      </dd>
      {note && <dd className="text-[10px] text-slate-500">{note}</dd>}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  );
}

// ── Verdict ────────────────────────────────────────────────────────────────

const verdictOf = (level: Level) =>
  level === "poor"
    ? "Does Not Pencil"
    : level === "strong"
      ? "Feasible"
      : "Possibly Feasible";

const strategyOf = (result: ParcelOutput) =>
  result.dev_strategy === "dev_flip"
    ? "Dev Flip at Stabilization"
    : `${result.dev_hold_years}-Year Hold Strategy`;

export function VerdictCard({
  result,
  row = false,
}: {
  result: ParcelOutput;
  /** the level tags in a row under the verdict instead of a column beside it */
  row?: boolean;
}) {
  const level = overallLevel(result);
  const styles = LEVEL[level];
  const verdictLabel = verdictOf(level);
  const strategyLabel = strategyOf(result);
  return (
    <div className={`rounded-xl border p-3 ${styles.card}`}>
      <div
        className={
          row ? "flex flex-col gap-2" : "flex items-center justify-between"
        }
      >
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
            Developer Feasibility
          </div>
          <div className={`mt-0.5 text-sm font-bold ${styles.verdict}`}>
            {verdictLabel}
          </div>
          <div className="text-[10px] text-slate-600">{strategyLabel}</div>
        </div>
        <div
          className={
            row ? "flex flex-wrap gap-1" : "flex flex-col items-end gap-1"
          }
        >
          {(["poor", "marginal", "strong"] as const).map((lvl) => (
            <div
              key={lvl}
              className={`rounded-full text-[10px] transition-all ${
                level === lvl
                  ? LEVEL[lvl].tag
                  : // white, so the levels not reached still read on the tint
                    "border border-slate-300 bg-white px-2 py-0.5 font-medium text-slate-500"
              }`}
            >
              {LEVEL[lvl].label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Key metrics — same set and thresholds as the calculator
export function FeasibilityMetrics({ result }: { result: ParcelOutput }) {
  const irr = isFinite(result.dev_levered_irr) ? result.dev_levered_irr : null;
  const roc = isFinite(result.dev_roc) ? result.dev_roc : null;
  const em = isFinite(result.dev_equity_multiple)
    ? result.dev_equity_multiple
    : null;
  const landPerSqft = landPricePerSqft(result);
  const ratio = rlvRatio(result);
  return (
    <div className="space-y-2.5">
      <MetricRow
        label="Return on Cost"
        value={roc !== null ? fmtRoc(roc) : null}
        level={
          roc !== null
            ? getLevel(roc, result.dev_target_roc - 0.01, result.dev_target_roc)
            : undefined
        }
        hint={`NOI ÷ dev cost, net of subsidy: benchmark ${fmtRoc(result.dev_target_roc)}`}
      />
      <MetricRow
        label="RLV vs. Land Price"
        value={ratio !== null ? `${(ratio * 100).toFixed(0)}%` : null}
        level={ratio !== null ? getLevel(ratio, 0.9, 1.1) : undefined}
        hint={`Supportable bid $${result.rlv_sqft.toFixed(0)}/sf vs market $${landPerSqft.toFixed(0)}/sf`}
      />
      <MetricRow
        label="Equity Multiple"
        value={em !== null ? `${em.toFixed(2)}×` : null}
        level={em !== null ? getLevel(em, 2.0, 2.5) : undefined}
        hint="Total cash returned ÷ equity, undiscounted: development benchmark ≥ 2.5×"
      />
      <MetricRow
        label="Levered IRR"
        value={irr !== null ? fmtPct(irr) : null}
        // matches irrLevel in feasim-challenge
        level={irr !== null ? getLevel(irr, 0.08, 0.12) : undefined}
        hint="Annualized return on equity over the hold: development target 12–18%"
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ParcelInfoOverlay({
  parcelId,
  address,
  result,
  todLabel,
  todWarning,
  warning,
  onOpenSummary,
  compact = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-2xl border border-white/60 p-4 backdrop-blur-xl backdrop-saturate-150 ${
        compact ? "bg-white/80 pb-0" : "bg-white/50"
      }`}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Selected Parcel
          </div>
          <div className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">
            {parcelId}
          </div>
          {address && <div className="text-sm text-slate-500">{address}</div>}
        </div>
        <div className="ml-3 flex flex-col items-end gap-1">
          {/* official name, e.g. "Apartment Precinct" rather than "Apart" */}
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-right text-[10px] font-medium text-slate-600">
            {zoneName(result.zone_class)}
          </span>
          {todLabel && (
            <span className={todWarning ? WARNING_CHIP : TAG_CHIP}>
              {todLabel}
            </span>
          )}
          {warning && <span className={WARNING_CHIP}>{warning}</span>}
        </div>
      </div>

      <VerdictCard result={result} row={compact} />

      {/* Quick stats */}
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <MetricCell
          label="Potential Units"
          value={result.max_units.toLocaleString()}
        />
        <MetricCell
          label="Project Timeline"
          value={`${result.total_months} mo`}
        />
      </div>

      {/* Financial breakdown, collapsed like the scenario card's */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[11px] font-medium text-slate-600 transition hover:text-slate-900"
      >
        <span>
          {expanded ? "Hide financial breakdown" : "Show financial breakdown"}
        </span>
        <Chevron open={expanded} />
      </button>

      {/* key metrics, same set and thresholds as the classifier */}
      {expanded && (
        <div className="mt-3 border-t border-slate-200/70 pt-3">
          <FeasibilityMetrics result={result} />
        </div>
      )}

      {/* on phones the button is pinned to the bottom of the scrolling card */}
      {onOpenSummary && (
        <div
          className={
            compact
              ? "sticky bottom-0 -mx-4 mt-3 rounded-b-2xl border-t border-slate-200/70 bg-white px-4 py-3"
              : ""
          }
        >
          <button
            type="button"
            data-tour="open-summary"
            onClick={onOpenSummary}
            className={`w-full rounded-lg bg-[#1D667F] px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-[#1D667F]/90 ${
              compact ? "" : "mt-3"
            }`}
          >
            {compact ? "Project details" : "View project details"}
          </button>
        </div>
      )}
    </div>
  );
}

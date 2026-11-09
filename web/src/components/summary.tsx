"use client";

import { useState } from "react";

interface SummaryOverlayProps {
  summary: {
    title: string;
    totalUnits: number;
    totalAffordableUnits: number;
    strongUnits: number;
    unitsDelta: number;
    strongUnitsDelta: number;
    avgRoc: number | null;
    avgTargetRoc: number | null;
    avgRlvRatio: number | null;
    avgEquityMultiple: number | null;
    avgLeveredIrr: number | null;
    pctStrong: number | null;
    pctMarginal: number | null;
    pctPoor: number | null;
    program: string;
  };
  /**
   * Small screens: a one-line bar of the region, unit total and level shares
   * that opens to the breakdown. The full card otherwise.
   */
  compact?: boolean;
  /** open state, when the parent folds it (e.g. as a parcel is tapped) */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

// same names as the program buttons (bill6 is current zoning, "Standard")
export const PROGRAM_LABEL: Record<string, string> = {
  bill6: "Standard ",
  standard: "Before Ord. 26-7 ",
  bill7: "Bill 7 ",
  tod: "TOD ",
  h201: "201H ",
};

function pct(v: number | null, decimals = 1) {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}

function fmt(v: number | null, decimals = 2, suffix = "") {
  if (v == null || !isFinite(v)) return "—";
  return `${v.toFixed(decimals)}${suffix}`;
}

function feasibilityColor(v: number | null) {
  if (v == null) return "text-neutral-600";
  if (v >= 0.5) return "text-emerald-600";
  if (v >= 0.25) return "text-amber-500";
  return "text-rose-500";
}

export function ScenarioSummaryOverlay({
  summary,
  compact = false,
  expanded: expandedProp,
  onExpandedChange,
}: SummaryOverlayProps) {
  const [expandedOwn, setExpandedOwn] = useState(false);
  const expanded = expandedProp ?? expandedOwn;
  const setExpanded = (next: boolean) => {
    setExpandedOwn(next);
    onExpandedChange?.(next);
  };

  const programLabel =
    PROGRAM_LABEL[summary.program] ?? summary.program.toUpperCase();

  if (compact) {
    return (
      <div className="rounded-2xl border border-white/60 bg-white/70 text-slate-900 shadow-sm backdrop-blur-xl backdrop-saturate-150">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-3 px-3 py-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-semibold tracking-tight">
                {summary.title}
              </span>
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                {programLabel}
              </span>
            </div>
            {/* the desktop card's two counts, each with its change */}
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 text-xs tabular-nums text-slate-500">
              <span>
                <span className="font-semibold text-slate-900">
                  {summary.totalUnits.toLocaleString()}
                </span>{" "}
                max potential units <Delta value={summary.unitsDelta} short />
              </span>
              <span>
                <span className="font-semibold text-slate-900">
                  {summary.strongUnits.toLocaleString()}
                </span>{" "}
                units pencil <Delta value={summary.strongUnitsDelta} short />
              </span>
            </div>
            {summary.pctStrong != null && (
              <div className="mt-0.5 flex gap-2 text-[11px] font-medium tabular-nums">
                <span className="text-emerald-700">
                  {pct(summary.pctStrong, 0)} strong
                </span>
                <span className="text-amber-700">
                  {pct(summary.pctMarginal, 0)} marginal
                </span>
                <span className="text-rose-700">
                  {pct(summary.pctPoor, 0)} below
                </span>
              </div>
            )}
          </div>
          <Chevron open={expanded} />
        </button>
        {expanded && (
          <div className="border-t border-slate-200/70 px-3 pb-2">
            <UnitSplit
              affordable={summary.totalAffordableUnits}
              market={summary.totalUnits - summary.totalAffordableUnits}
            />
            <Breakdown summary={summary} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="z-10 rounded-2xl border border-white/60 bg-white/60 p-4 text-slate-900 backdrop-blur-xl backdrop-saturate-150">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="text-lg font-semibold tracking-tight text-slate-900">
          {summary.title}
        </div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
          {programLabel}
        </div>
      </div>

      {/* Total units */}
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums text-slate-900">
          {summary.totalUnits.toLocaleString()}
        </div>
        <div className="text-xs text-slate-500">max potential units</div>
      </div>

      <Delta value={summary.unitsDelta} />

      {/* Units that pencil: on parcels rated Strong */}
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-semibold tabular-nums text-slate-900">
            {summary.strongUnits.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">units pencil</div>
        </div>
        <Delta value={summary.strongUnitsDelta} inline />
      </div>

      {/* Feasibility distribution pills */}
      {summary.pctStrong != null && (
        <div className="mt-3 flex flex-wrap gap-2 whitespace-nowrap">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            {pct(summary.pctStrong, 0)} strong
          </span>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            {pct(summary.pctMarginal, 0)} marginal
          </span>
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
            {pct(summary.pctPoor, 0)} below target
          </span>
        </div>
      )}

      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-3 flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-[11px] font-medium text-slate-600 transition hover:text-slate-900"
      >
        <span>
          {expanded ? "Hide scenario breakdown" : "Show scenario breakdown"}
        </span>
        <Chevron open={expanded} />
      </button>

      {/* Affordable vs. market units, then the metrics table */}
      {expanded && (
        <>
          <UnitSplit
            affordable={summary.totalAffordableUnits}
            market={summary.totalUnits - summary.totalAffordableUnits}
          />
          <Breakdown summary={summary} />
        </>
      )}
    </div>
  );
}

function Breakdown({ summary }: Pick<SummaryOverlayProps, "summary">) {
  return (
    <table className="mt-3 w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
          <th className="pb-2 font-medium">Metric</th>
          <th className="pb-2 text-right font-medium">Avg (all parcels)</th>
          <th className="pb-2 text-right font-medium">Target</th>
        </tr>
      </thead>
      <tbody className="tabular-nums text-slate-700">
        {/* Return on cost and RLV are what the feasibility call is based
                on, so they lead the breakdown — same order as the calculator's
                viability panel. */}
        <tr className="border-t border-slate-200/70">
          <td className="py-2 text-slate-500">Return on Cost</td>
          <td
            className={`py-2 text-right font-medium ${
              summary.avgRoc != null &&
              summary.avgTargetRoc != null &&
              summary.avgRoc >= summary.avgTargetRoc
                ? "text-emerald-600"
                : summary.avgRoc != null &&
                    summary.avgTargetRoc != null &&
                    summary.avgRoc >= summary.avgTargetRoc - 0.01
                  ? "text-amber-500"
                  : "text-rose-500"
            }`}
          >
            {pct(summary.avgRoc, 2)}
          </td>
          <td className="py-2 text-right text-neutral-600">
            {summary.avgTargetRoc != null
              ? `≥ ${pct(summary.avgTargetRoc, 2)}`
              : "—"}
          </td>
        </tr>
        <tr className="border-t border-slate-200/70">
          <td className="py-2 text-slate-500">RLV vs. Land Price</td>
          <td
            className={`py-2 text-right font-medium ${
              summary.avgRlvRatio != null && summary.avgRlvRatio >= 1.1
                ? "text-emerald-600"
                : summary.avgRlvRatio != null && summary.avgRlvRatio >= 0.9
                  ? "text-amber-500"
                  : "text-rose-500"
            }`}
          >
            {summary.avgRlvRatio != null
              ? `${(summary.avgRlvRatio * 100).toFixed(0)}%`
              : "—"}
          </td>
          <td className="py-2 text-right text-neutral-600">≥ 110%</td>
        </tr>
        <tr className="border-t border-slate-200/70">
          <td className="py-2 text-slate-500">Equity Multiple</td>
          <td
            className={`py-2 text-right font-medium ${
              summary.avgEquityMultiple != null &&
              summary.avgEquityMultiple >= 2.5
                ? "text-emerald-600"
                : summary.avgEquityMultiple != null &&
                    summary.avgEquityMultiple >= 2.0
                  ? "text-amber-500"
                  : "text-rose-500"
            }`}
          >
            {summary.avgEquityMultiple != null
              ? `${fmt(summary.avgEquityMultiple, 2)}×`
              : "—"}
          </td>
          <td className="py-2 text-right text-neutral-600">≥ 2.5×</td>
        </tr>
        {/* same thresholds as the parcel card (irrLevel in feasim-challenge) */}
        <tr className="border-t border-slate-200/70">
          <td className="py-2 text-slate-500">Levered IRR</td>
          <td
            className={`py-2 text-right font-medium ${
              summary.avgLeveredIrr != null && summary.avgLeveredIrr >= 0.12
                ? "text-emerald-600"
                : summary.avgLeveredIrr != null && summary.avgLeveredIrr >= 0.08
                  ? "text-amber-500"
                  : "text-rose-500"
            }`}
          >
            {pct(summary.avgLeveredIrr)}
          </td>
          <td className="py-2 text-right text-neutral-600">≥ 12%</td>
        </tr>
      </tbody>
    </table>
  );
}

// a unit count's change from the pathway's defaults; shown at zero too, so the
// card says what the number is measured against before any lever moves
function Delta({
  value,
  inline = false,
  short = false,
}: {
  value: number;
  inline?: boolean;
  /** just the change, inside a line of text (the summary bar) */
  short?: boolean;
}) {
  const rounded = Math.round(value);
  const tone =
    rounded > 0
      ? "text-emerald-600"
      : rounded < 0
        ? "text-rose-600"
        : "text-slate-500";
  const label =
    rounded > 0
      ? `▲ +${rounded.toLocaleString()}`
      : rounded < 0
        ? `▼ −${Math.abs(rounded).toLocaleString()}`
        : "±0";
  if (short) return <span className={`font-semibold ${tone}`}>{label}</span>;
  return (
    <div className={`${inline ? "" : "mt-0.5"} text-xs ${tone}`}>
      <span className="font-semibold tabular-nums">{label}</span>{" "}
      <span className="text-slate-500">vs. defaults</span>
    </div>
  );
}

// affordable and market units as a split bar; affordable takes the UHERO blue
export function UnitSplit({
  affordable,
  market,
}: {
  affordable: number;
  market: number;
}) {
  const total = affordable + market;
  const share = total > 0 ? affordable / total : 0;
  return (
    <div className="mt-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-300">
        <div className="bg-[#1D667F]" style={{ width: `${share * 100}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#1D667F]" />
          <span className="font-semibold tabular-nums text-slate-900">
            {affordable.toLocaleString()}
          </span>
          affordable ({pct(share, 0)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300" />
          <span className="font-semibold tabular-nums text-slate-900">
            {market.toLocaleString()}
          </span>
          market
        </span>
      </div>
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

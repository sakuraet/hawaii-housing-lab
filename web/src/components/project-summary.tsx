"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  zoneName,
  type ParcelOutput,
  type SoftCostBreakdown,
} from "feasim-challenge";

export interface ProjectSummaryProps {
  result: ParcelOutput;
  offeredBonus?: number;
  zonedHeight?: number;
  maxFar?: number;
}

// the model's construction loan fee (FINANCING.loan_fee); the package does not
// export it, and the loan principal is backed out of the outputs with it
const LOAN_FEE = 0.0075;

// the model's soft cost line items, grouped for the Uses of Funds dropdown;
// waived fees stay listed at $0
const SOFT_COST_GROUPS: [string, (keyof SoftCostBreakdown)[]][] = [
  ["Construction management", ["construction_mgmt"]],
  [
    "Permits & plan review",
    [
      "building_permit",
      "plan_review",
      "zoning_application",
      "special_district",
      "temp_occupancy",
    ],
  ],
  ["Environmental review", ["environmental"]],
  [
    "Site work permits & utility hookups",
    ["utilities", "escp", "grubbing", "grading", "stockpiling"],
  ],
  ["Wastewater charge", ["wastewater"]],
  ["Water (WSFC + meter)", ["wsfc", "water_meter"]],
  ["Impact & park fees", ["impact", "park_dedication"]],
];

function fmt(n: number, decimals = 0) {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

// whole dollars, with a minus sign for outflows
function usd(n: number) {
  const s = `$${Math.abs(Math.round(n)).toLocaleString()}`;
  return n < -0.5 ? `−${s}` : s;
}

function fmtDollars(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number, decimals = 1) {
  return `${(n * 100).toFixed(decimals)}%`;
}

// a share as a whole percent, or with one decimal when it is not whole
function pctLabel(n: number) {
  const p = n * 100;
  return `${Number.isInteger(Math.round(p * 10) / 10) ? p.toFixed(0) : p.toFixed(1)}%`;
}

export function ProjectSummary({
  result,
  offeredBonus = 0,
  zonedHeight,
  maxFar,
}: ProjectSummaryProps) {
  if (!result) return null;
  const r = result;
  const units = Math.max(r.max_units, 1);
  const rentalUnits = r.afd_rent_units + r.mkt_rent_units;
  const tdc = r.dev_total_dev_cost;

  // uses: hard cost carries a contingency, folded into dev_cost
  const contingency = r.dev_cost - r.hard_cost - r.soft_cost;

  // sources: the construction loan balance at stabilization is the principal
  // plus the interest capitalized on it during construction and lease-up; the
  // loan fee is paid from equity
  const loanPrincipal = Math.max(
    0,
    (r.loan_balance_at_stab - r.total_financing_cost) / (1 - LOAN_FEE)
  );
  const loanFee = loanPrincipal * LOAN_FEE;
  const capitalizedInterest = r.total_financing_cost - loanFee;

  // equity is spent on the land first, then pre-development, and the rest at
  // the construction loan closing (the loan funds whatever equity can't)
  const equityLand = Math.min(r.dev_land_cost, r.equity_amount);
  const equityPredev = Math.min(
    r.total_predev_cost,
    r.equity_amount - equityLand
  );
  const equityConstruction = r.equity_amount - equityLand - equityPredev;

  // residual land value: the residual at stabilization, discounted to the
  // land purchase at the developer's target return, plus each grant
  // discounted from the month it is paid
  const residual =
    r.gdv - r.rlv_selling_costs - r.rlv_project_cost - r.rlv_profit;
  const discountedResidual = r.rlv - r.rlv_grants_pv;
  const years = r.total_months / 12;
  const discountRate =
    r.rlv_land_carry > 0 && years > 0
      ? r.rlv_land_carry ** (1 / years) - 1
      : null;
  // pre-construction is paid over the construction months, post-construction
  // when construction ends
  const grantLabel =
    r.pre_construction_subsidy > 0
      ? "Pre-Construction Grant (paid over construction)"
      : "Post-Construction Grant (paid at completion)";
  const pwPremium = r.pw_premium_cost ?? 0;

  const vacancy = r.pgi - r.residential_egi;
  const otherIncome = r.pgi - r.pri;
  const hold = r.dev_strategy === "hold";
  const debtService = r.dev_annual_debt_svc ?? 0;

  return (
    <div className="space-y-3">
      {/* Per-unit headline figures */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          label="Cost / Unit"
          value={usd(tdc / units)}
          note={
            r.net_residential_sqft > 0
              ? `${usd(tdc / r.net_residential_sqft)} / net sqft`
              : undefined
          }
        />
        <Stat
          label="Value / Unit"
          value={usd(r.gdv / units)}
          note={tdc > 0 ? `${(r.gdv / tdc).toFixed(2)}× cost` : undefined}
        />
        <Stat
          label="Avg. Rent / Unit"
          value={rentalUnits > 0 ? usd(r.pri / 12 / rentalUnits) : "—"}
          suffix={rentalUnits > 0 ? "/mo" : undefined}
          note={`${fmt(r.max_units)} total units`}
        />
      </div>

      {/* Development Program */}
      <Section title="Development Program">
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Row label="Lot Size" value={`${fmt(r.lot_sqft)} sqft`} />
            <Row label="Zone Class" value={zoneName(r.zone_class)} />
            <Row
              label="Zoned Height"
              value={zonedHeight ? `${fmt(zonedHeight)} ft` : "—"}
            />
            <Row label="Height Limit" value={`${fmt(r.height_limit)} ft`} />
            <Row
              label="Built Height"
              value={`${fmt(r.built_height)} ft (${fmt(r.built_floors)} floors)`}
            />
            <Row
              label="FAR"
              value={maxFar !== undefined ? fmt(maxFar, 2) : "—"}
            />
          </div>
          <div className="space-y-1.5">
            <Row
              label="Ground-Floor Retail"
              value={
                r.net_commercial_sqft > 0
                  ? `${fmt(r.net_commercial_sqft)} sqft`
                  : "None"
              }
            />
            <Row
              label="Buildable Area"
              value={`${fmt(r.buildable_sqft)} sqft`}
            />
            <Row
              label="Net Residential Area"
              value={`${fmt(r.net_residential_sqft)} sqft`}
            />
            <Row
              label="Affordable Rental Units"
              value={fmt(r.afd_rent_units)}
            />
            <Row label="Market Rental Units" value={fmt(r.mkt_rent_units)} />
            <Row
              label="Open-Space Bonus"
              value={bonusLabel(offeredBonus, r.open_space_bonus ?? 0)}
            />
          </div>
        </div>
        <div className="mt-1.5 border-t border-slate-100 pt-1.5">
          <ParkingRows r={r} />
        </div>
      </Section>

      {/* Timeline */}
      <Section title="Timeline">
        <TimelineBar
          phases={[
            {
              label: "Permitting",
              months: r.permitting_months,
              color: "bg-slate-600",
            },
            {
              label: "Construction",
              months: r.const_months,
              color: "bg-blue-700",
            },
            {
              label: "Lease-up",
              months: r.total_carry_months,
              color: "bg-teal-700",
            },
          ]}
        />
        <Row
          label="Total to Stabilization"
          value={`${fmt(r.total_months)} mo (${years.toFixed(2)} yrs)`}
        />
      </Section>

      {/* Uses of Funds */}
      <MetricSection title="Uses of Funds" labelCol="Use">
        <Line
          label="Land Acquisition"
          values={withShare(r.dev_land_cost, units, tdc)}
        />
        {pwPremium > 0 ? (
          <Expandable
            label="Hard Costs"
            values={withShare(r.hard_cost, units, tdc)}
          >
            <Line
              sub
              label="Construction at market wages"
              values={withShare(r.hard_cost - pwPremium, units, tdc)}
            />
            <Line
              sub
              label="Prevailing wage premium (pre-construction grant)"
              values={withShare(pwPremium, units, tdc)}
            />
          </Expandable>
        ) : (
          <Line
            label="Hard Costs"
            values={withShare(r.hard_cost, units, tdc)}
          />
        )}
        <Line
          label={`Hard Cost Contingency (${pctLabel(contingency / Math.max(r.hard_cost, 1))})`}
          values={withShare(contingency, units, tdc)}
        />
        {r.soft_cost_breakdown ? (
          <Expandable
            label="Soft Costs"
            values={withShare(r.soft_cost, units, tdc)}
          >
            {SOFT_COST_GROUPS.map(([label, keys]) => {
              const amount = keys.reduce(
                (sum, k) => sum + r.soft_cost_breakdown![k],
                0
              );
              return (
                <Line
                  key={label}
                  sub
                  label={label}
                  values={withShare(amount, units, tdc)}
                />
              );
            })}
          </Expandable>
        ) : (
          <Line
            label="Soft Costs"
            values={withShare(r.soft_cost, units, tdc)}
          />
        )}
        <Expandable
          label="Financing Costs"
          values={withShare(r.total_financing_cost, units, tdc)}
        >
          <Line
            sub
            label={`Loan fee (${pctLabel(LOAN_FEE)}, paid in equity)`}
            values={withShare(loanFee, units, tdc)}
          />
          <Line
            sub
            label="Interest during construction & lease-up"
            values={withShare(capitalizedInterest, units, tdc)}
          />
        </Expandable>
        <Line
          total
          label="Total Development Cost"
          values={withShare(tdc, units, tdc)}
        />
      </MetricSection>

      {/* Sources of Funds */}
      <MetricSection
        title="Sources of Funds"
        labelCol="Source"
        caption={`Construction loan sized to ${
          r.dev_dscr_binds
            ? "the DSCR take-out (binding)"
            : `loan-to-cost (${fmtPct(r.dev_equity_pct_realized, 0)} equity)`
        }. Loan-to-cost ${fmtPct(
          loanPrincipal / Math.max(tdc - capitalizedInterest, 1),
          0
        )} excluding capitalized interest.`}
      >
        <Expandable
          label="Developer Equity (incl. land)"
          values={withShare(r.equity_amount, units, tdc)}
        >
          <Line
            sub
            label="Land purchase"
            values={withShare(equityLand, units, tdc)}
          />
          <Line
            sub
            label={`Pre-development (${fmt(r.permitting_months)} mo permitting)`}
            values={withShare(equityPredev, units, tdc)}
          />
          <Line
            sub
            label="Construction period equity (incl. loan fee)"
            values={withShare(equityConstruction, units, tdc)}
          />
        </Expandable>
        <Line
          label="Construction Loan"
          values={withShare(loanPrincipal, units, tdc)}
        />
        <Line
          label="Capitalized Interest (added to loan)"
          values={withShare(capitalizedInterest, units, tdc)}
        />
        <Line
          total
          label="Total Sources"
          values={withShare(
            r.equity_amount + loanPrincipal + capitalizedInterest,
            units,
            tdc
          )}
        />
        {/* paid back to the developer during construction, so it is not a
            source at closing */}
        {r.pre_construction_subsidy > 0 && (
          <Line
            memo
            label="Pre-construction grant, repaid to the developer over construction"
            values={withShare(r.pre_construction_subsidy, units, tdc)}
          />
        )}
      </MetricSection>

      {/* Exit: permanent loan take-out, or a sale */}
      {hold && r.dev_perm_principal != null ? (
        <Section title="Take-out at Stabilization" collapsible>
          <Row
            label={`Permanent Loan (${r.dev_perm_rate != null ? fmtPct(r.dev_perm_rate, 2) : "—"}${
              r.dev_dscr != null ? `, ${r.dev_dscr.toFixed(2)} DSCR` : ""
            }), repays the construction loan`}
            value={usd(r.dev_perm_principal)}
          />
          {r.pre_construction_subsidy > 0 && (
            <Row
              label="Pre-Construction Grant (paid over construction)"
              value={`+${usd(r.pre_construction_subsidy)}`}
              tone="pos"
            />
          )}
          {r.dev_post_grant > 0 && (
            <Row
              label="Post-Construction Grant (paid at completion)"
              value={`+${usd(r.dev_post_grant)}`}
              tone="pos"
            />
          )}
          <Row label="Annual Debt Service" value={usd(debtService)} />
        </Section>
      ) : (
        <Section title="Sale at Stabilization" collapsible>
          <Row label="Gross Development Value" value={usd(r.dev_gdv)} />
          <Row
            label="Selling Costs"
            value={usd(-r.dev_selling_costs)}
            tone="neg"
          />
          <Row
            label="Repays Construction Loan Balance"
            value={usd(-r.dev_loan_payoff)}
            tone="neg"
          />
          {r.pre_construction_subsidy > 0 && (
            <Row
              label="Pre-Construction Grant (paid over construction)"
              value={`+${usd(r.pre_construction_subsidy)}`}
              tone="pos"
            />
          )}
          {r.dev_post_grant > 0 && (
            <Row
              label="Post-Construction Grant (paid at completion)"
              value={`+${usd(r.dev_post_grant)}`}
              tone="pos"
            />
          )}
          <Row
            total
            label="Equity Returned at Sale"
            value={usd(r.dev_equity_out)}
          />
        </Section>
      )}

      {/* Stabilized Operations */}
      <MetricSection
        title="Stabilized Operations (Year 1)"
        labelCol="Line"
        metrics={["Annual", "Per Unit"]}
        collapsible
      >
        <Line label="Potential Rental Income" values={perUnit(r.pri, units)} />
        {otherIncome > 0.5 && (
          <Line
            label="Other Income (parking, application & renewal fees)"
            values={perUnit(otherIncome, units)}
          />
        )}
        <Line
          label="Vacancy & Credit Loss"
          values={perUnit(-vacancy, units)}
          tone="neg"
        />
        {r.retail_egi > 0 && (
          <Line
            label="Retail Income (after vacancy)"
            values={perUnit(r.retail_egi, units)}
          />
        )}
        <Line
          total
          label="Effective Gross Income"
          values={perUnit(r.egi, units)}
        />
        <Line
          label={`Operating Expenses (${r.egi > 0 ? pctLabel(r.operating_expenses / r.egi) : "—"} of EGI)`}
          values={perUnit(-r.operating_expenses, units)}
          tone="neg"
        />
        <Line
          label="Property Tax"
          values={perUnit(-r.property_tax, units)}
          tone="neg"
        />
        <Line
          total
          label="Net Operating Income"
          values={perUnit(r.noi, units)}
        />
        {hold && r.dev_annual_debt_svc != null && (
          <>
            <Line
              label="Debt Service"
              values={perUnit(-debtService, units)}
              tone="neg"
            />
            <Line
              total
              label="Cash Flow After Debt Service"
              values={perUnit(r.noi - debtService, units)}
            />
          </>
        )}
        <Line
          memo
          label={
            r.retail_egi > 0
              ? "Stabilized value (residential and retail capped separately)"
              : `Stabilized value (NOI ÷ ${fmtPct(r.cap_rate, 1)} cap)`
          }
          values={perUnit(r.gdv, units)}
        />
      </MetricSection>

      {/* Residual Land Value */}
      <Section
        title="Residual Land Value"
        collapsible
        caption={`Largest land price that still meets the ${
          r.rlv_project_cost > 0
            ? pctLabel(r.rlv_profit / r.rlv_project_cost)
            : "required"
        } profit margin. The loan finances construction only; the land is paid up front with equity.`}
      >
        <Table cols={["", ""]} narrow>
          <Line label="Stabilized Value" values={[usd(r.gdv)]} />
          <Line
            label={`Selling Costs (${r.gdv > 0 ? pctLabel(r.rlv_selling_costs / r.gdv) : "—"})`}
            values={[usd(-r.rlv_selling_costs)]}
            tone="neg"
          />
          <Line
            label={`Project Cost excl. Land (incl. ${fmtDollars(r.rlv_financing_cost)} financing)`}
            values={[usd(-r.rlv_project_cost)]}
            tone="neg"
          />
          <Line
            label={`Required Developer Profit${
              r.rlv_project_cost > 0
                ? ` (${pctLabel(r.rlv_profit / r.rlv_project_cost)})`
                : ""
            }`}
            values={[usd(-r.rlv_profit)]}
            tone="neg"
          />
          <Line
            total
            label="Residual at Stabilization"
            values={[usd(residual)]}
          />
          <Line
            label={`Discount to Land Purchase${
              discountRate != null
                ? ` (${fmtPct(discountRate, 1)}/yr × ${years.toFixed(2)} yrs)`
                : ""
            }`}
            values={[`÷ ${r.rlv_land_carry.toFixed(3)}`]}
          />
          <Line
            total
            label="Residual at Land Purchase"
            values={[usd(discountedResidual)]}
          />
          {/* each grant discounted from the month it is paid */}
          {r.rlv_grants_pv > 0 && (
            <Line
              label={`${grantLabel}, discounted`}
              values={[`+${usd(r.rlv_grants_pv)}`]}
              tone="pos"
            />
          )}
          <Line
            total
            label="Residual Land Value"
            values={[usd(r.rlv)]}
            tone={r.rlv >= 0 ? "pos" : "neg"}
          />
        </Table>
      </Section>
    </div>
  );
}

// a total with its per-unit amount and share of total development cost
function withShare(n: number, units: number, tdc: number) {
  return [usd(n), usd(n / units), tdc > 0 ? fmtPct(n / tdc, 1) : "—"];
}

function perUnit(n: number, units: number) {
  return [usd(n), usd(n / units)];
}

// Parking stalls, with a dropdown for where they go and the loading and
// bicycle parking that share the parking area
// whether the model took the zone's open-space FAR bonus (it keeps the
// project with or without it, whichever does better)
function bonusLabel(offered: number, taken: number) {
  const far = (v: number) => `+${Number(v.toFixed(2))} FAR`;
  if (taken > 0) return `Taken (${far(taken)})`;
  if (offered > 0) return "Not taken";
  return "None available";
}

function ParkingRows({ r }: { r: ParcelOutput }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
          Parking Stalls
          <Chevron open={open} />
        </span>
        <span className="shrink-0 text-xs font-semibold text-slate-900">
          {fmt(r.parking_stalls)}
        </span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5 border-l border-slate-200 pl-3">
          <Row
            label="Building Area Used for Parking"
            value={fmtPct(r.parking_share)}
          />
          <Row label="Surface Stalls" value={fmt(r.surface_stalls ?? 0)} />
          <Row
            label="Ground-Floor Stalls"
            value={fmt(r.ground_floor_stalls ?? 0)}
          />
          <Row label="Podium Stalls" value={fmt(r.podium_stalls ?? 0)} />
          <Row label="Podium Levels" value={fmt(r.podium_levels)} />
          <Row label="Loading Spaces" value={fmt(r.loading_spaces ?? 0)} />
          <Row
            label="Bicycle Spaces (short / long-term)"
            value={`${fmt(r.bicycle_short_term ?? 0)} / ${fmt(r.bicycle_long_term ?? 0)}`}
          />
        </div>
      )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4.5 L6 7.5 L9 4.5" />
    </svg>
  );
}

function Stat({
  label,
  value,
  suffix,
  note,
}: {
  label: string;
  value: string;
  suffix?: string;
  note?: string;
}) {
  return (
    // the figure shrinks with the tile, down to 12px, so a three-across row in
    // a phone's side panel still fits it; the suffix wraps under it if need be
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 [container-type:inline-size]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-[length:clamp(12px,19cqi,16px)] font-bold tabular-nums text-slate-900">
        {value}
        <wbr />
        {suffix && (
          <span className="text-[11px] font-medium text-slate-500">
            {suffix}
          </span>
        )}
      </p>
      {note && <p className="mt-0.5 text-[10px] text-slate-500">{note}</p>}
    </div>
  );
}

function TimelineBar({
  phases,
}: {
  phases: { label: string; months: number; color: string }[];
}) {
  const shown = phases.filter((p) => p.months > 0);
  return (
    <div className="flex h-6 overflow-hidden rounded text-[10px] font-semibold text-white">
      {shown.map((p) => (
        <div
          key={p.label}
          className={`flex min-w-0 items-center px-2 ${p.color}`}
          style={{ flex: `${p.months} 1 0` }}
          title={`${p.label}: ${p.months} mo`}
        >
          <span className="truncate">
            {p.label} {fmt(p.months)} mo
          </span>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  caption,
  action,
  collapsible = false,
  children,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
  // starts collapsed; the title toggles it
  collapsible?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!collapsible);
  const heading = (
    <p
      className={`text-xs font-semibold uppercase tracking-wide ${collapsible ? "" : "text-slate-500"}`}
    >
      {title}
    </p>
  );
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div
        className={`flex flex-wrap items-center justify-between gap-2 ${open ? "mb-2" : ""}`}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 text-slate-500 transition hover:text-slate-900"
          >
            {heading}
            <Chevron open={open} />
          </button>
        ) : (
          heading
        )}
        {open && action}
      </div>
      {open && (
        <>
          {caption && (
            <p className="-mt-1 mb-2 text-[11px] leading-snug text-slate-500">
              {caption}
            </p>
          )}
          <div className="space-y-1.5">{children}</div>
        </>
      )}
    </div>
  );
}

type Tone = "pos" | "neg";

const TONE: Record<Tone, string> = {
  pos: "text-green-600",
  neg: "text-red-600",
};

function Row({
  label,
  value,
  tone,
  total = false,
}: {
  label: string;
  value: string;
  tone?: Tone;
  total?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-2 ${
        total ? "border-t border-slate-300 pt-1.5" : ""
      }`}
    >
      <span
        className={`text-xs ${total ? "font-bold text-slate-900" : "text-slate-500"}`}
      >
        {label}
      </span>
      <span
        className={`shrink-0 text-xs tabular-nums ${total ? "font-bold" : "font-semibold"} ${
          tone ? TONE[tone] : "text-slate-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// a table of line items: a label column, then right-aligned figures
function Table({
  cols,
  narrow = false,
  children,
}: {
  cols: string[];
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role="table"
      className="text-xs tabular-nums"
      style={{
        ["--cols" as string]: narrow
          ? "minmax(0,1fr) auto"
          : gridCols(cols.length - 1),
      }}
    >
      {!narrow && (
        <div
          role="row"
          className="grid gap-x-2 border-b border-slate-200 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 [grid-template-columns:var(--cols)]"
        >
          {cols.map((c, i) => (
            <span
              key={c}
              role="columnheader"
              className={i > 0 ? "text-right" : ""}
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

// label column, then fixed figure columns: wide for totals, narrower for
// per-unit amounts and shares
function gridCols(figures: number) {
  if (figures === 1) return "minmax(0,1fr) 7rem";
  if (figures === 2) return "minmax(0,1fr) 6.5rem 5.5rem";
  return "minmax(0,1fr) 6.5rem 5.5rem 4rem";
}

function Line({
  label,
  values,
  tone,
  sub = false,
  total = false,
  memo = false,
}: {
  label: ReactNode;
  values: string[];
  tone?: Tone;
  sub?: boolean;
  total?: boolean;
  memo?: boolean;
}) {
  const metric = useContext(MetricContext);
  const shown = metric == null ? values : [values[metric]];
  const labelClass = total
    ? "font-bold text-slate-900"
    : sub
      ? "pl-4 text-[11px] text-slate-500"
      : memo
        ? "text-[11px] italic text-slate-600"
        : "font-medium text-slate-700";
  const valueClass = tone
    ? TONE[tone]
    : sub
      ? "text-slate-500"
      : memo
        ? "text-slate-600"
        : "text-slate-900";
  return (
    <div
      role="row"
      className={`grid items-baseline gap-x-2 [grid-template-columns:var(--cols)] ${
        total ? "border-t border-slate-300 pt-1.5" : ""
      } ${sub ? "py-0.5" : "py-1"}`}
    >
      <span role="cell" className={labelClass}>
        {label}
      </span>
      {shown.map((v, i) => (
        <span
          key={i}
          role="cell"
          className={`whitespace-nowrap text-right ${
            sub || memo
              ? "text-[11px] font-normal"
              : total
                ? "font-bold"
                : "font-semibold"
          } ${valueClass}`}
        >
          {v}
        </span>
      ))}
    </div>
  );
}

const FUNDS_METRICS = ["Total", "Per Unit", "% of TDC"];

// the figure a MetricSection shows: an index into each line's values
const MetricContext = createContext<number | null>(null);

// a funds table that shows one figure per line, picked with a toggle
function MetricSection({
  title,
  caption,
  labelCol,
  metrics = FUNDS_METRICS,
  collapsible = false,
  children,
}: {
  title: string;
  caption?: string;
  labelCol: string;
  metrics?: string[];
  collapsible?: boolean;
  children: ReactNode;
}) {
  const [metric, setMetric] = useState(0);
  return (
    <Section
      title={title}
      caption={caption}
      collapsible={collapsible}
      action={
        <div
          role="group"
          aria-label={`${title}: figure shown`}
          className="flex gap-1"
        >
          {/* same look as the pathway selector (ProgramSelector) */}
          {metrics.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(i)}
              aria-pressed={metric === i}
              className={`cursor-pointer rounded-md px-2 py-0.5 text-center text-[10px] font-semibold transition-colors ${
                metric === i
                  ? "border border-[#1D667F] bg-[#1D667F] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      }
    >
      <MetricContext.Provider value={metric}>
        <Table cols={[labelCol, metrics[metric]]}>{children}</Table>
      </MetricContext.Provider>
    </Section>
  );
}

// a line with detail rows under it, collapsed until its caret is clicked
function Expandable({
  label,
  values,
  children,
}: {
  label: string;
  values: string[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Line
        label={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1 text-left font-medium text-slate-700 transition hover:text-slate-900"
          >
            {label}
            <Chevron open={open} />
          </button>
        }
        values={values}
      />
      {open && children}
    </>
  );
}

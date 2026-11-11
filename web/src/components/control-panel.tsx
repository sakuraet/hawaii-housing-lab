"use client";

import { useState } from "react";
import type { ProgramId, TodTier } from "feasim-challenge";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SliderSlim as Slider } from "@/components/slider-slim";
import { PROGRAMS as CALCULATOR_PROGRAMS } from "@/localities/honolulu/pathways";
import { InfoTip } from "@/components/info-tip";
import { ProgramSelector } from "@/components/program-selector";
import { ToolbarButton } from "@/components/toolbar-button";
import { PolicyTour } from "@/components/tour/policy-tour";
import type { GaugeInputs } from "@/localities/honolulu/pathway-defaults";
import { COUNTIES, countyOf, type CountyId } from "@/localities/counties";

interface Props {
  inputs: GaugeInputs;
  onChange: React.Dispatch<React.SetStateAction<GaugeInputs>>;
  onReset?: () => void;
  onFactorChange?: <K extends keyof GaugeInputs>(
    key: K,
    value: GaugeInputs[K]
  ) => void;
  modified?: Partial<GaugeInputs>;
  defaults?: GaugeInputs;
  derived?: Partial<GaugeInputs>;
  /** TOD only: the entitlement tier PD-T and IPD-T parcels are built to */
  todTierPdt?: TodTier;
  onTodTierPdtChange?: (tier: TodTier) => void;
  todTierIpdt?: TodTier;
  onTodTierIpdtChange?: (tier: TodTier) => void;
  /** the county on the map */
  county: CountyId;
  onCountyChange: (county: CountyId) => void;
  /** a note under the county box, e.g. that its data isn't loaded yet */
  countyNote?: string;
  /** the tour was opened from the panel's header */
  onTourStart?: () => void;
  /** header text, for the full page */
  title?: string;
  subtitle?: string;
  description?: string;
  /** which tour the header launches */
  tour?: "gauge";
  /** hold off the first-visit tour, e.g. until the page has loaded */
  tourAutoStart?: boolean;
}

// lock state colours
const FACTOR_TEAL = "#4BACC6";
const FACTOR_ORANGE = "#F6A01B";

// same grouping as the development calculator
const CATEGORY_ORDER = [
  "Zoning & Development Standards",
  "Building Revenues & Costs",
  "Timing",
  "Advanced \u2014 Developer Financing",
] as const;

type Category = (typeof CATEGORY_ORDER)[number];

type SliderConfig = {
  key: keyof GaugeInputs;
  label: string;
  category: Category;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  // for sliders whose stored value is not the slider number itself
  // (AMI moves in whole percents but is stored as "ami_80")
  toStored?: (v: number) => GaugeInputs[keyof GaugeInputs];
  fromStored?: (v: unknown) => number;
};

type SelectConfig = {
  key: keyof GaugeInputs;
  label: string;
  type: "select";
  options: { value: string; label: string }[];
};

// Boolean toggle stored as string "true"/"false" in the config;
// the ControlPanel's `set` call converts back to boolean.
type BoolToggleConfig = {
  key: keyof GaugeInputs;
  label: string;
  type: "toggle";
  onLabel: string;
  offLabel: string;
};

type FactorConfig = SliderConfig | SelectConfig | BoolToggleConfig;

// =========================================================
// SHARED FACTOR BLOCKS
//
// Keys and ranges are the development calculator's SliderInputs the gauge
// runs the same pro forma, so it exposes the same levers.
// =========================================================

// a change to each parcel's own limit: Baseline, +10 ft, -10 ft
const formatChange = (v: number, decimals: number, unit = "") => {
  const size = Math.abs(v).toFixed(decimals);
  if (Number(size) === 0) return "Baseline";
  return `${v > 0 ? "+" : "-"}${size}${unit}`;
};

const ZONING_FACTORS: FactorConfig[] = [
  {
    key: "height_delta",
    category: "Zoning & Development Standards",
    label: "Max Height",
    min: -150,
    max: 450,
    step: 10,
    format: (v) => formatChange(v, 0, " ft"),
  },
  {
    key: "far_delta",
    category: "Zoning & Development Standards",
    label: "Max FAR",
    min: -2,
    max: 6,
    step: 0.1,
    format: (v) => formatChange(v, 1),
  },
  {
    key: "setback",
    category: "Zoning & Development Standards",
    label: "Setbacks",
    min: 0,
    max: 25,
    step: 5,
    format: (v) => `${v} ft`,
  },
  {
    key: "parking_ratio",
    category: "Zoning & Development Standards",
    label: "Parking (stalls per unit)",
    min: 0,
    // up to 3: Kauaʻi's minimum is 2, and Maui's 3 for four bedrooms
    max: 3,
    step: 0.05,
    format: (v) => `${Number(v.toFixed(2))}/unit`,
  },
];

const amiToKey = (v: number) => `ami_${v}` as GaugeInputs["affordable_ami"];
const amiFromKey = (v: unknown) =>
  Number(String(v ?? "ami_80").replace("ami_", ""));

const UNIT_MIX_FACTOR: FactorConfig = {
  key: "unit_type",
  label: "Unit Mix",
  type: "select",
  options: [
    { value: "studio_100", label: "100% studio" },
    { value: "studio75_1br25", label: "75% studio, 25% 1BR" },
    { value: "studio50_1br50", label: "50% studio, 50% 1BR" },
    { value: "studio25_1br75", label: "25% studio, 75% 1BR" },
    { value: "one_bb_100", label: "100% 1BR" },
    { value: "one_br50_2br50", label: "50% 1BR, 50% 2BR" },
    { value: "two_bb_100", label: "100% 2BR" },
    { value: "third_each", label: "33% each studio/1BR/2BR" },
  ],
};

const AMI_FACTORS: FactorConfig[] = [
  {
    key: "affordable_ami",
    category: "Building Revenues & Costs",
    label: "Affordable Unit Rent (AMI)",
    min: 30,
    max: 140,
    step: 10,
    format: (v) => `${v}% AMI`,
    toStored: amiToKey,
    fromStored: amiFromKey,
  },
  {
    key: "market_ami",
    category: "Building Revenues & Costs",
    label: "Market Unit Rent (AMI)",
    min: 60,
    max: 180,
    step: 10,
    format: (v) => `${v}% AMI`,
    toStored: amiToKey,
    fromStored: amiFromKey,
  },
];

const REVENUE_COST_FACTORS: FactorConfig[] = [
  {
    key: "hard_cost_per_sqft",
    category: "Building Revenues & Costs",
    label: "Hard Costs ($/sqft)",
    min: 200,
    max: 650,
    step: 10,
    format: (v) => `$${v}/sf`,
  },
  {
    key: "land_cost",
    category: "Building Revenues & Costs",
    label: "Land Acquisition Cost ($/sqft)",
    min: 50,
    max: 500,
    step: 10,
    format: (v) => `$${v}/sf`,
  },
  {
    key: "opex_ratio",
    category: "Building Revenues & Costs",
    label: "Operating Expense Ratio",
    min: 0.1,
    max: 0.5,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
];

const RETAIL_FACTORS: FactorConfig[] = [
  {
    key: "include_retail",
    label: "Use Mix",
    type: "toggle",
    offLabel: "Housing only",
    onLabel: "Ground floor retail",
  },
  {
    key: "retail_rent",
    category: "Building Revenues & Costs",
    label: "Retail Rent ($/sqft/mo)",
    min: 1,
    max: 15,
    step: 0.5,
    format: (v) => `$${v}/sf`,
  },
  {
    key: "retail_share",
    category: "Zoning & Development Standards",
    label: "Ground-Floor Retail (% of floor)",
    min: 0,
    max: 0.5,
    step: 0.05,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
];

const FEE_FACTORS: FactorConfig[] = [
  {
    key: "waivable_fee_basis",
    label: "Impact Fees",
    type: "select",
    // Controls wastewater, building permit, plan review, BWS WSFC and water
    // meter fees; affordable units are exempt under ROH 43-10.8 and ROH
    // 18-6.5(i). School impact fees (HRS Ch. 302A) are a state assessment and
    // are not affected. Same key,
    // options and order as Waivable_Fee_Basis in the calculator.
    options: [
      { value: "market_units", label: "Market Units Only" },
      { value: "all_units", label: "All" },
      { value: "none", label: "Exempt" },
    ],
  },
  {
    key: "park",
    label: "Park Dedication",
    type: "select",
    options: [
      { value: "exempt", label: "Exempt" },
      { value: "in_lieu", label: "In-lieu fee" },
    ],
  },
];

const TIMING_FACTORS: FactorConfig[] = [
  {
    key: "permitting_months",
    category: "Timing",
    label: "Permitting Time",
    min: 2,
    max: 36,
    step: 1,
    format: (v) => `${v} mo`,
  },
  {
    key: "const_months",
    category: "Timing",
    label: "Construction Time",
    min: 6,
    max: 36,
    step: 1,
    format: (v) => `${v} mo`,
  },
  {
    key: "leaseup_months",
    category: "Timing",
    label: "Lease-up Time",
    min: 3,
    max: 24,
    step: 1,
    format: (v) => `${v} mo`,
  },
  {
    key: "hold_years",
    category: "Timing",
    label: "Hold Years",
    min: 0,
    max: 20,
    step: 1,
    format: (v) => (v === 0 ? "Dev Flip" : `Hold ${v} yrs`),
  },
];

const FINANCE_FACTORS: FactorConfig[] = [
  {
    key: "cap_rate",
    category: "Advanced \u2014 Developer Financing",
    label: "Market Cap Rate",
    min: 0.035,
    max: 0.09,
    step: 0.001,
    format: (v) => `${(v * 100).toFixed(2)}%`,
  },
  {
    key: "equity",
    category: "Advanced \u2014 Developer Financing",
    label: "Developer Equity",
    min: 0.05,
    max: 0.6,
    step: 0.05,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  {
    key: "permanent_rate",
    category: "Advanced \u2014 Developer Financing",
    label: "Permanent Loan Rate",
    min: 0.02,
    max: 0.1,
    step: 0.0025,
    format: (v) => `${(v * 100).toFixed(2)}%`,
  },
  {
    key: "amort_years",
    category: "Advanced \u2014 Developer Financing",
    label: "Amortization",
    min: 15,
    max: 40,
    step: 5,
    format: (v) => `${v} yrs`,
  },
  {
    key: "min_dscr",
    category: "Advanced \u2014 Developer Financing",
    label: "Minimum DSCR",
    min: 1,
    max: 1.5,
    step: 0.05,
    format: (v) => `${v.toFixed(2)}x`,
  },
  {
    key: "target_return",
    category: "Advanced \u2014 Developer Financing",
    label: "Target Return",
    min: 0.06,
    max: 0.16,
    step: 0.005,
    format: (v) => `${(v * 100).toFixed(1)}%`,
  },
];

// =========================================================
// PER-PROGRAM FACTORS
// =========================================================

// Bill 7: affordable share and park dedication are statutory, not levers.
const BILL7_FACTORS: FactorConfig[] = [
  ...ZONING_FACTORS,
  UNIT_MIX_FACTOR,
  ...AMI_FACTORS,
  ...REVENUE_COST_FACTORS,
  ...RETAIL_FACTORS,
  // Bill 7 waives the city fees and park dedication (ROH 43-10.8), so both
  // default to Exempt; switching either on charges it, to show what the
  // waiver is worth. Same toggles as the calculator.
  ...FEE_FACTORS,
  {
    key: "grant_type",
    label: "Grant Type",
    type: "select",
    options: [
      { value: "none", label: "No grant" },
      { value: "post_construct", label: "Post-construction" },
      { value: "pre_construct", label: "Pre-construction" },
    ],
  },
  {
    key: "grant_amount",
    category: "Building Revenues & Costs",
    // post-construction pays affordable units, pre-construction every unit
    label: "Grant Amount (per eligible unit)",
    min: 0,
    max: 60000,
    step: 1000,
    format: (v) => `$${(v / 1000).toFixed(0)}k/unit`,
  },
  ...TIMING_FACTORS,
  ...FINANCE_FACTORS,
];

// Standard and Before Ord. 26-7 are modelled 100% rental, so the Chapter 29
// affordability requirement never triggers and there are no affordable units
// to price — market rent only. Matches STANDARD_FACTORS in the calculator.
const MARKET_AMI_ONLY = AMI_FACTORS.filter(
  (f) => f.key === "market_ami"
) as FactorConfig[];

const STANDARD_FACTORS: FactorConfig[] = [
  ...ZONING_FACTORS,
  UNIT_MIX_FACTOR,
  ...MARKET_AMI_ONLY,
  ...REVENUE_COST_FACTORS,
  ...RETAIL_FACTORS,
  ...FEE_FACTORS,
  ...TIMING_FACTORS,
  ...FINANCE_FACTORS,
];

const TOD_FACTORS: FactorConfig[] = [...STANDARD_FACTORS];

// Bill 6 runs the Standard pathway's lever set
const BILL6_FACTORS: FactorConfig[] = [...STANDARD_FACTORS];

const H201_FACTORS: FactorConfig[] = [
  ...ZONING_FACTORS,
  UNIT_MIX_FACTOR,
  ...AMI_FACTORS,
  {
    key: "affordability",
    category: "Building Revenues & Costs",
    // 201H needs at least 50% + 1 of units affordable, as in the calculator
    label: "Affordability %",
    min: 0.51,
    max: 1,
    step: 0.01,
    format: (v) => `${(v * 100).toFixed(0)}%`,
  },
  ...REVENUE_COST_FACTORS,
  ...RETAIL_FACTORS,
  ...FEE_FACTORS,
  ...TIMING_FACTORS,
  ...FINANCE_FACTORS,
];

// =========================================================
// PROGRAM REGISTRY
// =========================================================

// Labels and order match the development calculator's PROGRAMS registry:
// `bill6` is the Standard Development Pathway, `standard` is the pre-Ord. 26-7
// baseline. Same names in both tools.
const PROGRAMS = [
  { id: "bill6", label: "Standard", ready: true },
  { id: "bill7", label: "Bill 7", ready: true },
  { id: "tod", label: "TOD", ready: true },
  { id: "h201", label: "201H", ready: true },
  { id: "standard", label: "Before Ord. 26-7", ready: true },
] as const;

const PROGRAM_FACTORS: Record<string, FactorConfig[]> = {
  bill6: BILL6_FACTORS,
  bill7: BILL7_FACTORS,
  standard: STANDARD_FACTORS,
  tod: TOD_FACTORS,
  h201: H201_FACTORS,
};

/**
 * Levers a program actually renders.
 *
 * Used to decide which of the user's locks a pathway re-applies, and which
 * ones the "N locked" badge counts. Gate on this rather than on the defaults
 * object: a key can exist in a program's defaults without being exposed as a
 * lever (impact_fee is in the Standard defaults but is not a Bill 7 factor).
 *
 * Locks are never discarded on a switch — one set in Bill 7 lies dormant in
 * TOD and comes back on return, same as the development calculator.
 */
export function factorKeysFor(program: string): Set<keyof GaugeInputs> {
  return new Set((PROGRAM_FACTORS[program] ?? []).map((f) => f.key));
}

// =========================================================
// LEVER DESCRIPTIONS
//
// The info-tip text is the development calculator's own (chartDescription),
// so the two tools explain a lever the same way and there is one copy to edit
// =========================================================

const CALCULATOR_FACTOR_KEY: Partial<Record<keyof GaugeInputs, string>> = {
  unit_type: "Unit_Type",
  affordable_ami: "Affordability_Level",
  market_ami: "Market_AMI",
  include_retail: "Retail",
  retail_rent: "Retail_Rent",
  retail_share: "Retail_Share",
  parking_ratio: "Parking_Ratio",
  building_area_per_unit: "Building_Area_Per_Unit",
  grant_type: "Grant_Type",
  grant_amount: "Grant_Amount",
  affordability: "Affordability",
  hard_cost_per_sqft: "Hard_Cost",
  land_cost: "Land_Cost",
  opex_ratio: "Opex_Ratio",
  waivable_fee_basis: "Waivable_Fee_Basis",
  park: "Park",
  setback: "Setbacks",
  floor_height: "Floor_Height",
  permitting_months: "Permitting_Months",
  const_months: "Const_Months",
  leaseup_months: "Leaseup_Months",
  hold_years: "Hold_Years",
  cap_rate: "Cap_Rate",
  equity: "Equity",
  permanent_rate: "Permanent_Rate",
  amort_years: "Amortization",
  min_dscr: "Min_DSCR",
  target_return: "Total_Project_Target_Return",
};

// the calculator's TOD tier toggle: same options and description
const TOD_TIER_FACTOR = CALCULATOR_PROGRAMS.find(
  (p) => p.id === "tod"
)?.factors.find((f) => f.key === "TOD_Tier");

// the tier options each regime offers; special district permits are PD-T only
const tierOptions = (regime: "pdt" | "ipdt") =>
  (TOD_TIER_FACTOR?.toggleOptions ?? [])
    .filter(
      (o) =>
        regime === "pdt" || o.value === "base" || o.value === "with_benefits"
    )
    .map((o) => ({
      value: String(o.value),
      label:
        o.value === "with_benefits"
          ? regime === "pdt"
            ? "PD-T Approval"
            : "IPD-T Approval"
          : o.label,
    }));
const PDT_TIER_OPTIONS = tierOptions("pdt");
const IPDT_TIER_OPTIONS = tierOptions("ipdt");
const PDT_TIER_INFO =
  "Base: underlying zoning. Minor / Major Permit: FAR 3.5 in B-2 and BMX-3, else 1.2x base; height +60 / +120 ft, up to the map's bonus height. PD-T Approval: FAR 7.0 or 2x base, up to the map's bonus height. Above Base, community benefits are not priced.";
const IPDT_TIER_INFO =
  "Base: underlying zoning plus the open-space bonus. IPD-T Approval: 2x FAR (max 7.5) and height (max 450 ft), or the station plan's; needs a 20,000 sqft lot. Community benefits are not priced.";

// the citywide view's own levers, which the calculator doesn't have
const GAUGE_LEVER_INFO: Partial<Record<keyof GaugeInputs, string>> = {
  height_delta:
    "Raises or lowers every parcel's own height limit by the same amount. Baseline is the limit the pathway gives each parcel, which for Bill 7 is the lower of its zoned height and 60 ft. A parcel pushed to 0 ft or below builds nothing.",
  far_delta:
    "Raises or lowers every parcel's own FAR by the same amount. Baseline is the FAR the pathway gives each parcel. A parcel pushed to 0 or below builds nothing.",
};

// the parking lever in the other counties: each county's own minimum, which
// the lever follows until it is moved (Honolulu's text is the calculator's)
const PLACEMENT =
  "Stalls fill a surface lot first, then the ground floor and podium floors, which count toward height but not FAR.";
const COUNTY_PARKING_INFO: Partial<Record<CountyId, string>> = {
  "hi-maui": `Stalls per unit. Defaults to Maui's minimum for the unit mix: 1 stall per studio or one-bedroom, 2 per two- or three-bedroom, 3 per four-bedroom (MCC 19.36B.020, as amended by Ord. 5983), so 1 for all studios. ${PLACEMENT}`,
  "hi-hawaii": `Stalls per unit. Defaults to Hawaiʻi County's minimum: 1.25 stalls per multiple-family unit, whatever its size (HCC 25-4-51). ${PLACEMENT}`,
  "hi-kauai": `Stalls per unit. Defaults to Kauaʻi's minimum: 2 stalls per unit, whatever its size (CZO 8-4.5). ${PLACEMENT}`,
};

// The calculator's description of a lever. Some differ by pathway (the AMI
// lever cites each program's own rules), so the pathway's own text wins
function leverDescription(
  program: string,
  county: CountyId,
  key: keyof GaugeInputs
): string | undefined {
  if (GAUGE_LEVER_INFO[key]) return GAUGE_LEVER_INFO[key];
  if (key === "parking_ratio" && COUNTY_PARKING_INFO[county])
    return COUNTY_PARKING_INFO[county];
  const factorKey = CALCULATOR_FACTOR_KEY[key];
  if (!factorKey) return undefined;
  const describe = (p: (typeof CALCULATOR_PROGRAMS)[number] | undefined) =>
    p?.factors.find((f) => f.key === factorKey)?.chartDescription;
  return (
    describe(CALCULATOR_PROGRAMS.find((p) => p.id === program)) ??
    CALCULATOR_PROGRAMS.map(describe).find(Boolean)
  );
}

// =========================================================
// SUB-COMPONENTS
// =========================================================

function SliderRow({
  config,
  value,
  onChange,
  locked = false,
  onUnlock,
  info,
}: {
  config: SliderConfig;
  /**
   * Undefined for a lever with no program default (Cap Rate) until there is a
   * selected parcel to read its value from
   */
  value: number | undefined;
  onChange: (v: number) => void;
  locked?: boolean;
  onUnlock?: () => void;
  info?: string;
}) {
  // position of an in-progress drag, not yet committed to the actual value
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  // nothing to show yet: a dash, and a parked slider that can't be moved
  const ready = shown !== undefined && Number.isFinite(shown);

  return (
    <div data-tour={`lever-${String(config.key)}`} className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-600">
            {config.label}
          </span>
          {info && <InfoTip title={config.label} text={info} />}
        </span>
        <span className="flex items-center gap-1">
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: locked ? FACTOR_ORANGE : "#1D667F" }}
          >
            {ready ? config.format(shown) : "—"}
          </span>
          {/* The gauge has no factor chart to read the default off, so a
              locked lever needs an explicit way back. Snapping to the default
              also clears the lock, since setFactor drops keys at default. */}
          {locked && onUnlock && (
            <button
              type="button"
              onClick={onUnlock}
              title="Unlock and return to the program default"
              aria-label={`Unlock ${config.label} and return to the program default`}
              className="flex size-3.5 items-center justify-center rounded-sm text-[11px] leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              &times;
            </button>
          )}
        </span>
      </div>
      <Slider
        value={[ready ? shown : config.min]}
        disabled={!ready}
        onValueChange={(vals) => setDraft(vals[0])}
        onValueCommit={(vals) => {
          setDraft(null);
          onChange(vals[0]);
        }}
        min={config.min}
        max={config.max}
        step={config.step}
        className="w-full"
      />
    </div>
  );
}

// One compact dropdown per option, laid out in a single row — mirrors the
// toggle strip at the top of the development calculator.
function OptionSelect({
  label,
  value,
  options,
  onChange,
  locked = false,
  info,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  locked?: boolean;
  info?: string;
}) {
  const tone = locked ? FACTOR_ORANGE : FACTOR_TEAL;
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        {info && <InfoTip title={label} text={info} />}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="h-6 w-auto gap-0.5 px-2 py-0 text-[11px] font-medium focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            borderColor: tone,
            color: tone,
            backgroundColor: tone + "14",
          }}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[1300]">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              className="text-[11px]"
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// =========================================================
// MAIN COMPONENT
// =========================================================

export function ControlPanel({
  inputs,
  onChange,
  onReset,
  onFactorChange,
  modified,
  defaults,
  derived,
  todTierPdt,
  onTodTierPdtChange,
  todTierIpdt,
  onTodTierIpdtChange,
  onTourStart,
  county,
  onCountyChange,
  countyNote,
  title = "Citywide View",
  subtitle,
  description = `Adjust policy levers to see how they affect residential development feasibility across ${countyOf(county).label} parcels.`,
  tour = "gauge",
  tourAutoStart = true,
}: Props) {
  const factors = PROGRAM_FACTORS[inputs.program] ?? [];
  const isLocked = (key: keyof GaugeInputs) => modified?.[key] !== undefined;
  // Locks persist across pathway switches, so `modified` can hold levers this
  // pathway does not render. Count only the visible ones, or the badge would
  // claim more locks than there are orange levers on screen.
  const lockCount = modified
    ? Object.keys(modified).filter((key) =>
        factorKeysFor(inputs.program).has(key as keyof GaugeInputs)
      ).length
    : 0;

  function set<K extends keyof GaugeInputs>(key: K, value: GaugeInputs[K]) {
    // `program` is not a lever and must never be locked: it has to go through
    // onChange so the dashboard rebuilds that pathway's defaults and re-applies
    // the surviving locks. Everything else is a lever and routes to the
    // key-aware handler.
    if (key !== "program" && onFactorChange) onFactorChange(key, value);
    else onChange((prev) => ({ ...prev, [key]: value }));
  }

  // Returning a lever to its program default clears the lock, because
  // setFactor drops any key whose value equals the default.
  function unlock<K extends keyof GaugeInputs>(key: K) {
    if (!defaults) return;
    set(key, defaults[key]);
  }

  // selects and boolean toggles share one options row; sliders group by category
  const optionFactors = factors.filter(
    (f): f is SelectConfig | BoolToggleConfig => "type" in f
  );
  // retail rent and share only apply with retail on, as in the calculator
  const sliderFactors = factors.filter(
    (f): f is SliderConfig =>
      !("type" in f) &&
      !(
        (f.key === "retail_rent" || f.key === "retail_share") &&
        !inputs.include_retail
      )
  );
  const sliderGroups = CATEGORY_ORDER.map((category) => ({
    category,
    items: sliderFactors.filter((f) => f.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="relative flex h-full flex-col overflow-y-auto bg-white">
      {/* Header */}
      <div className="relative min-h-[220px] shrink-0 px-6 pb-10 pt-8 sm:min-h-[250px] sm:px-8 sm:pb-12 sm:pt-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(12,26,44,0.85),rgba(30,64,88,0.6))]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(to_bottom,transparent,rgb(255,255,255))]" />

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white sm:text-2xl">
                {title}
              </h1>
              {subtitle && (
                <div className="mt-0.5 text-sm text-slate-200">{subtitle}</div>
              )}
            </div>
            <PolicyTour
              view={tour}
              onStart={onTourStart}
              autoStart={tourAutoStart}
            />
          </div>
          <p className="mb-3 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {description}
          </p>
          <div className="flex flex-col gap-3">
            <ProgramSelector
              label="County"
              tourId="county-selector"
              programs={COUNTIES}
              value={county}
              onChange={onCountyChange}
              note={countyNote}
            />
            {/* the pathways are Honolulu ordinances */}
            {county === "hi-honolulu" && (
              <ProgramSelector
                programs={PROGRAMS}
                value={inputs.program}
                onChange={(id) => set("program", id as ProgramId)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Policy levers */}
      <div className="z-10 -mt-4 space-y-4 px-6 pb-8 sm:px-8">
        {factors.length > 0 ? (
          <div
            data-tour="levers"
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            {/* each label stays on one line. Phones get a short reset label so
                the row still fits once the lock badge appears, rather than
                the button jumping to a second line mid-drag */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex items-center gap-2">
                <div className="whitespace-nowrap text-[10px] font-semibold uppercase leading-none tracking-[0.18em] text-slate-500">
                  Policy Levers
                </div>
                {lockCount > 0 && (
                  <span
                    className="whitespace-nowrap rounded-sm px-1.5 py-1 text-[10px] font-semibold leading-none"
                    style={{
                      color: FACTOR_ORANGE,
                      backgroundColor: FACTOR_ORANGE + "14",
                    }}
                    title="Locked levers keep their value when you switch pathways"
                  >
                    {lockCount} locked
                  </span>
                )}
              </div>
              {onReset && (
                <ToolbarButton
                  data-tour="reset"
                  onClick={onReset}
                  className="whitespace-nowrap text-[10px]"
                  aria-label="Reset to defaults"
                >
                  <span className="sm:hidden">Reset</span>
                  <span className="max-sm:hidden">Reset to defaults</span>
                </ToolbarButton>
              )}
            </div>

            {/* Options — one row of dropdowns */}
            {optionFactors.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                {inputs.program === "tod" && onTodTierPdtChange && (
                  <OptionSelect
                    label="PD-T Standard"
                    value={todTierPdt ?? "base"}
                    info={PDT_TIER_INFO}
                    options={PDT_TIER_OPTIONS}
                    onChange={(v) => onTodTierPdtChange(v as TodTier)}
                  />
                )}
                {inputs.program === "tod" && onTodTierIpdtChange && (
                  <OptionSelect
                    label="IPD-T Standard"
                    value={todTierIpdt ?? "base"}
                    info={IPDT_TIER_INFO}
                    options={IPDT_TIER_OPTIONS}
                    onChange={(v) => onTodTierIpdtChange(v as TodTier)}
                  />
                )}
                {optionFactors.map((factor) =>
                  factor.type === "toggle" ? (
                    <OptionSelect
                      key={String(factor.key)}
                      label={factor.label}
                      value={inputs[factor.key] ? "true" : "false"}
                      locked={isLocked(factor.key)}
                      info={leverDescription(inputs.program, county, factor.key)}
                      options={[
                        { value: "false", label: factor.offLabel },
                        { value: "true", label: factor.onLabel },
                      ]}
                      onChange={(v) =>
                        set(
                          factor.key,
                          (v === "true") as GaugeInputs[typeof factor.key]
                        )
                      }
                    />
                  ) : (
                    <OptionSelect
                      key={String(factor.key)}
                      label={factor.label}
                      value={String(inputs[factor.key] ?? "")}
                      locked={isLocked(factor.key)}
                      info={leverDescription(inputs.program, county, factor.key)}
                      options={factor.options}
                      onChange={(v) =>
                        set(factor.key, v as GaugeInputs[typeof factor.key])
                      }
                    />
                  )
                )}

                {/* Lock/unlock colour legend, same as the calculator's */}
                {modified && (
                  <div
                    data-tour="lock-legend"
                    className="ml-auto flex items-center gap-2 text-[11px]"
                  >
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ backgroundColor: FACTOR_ORANGE }}
                      />
                      <span className="text-slate-600">Locked</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span
                        className="inline-block size-2.5 rounded-sm"
                        style={{ backgroundColor: FACTOR_TEAL }}
                      />
                      <span className="text-slate-600">Unlocked</span>
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Sliders, grouped the way the calculator groups them */}
            {sliderGroups.map((group) => (
              <div key={group.category} className="mb-4 last:mb-0">
                <div className="mb-2 border-b border-slate-200 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {group.category}
                </div>
                {group.items.map((slider) => (
                  <SliderRow
                    key={String(slider.key)}
                    config={slider}
                    value={
                      slider.fromStored
                        ? slider.fromStored(inputs[slider.key])
                        : ((inputs[slider.key] ?? derived?.[slider.key]) as
                            number | undefined)
                    }
                    locked={isLocked(slider.key)}
                    onUnlock={defaults ? () => unlock(slider.key) : undefined}
                    info={leverDescription(inputs.program, county, slider.key)}
                    onChange={(v) =>
                      set(
                        slider.key,
                        (slider.toStored
                          ? slider.toStored(v)
                          : v) as GaugeInputs[typeof slider.key]
                      )
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-xs text-neutral-600">
            Calculator coming soon
          </div>
        )}
      </div>
    </div>
  );
}

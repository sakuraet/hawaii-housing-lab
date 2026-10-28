// City and County of Honolulu: zoning district rules (ROH Ch. 21, the Land
// Use Ordinance). Values copied unchanged from @uhero/feasim 0.1.0
// (calculations/calc-shared.ts); test/honolulu-config.test.ts checks every
// value against that code.
//
// FAR and lot coverage are given per pathway:
//   standard  the rules before Ord. 26-7 (calcFAR, lotCoverage with lot size)
//   bill6     current zoning, Ord. 26-7 (calcFarBill6, lotCoverageBill6)
//   h201      201H runs on current zoning, so the same as bill6
//   tod       the TOD base: Table 21-3.3 districts take the Ord. 26-7 FAR,
//             the rest the standard FAR (baseFar); coverage without the
//             lot-size tiers (lotCoverage with no lot size)
// Bill 7 sets its own FAR (4.0) and coverage (80%) whatever the zone, so it
// is not listed here.

import type { ZoneRules } from "../../../core/locality";
import { flat, type Schedule } from "../../../core/schedule";

// ── FAR before Ord. 26-7, scaled by lot size ────────────────────────────

const T21_3_3 = "ROH Table 21-3.3";
const T21_3_4 = "ROH Table 21-3.4";
const T21_3_5 = "ROH Table 21-3.5";

const FAR_LOW_DENSITY: Schedule = {
  bands: [
    { upTo: 10000, inclusive: false, base: 0.3, rate: 0.00003 },
    { upTo: 40000, inclusive: true, base: 0.5, rate: 0.00001 },
    { upTo: null, inclusive: true, base: 0.9 },
  ],
  source: T21_3_3,
};

const FAR_A2: Schedule = {
  bands: [
    { upTo: 10000, inclusive: false, base: 0.4, rate: 0.00009 },
    { upTo: 40000, inclusive: true, base: 1.1, rate: 0.00002 },
    { upTo: null, inclusive: true, base: 1.9 },
  ],
  source: T21_3_3,
};

const FAR_A3: Schedule = {
  bands: [
    { upTo: 10000, inclusive: false, base: 0.6, rate: 0.00014 },
    { upTo: 20000, inclusive: true, base: 1.6, rate: 0.00004 },
    { upTo: 40000, inclusive: true, base: 2.0, rate: 0.00002 },
    { upTo: null, inclusive: true, base: 2.8 },
  ],
  source: T21_3_3,
};

const FAR_WAIKIKI: Schedule = {
  bands: [
    { upTo: 20000, inclusive: false, base: 1.3, rate: 0.00003 },
    { upTo: null, inclusive: true, base: 1.9 },
  ],
  source: "ROH 21-9.80, Table 21-9.6(B)",
};

const FAR_RESORT: Schedule = {
  bands: [
    { upTo: 10000, inclusive: false, base: 0.4, rate: 0.00006 },
    { upTo: 30000, inclusive: true, base: 0.8, rate: 0.00002 },
    { upTo: null, inclusive: true, base: 1.4 },
  ],
  source: T21_3_4,
};

// ── FAR under Ord. 26-7 (apartment districts; business keeps Table 21-3.4)

const ORD_26_7 = "Ord. 26-7 (ROH Table 21-3.3 as amended)";
const FAR_ORD_LOW = flat(2.0, ORD_26_7);
const FAR_ORD_MID = flat(3.0, ORD_26_7);
const FAR_ORD_HIGH = flat(4.0, ORD_26_7);

// ── lot coverage ────────────────────────────────────────────────────────

// apartment districts before Ord. 26-7: tiered by lot size
const COVERAGE_APT_TIERED: Schedule = {
  bands: [
    { upTo: 7500, inclusive: false, base: 0.6 },
    { upTo: 20000, inclusive: true, base: 0.5 },
    { upTo: null, inclusive: true, base: 0.4 },
  ],
  source: T21_3_3,
};
// Ord. 26-7: a flat 60% in the apartment districts
const COVERAGE_ORD = flat(0.6, ORD_26_7);

// ── shared pieces ───────────────────────────────────────────────────────

const STEPBACK_40 = { trigger_ft: 40, above_ft: 40, ft_per_10ft: 1 };
const STEPBACK_SOURCE = "ROH 21-3.80-1(c), 21-3.90-1(c), Ord. 17-55, 21-3.100-1(c)";

// Waikiki Special District: open space by FAR (35% below FAR 1.5, 50% at 1.5+)
const WAIKIKI_OPEN_SPACE: Schedule = {
  bands: [
    { upTo: 1.5, inclusive: false, base: 0.35 },
    { upTo: null, inclusive: true, base: 0.5 },
  ],
  source: "ROH 21-9.80",
};

// an apartment district (Table 21-3.3)
function apartment(
  far_standard: Schedule,
  far_ord: Schedule,
  tod_coverage: number,
  extra: Partial<ZoneRules> = {}
): ZoneRules {
  return {
    far: { standard: far_standard, bill6: far_ord, h201: far_ord, tod: far_ord },
    lot_coverage: {
      standard: COVERAGE_APT_TIERED,
      bill6: COVERAGE_ORD,
      h201: COVERAGE_ORD,
      tod: flat(tod_coverage, T21_3_3),
    },
    commercial_coverage: 0,
    bicycle_required: true,
    residential_permitted: true,
    source: T21_3_3,
    ...extra,
  };
}

// a district whose FAR and coverage are the same in every pathway
function sameEverywhere(
  far: Schedule,
  coverage: number,
  coverage_source: string,
  extra: Partial<ZoneRules> & { source: string }
): ZoneRules {
  const cov = flat(coverage, coverage_source);
  return {
    far: { standard: far, bill6: far, h201: far, tod: far },
    lot_coverage: { standard: cov, bill6: cov, h201: cov, tod: cov },
    commercial_coverage: 0,
    bicycle_required: true,
    residential_permitted: true,
    ...extra,
  };
}

// a district with no FAR under Ord. 26-7 (resort, industrial): Standard and
// the TOD base only
function noOrdFar(
  far: Schedule,
  extra: Partial<ZoneRules> & { source: string }
): ZoneRules {
  // not regulated in LOT_COVERAGE: the model's 60% fallback
  const cov = flat(0.6, "model default (zone not in LOT_COVERAGE)");
  return {
    far: { standard: far, tod: far },
    lot_coverage: { standard: cov, bill6: cov, h201: cov, tod: cov },
    commercial_coverage: 0,
    bicycle_required: true,
    residential_permitted: true,
    ...extra,
  };
}

const INDUSTRIAL = {
  // § 21-6.40(a) does not list the industrial districts
  bicycle_required: false,
  // Table 21-5.1: no multi-unit dwellings; housing only through a TOD permit
  residential_permitted: false,
};

// ── the districts ───────────────────────────────────────────────────────

export const zones: Record<string, ZoneRules> = {
  // apartment and apartment mixed use (Table 21-3.3)
  "A-1": apartment(FAR_LOW_DENSITY, FAR_ORD_LOW, 0.6),
  "AMX-1": apartment(FAR_LOW_DENSITY, FAR_ORD_LOW, 0.6, {
    commercial_coverage: 0.3,
  }),
  "A-2": apartment(FAR_A2, FAR_ORD_MID, 0.5, {
    step_back: STEPBACK_40,
  }),
  "AMX-2": apartment(FAR_A2, FAR_ORD_MID, 0.5, {
    commercial_coverage: 0.4,
    step_back: STEPBACK_40,
  }),
  "A-3": apartment(FAR_A3, FAR_ORD_HIGH, 0.4, {
    step_back: STEPBACK_40,
  }),
  "AMX-3": apartment(FAR_A3, FAR_ORD_HIGH, 0.4, {
    commercial_coverage: 0.6,
    step_back: STEPBACK_40,
  }),

  // residential: lot-scaled FAR before and in the TOD base; Ord. 26-7 FAR 2.0
  "R-5": {
    far: {
      standard: FAR_LOW_DENSITY,
      bill6: FAR_ORD_LOW,
      h201: FAR_ORD_LOW,
      tod: FAR_LOW_DENSITY,
    },
    lot_coverage: {
      standard: flat(0.6, T21_3_3),
      bill6: flat(0.6, T21_3_3),
      h201: flat(0.6, T21_3_3),
      tod: flat(0.6, T21_3_3),
    },
    commercial_coverage: 0,
    bicycle_required: true,
    residential_permitted: true,
    source: T21_3_3,
  },

  // business and business mixed use (Table 21-3.4); coverage not regulated
  "B-1": sameEverywhere(flat(1.0, T21_3_4), 1.0, T21_3_4, { source: T21_3_4 }),
  "B-2": sameEverywhere(flat(2.5, T21_3_4), 1.0, T21_3_4, {
    open_space_far_ceiling: 3.5,
    step_back: STEPBACK_40,
    source: `${T21_3_4}; open-space bonus ROH 21-3.120-2(c)`,
  }),
  "BMX-3": sameEverywhere(flat(2.5, T21_3_4), 1.0, T21_3_4, {
    commercial_coverage: 0.6,
    open_space_far_ceiling: 3.5,
    step_back: STEPBACK_40,
    source: `${T21_3_4}; open-space bonus ROH 21-3.120-2(c)`,
  }),
  // BMX-4 takes the BMX-3 step-back in place of its street-angle plane
  "BMX-4": sameEverywhere(flat(4.0, T21_3_4), 1.0, T21_3_4, {
    commercial_coverage: 0.6,
    open_space_far_ceiling: 7.5,
    step_back: STEPBACK_40,
    source: `${T21_3_4}; open-space bonus ROH 21-3.120-2(c)`,
  }),

  // Waikiki Special District (ROH 21-9.80): podium coverage, open space by FAR
  Apart: {
    name: "Apartment Precinct",
    far: {
      standard: FAR_WAIKIKI,
      bill6: FAR_ORD_HIGH,
      h201: FAR_ORD_HIGH,
      tod: FAR_WAIKIKI,
    },
    lot_coverage: {
      standard: flat(1.0, "ROH 21-9.80"),
      bill6: flat(1.0, "ROH 21-9.80"),
      h201: flat(1.0, "ROH 21-9.80"),
      tod: flat(1.0, "ROH 21-9.80"),
    },
    commercial_coverage: 0,
    open_space: WAIKIKI_OPEN_SPACE,
    step_back: { ...STEPBACK_40, front: true },
    bicycle_required: true,
    residential_permitted: true,
    source: "ROH 21-9.80; ROH 21-9.80-5(c) step-back",
  },
  ApartMix: {
    name: "Apartment Mixed Use Subprecinct",
    far: {
      standard: FAR_WAIKIKI,
      bill6: FAR_ORD_HIGH,
      h201: FAR_ORD_HIGH,
      tod: FAR_WAIKIKI,
    },
    lot_coverage: {
      standard: flat(1.0, "ROH 21-9.80"),
      bill6: flat(1.0, "ROH 21-9.80"),
      h201: flat(1.0, "ROH 21-9.80"),
      tod: flat(1.0, "ROH 21-9.80"),
    },
    commercial_coverage: 0.6,
    open_space: WAIKIKI_OPEN_SPACE,
    step_back: { ...STEPBACK_40, front: true },
    bicycle_required: true,
    residential_permitted: true,
    source: "ROH 21-9.80; ROH 21-9.80-5(c) step-back",
  },

  // resort (Table 21-3.4); no FAR under Ord. 26-7
  Resort: noOrdFar(FAR_RESORT, {
    step_back: { trigger_ft: 30, above_ft: 30, ft_per_10ft: 1 },
    source: `${T21_3_4}; step-back ROH 21-3.100-1(c)`,
  }),
  ResMix: noOrdFar(FAR_RESORT, { source: T21_3_4 }),
  ResCom: noOrdFar(FAR_RESORT, { source: T21_3_4 }),

  // industrial (Table 21-3.5); housing only through a TOD permit
  "I-1": noOrdFar(flat(1.0, T21_3_5), { ...INDUSTRIAL, source: T21_3_5 }),
  "I-2": noOrdFar(flat(2.5, T21_3_5), { ...INDUSTRIAL, source: T21_3_5 }),
  "I-3": noOrdFar(flat(2.5, T21_3_5), { ...INDUSTRIAL, source: T21_3_5 }),
  // IMX-1 FAR scales with the use mix (§ 21-3.140-1(c)(1)); a residential
  // model takes the base rung
  "IMX-1": noOrdFar(flat(1.5, "ROH 21-3.140-1(c)(1)"), {
    ...INDUSTRIAL,
    step_back: STEPBACK_40,
    source: `ROH 21-3.140-1(c)(1); step-back ${STEPBACK_SOURCE}`,
  }),
};

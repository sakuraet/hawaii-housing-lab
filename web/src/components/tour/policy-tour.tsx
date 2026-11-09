"use client";

import { GuidedTour, type TourStep } from "@/components/tour/guided-tour";

// =========================================================
// SHARED STEPS
//
// Both tools tag the same pieces with the same `data-tour` names (program
// selector, lock legend, reset), so these steps run unchanged in either view.
// =========================================================

const FACTOR_TEAL = "#4BACC6";
const FACTOR_ORANGE = "#F6A01B";

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="mr-1 inline-block size-2.5 rounded-sm align-middle"
      style={{ backgroundColor: color }}
    />
  );
}

function Level({ tone, children }: { tone: string; children: string }) {
  return (
    <span className={`rounded-full px-1.5 py-px font-medium ${tone}`}>
      {children}
    </span>
  );
}

const PROGRAM_STEP: TourStep = {
  target: "program-selector",
  title: "Pick a development pathway",
  body: (
    <>
      <p>
        Each button is a set of zoning and program rules a project can be built
        under: the Standard pathway, Bill 7, transit-oriented development (TOD),
        201H, and the rules in place before Ord. 26-7.
      </p>
      <p>
        Switching pathways reloads that program&apos;s defaults, so you can
        compare them under the same market conditions.
      </p>
    </>
  ),
  placement: "bottom",
  task: {
    prompt: "Try it: click a different pathway.",
    done: "Pathway switched. Every result now follows its rules.",
  },
};

const LEVELS_BODY = (
  <p>
    Results fall into three levels:{" "}
    <Level tone="bg-emerald-50 text-emerald-700">Strong</Level>,{" "}
    <Level tone="bg-amber-50 text-amber-700">Marginal</Level> and{" "}
    <Level tone="bg-red-50 text-red-700">Below Target</Level>.
  </p>
);

const LOCK_STEP: TourStep = {
  target: "lock-legend",
  title: "Locked and unlocked levers",
  body: (
    <>
      <p>
        <Swatch color={FACTOR_TEAL} />
        <span className="font-bold">Teal</span>{" "}
        <span>levers are at the pathway&apos;s default.</span>
      </p>
      <p>
        <Swatch color={FACTOR_ORANGE} />
        <strong>Orange </strong>levers are ones you changed. A locked lever
        keeps your value when you switch pathways, so you can hold a scenario
        constant and change only the regulation.
      </p>
    </>
  ),
  placement: "bottom",
};

const RESET_STEP: TourStep = {
  target: "reset",
  title: "Start over anytime",
  body: (
    <p>
      Reset to defaults unlocks every lever and returns the pathway to its
      starting assumptions.
    </p>
  ),
  placement: "bottom",
};

const DONE_STEP: TourStep = {
  title: "You're all set",
  body: (
    <>
      <p>
        That&apos;s the whole loop: choose a pathway, move the levers, and read
        how feasibility responds.
      </p>
      <p>
        Reopen it anytime with <strong>Take the tour</strong>.
      </p>
    </>
  ),
};

// =========================================================
// CITYWIDE VIEW (gauge)
// =========================================================

const GAUGE_STEPS: TourStep[] = [
  {
    title: "Welcome to the Citywide View",
    body: (
      <>
        <p>
          This map applies one set of assumptions to every eligible parcel in
          Honolulu and shows where development pencils.
        </p>
        <p>
          This tour takes about a minute. Some steps ask you to try a control,
          and the page stays live while you do.
        </p>
      </>
    ),
  },
  {
    target: "legend",
    title: "Reading the colors",
    body: (
      <p>
        Green parcels are likely to be built, yellow could go either way, and
        red are unlikely. Under TOD, orange marks parcels where housing
        isn&apos;t permitted at the chosen tier.
      </p>
    ),
    placement: "top",
  },
  // desktop only: the buttons are hidden below lg, so the step is skipped
  {
    target: "panel-toggles",
    title: "Make room for the map",
    body: (
      <p>
        <strong>Levers </strong>and <strong>Summary </strong>show or hide the
        side panels, and <strong>Map only </strong>hides both so the map fills
        the screen. Click it again to bring them back.
      </p>
    ),
    placement: "bottom",
  },
  {
    target: "summary",
    title: "The citywide picture",
    body: (
      <>
        <p>
          The summary adds up the maximum potential units across every modeled
          parcel, and how many of them pencil: units on parcels rated Strong.
          The ▲/▼ next to each number is the change from this pathway&apos;s
          defaults, so you can see what your lever changes add or remove.
        </p>
        {LEVELS_BODY}
      </>
    ),
    placement: "left",
  },
  {
    target: "map",
    title: "Explore the map",
    body: (
      <p>
        Each dot is a parcel. Color shows its odds of construction and size
        shows its potential units. Zoom in to see lot outlines.
      </p>
    ),
    placement: "left",
    task: {
      prompt: "Try it: tap or click any dot on the map.",
      done: "Parcel selected. Here's its card.",
      until: "[data-parcel-picked]",
    },
  },
  {
    target: "parcel-card",
    title: "One parcel, up close",
    body: (
      <p>
        The parcel card gives the selected lot&apos;s verdict, potential units
        and timeline. Open the financial breakdown for return on cost, land
        value, equity multiple and IRR.
      </p>
    ),
    placement: "left",
  },
  // after the map steps: the summary panel covers most of the map once open
  {
    target: "open-summary",
    title: "See the project details",
    body: (
      <p>
        <strong>View project details </strong>opens the parcel&apos;s complete
        pro forma beside the map.
      </p>
    ),
    placement: "left",
    task: {
      prompt: "Try it: click View project details.",
      done: "Here are the parcel's project details.",
      until: '[data-tour="summary-panel"]',
    },
    // the panel covers the button, so the step moves onto the panel
    then: {
      target: "summary-panel",
      title: "The full pro forma",
      body: (
        <p>
          Scroll down to see the unit count, timeline, sources and uses of
          funds, operations, and the residual land value build-up. Close it
          with the <strong>× </strong>at the top.
        </p>
      ),
      placement: "left",
    },
  },
  // phones and tablets only: on desktop the levers are always shown and this
  // tab is hidden, so the step is skipped
  {
    target: "levers-toggle",
    title: "Open the levers",
    body: (
      <p>
        The policy levers live in a panel that slides in from the left. Open it
        to change the rules, and close it again to see the map.
      </p>
    ),
    task: {
      prompt: "Try it: tap the Levers tab.",
      done: "The levers are open. The tab closes them again.",
    },
  },
  PROGRAM_STEP,
  {
    target: "levers",
    title: "Policy levers",
    body: (
      <p>
        These are the model&apos;s assumptions. Dropdowns sit on top
        and sliders are grouped below. Tap or hover an <strong>ⓘ </strong>icon
        for what a lever means and which rule it comes from.
      </p>
    ),
    placement: "right",
  },
  {
    target: "lever-hard_cost_per_sqft",
    title: "Move a lever",
    body: (
      <p>
        Releasing a slider re-runs the pro forma for every parcel on the map,
        roughly 10,000 of them. The dots update, and the summary&apos;s ▲/▼
        shows how many units your change added or removed.
      </p>
    ),
    placement: "right",
    task: {
      prompt: "Try it: drag the Hard Costs slider and let go.",
      done: "It's orange now, locked to your value. The × beside it unlocks it.",
    },
  },
  LOCK_STEP,
  RESET_STEP,
  DONE_STEP,
];

// =========================================================
// PUBLIC COMPONENT
// =========================================================

const STEPS = {
  gauge: GAUGE_STEPS,
} as const;

/** The policy tools' tour, with a launcher button, for either view. */
export function PolicyTour({
  view,
  className,
  onStart,
  autoStart,
}: {
  view: keyof typeof STEPS;
  className?: string;
  /** runs as the tour opens, to set the page up for it */
  onStart?: () => void;
  /** open by itself on a first visit (default true) */
  autoStart?: boolean;
}) {
  return (
    <GuidedTour
      id={`policy-${view}-v2`}
      steps={STEPS[view]}
      className={className}
      onStart={onStart}
      autoStart={autoStart}
    />
  );
}

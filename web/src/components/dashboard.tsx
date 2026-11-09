"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import {
  calcParcel,
  overallLevel,
  pathwayEnvelope,
  rlvRatio,
  type Envelope,
  type TodTier,
} from "feasim-challenge";
import {
  ChevronLeft,
  Map as MapIcon,
  PanelLeft,
  PanelRight,
  SlidersHorizontal,
  X,
} from "lucide-react";

import InlineLoaderSimple from "@/components/ui/loading-inline-tag";

import type { ParcelRow, Region } from "@/lib/parcels";
import { runGauge, type ParcelResult } from "@/lib/run-parcels";
import { ControlPanel } from "@/components/control-panel";
import { MapLegend } from "@/components/legend";
import { ParcelInfoOverlay } from "@/components/parcel-card";
import { ProjectSummaryView } from "@/components/project-summary-view";
import { ScenarioSummaryOverlay } from "@/components/summary";
import {
  dataKeyFor,
  prefetchAllParcels,
  useParcels,
} from "@/lib/load-parcels";
import {
  BILL6_DEFAULTS,
  defaultsFor,
  derivedLevers,
  PROGRAM_DEFAULTS,
  useLevers,
} from "@/lib/levers";
import {
  maxFarFor,
  parcelLevers,
  pathwayOf,
  type GaugeInputs,
} from "@/localities/honolulu/pathway-defaults";

const ParcelMap = dynamic(
  () => import("@/components/map").then((m) => m.ParcelMap),
  { ssr: false }
);

const NO_PARCELS: ParcelRow[] = [];

// ── Parcel Region ──────────────────────────────────────────────────
// The summary header names the region holding most of a pathway's parcels
const REGION_NAME: Record<Region, string> = {
  south: "South Oʻahu",
  east: "East Oʻahu",
  north: "North Oʻahu",
  central: "Central Oʻahu",
  west: "West Oʻahu",
};

/** The region holding the most of these parcels, with its parcels. */
function mainRegion(rows: ParcelRow[]): {
  region: Region | null;
  rows: ParcelRow[];
} {
  const byRegion = new Map<Region, ParcelRow[]>();
  for (const row of rows) {
    const group = byRegion.get(row.region);
    if (group) group.push(row);
    else byRegion.set(row.region, [row]);
  }
  let main: { region: Region | null; rows: ParcelRow[] } = {
    region: null,
    rows: NO_PARCELS,
  };
  for (const [region, group] of byRegion) {
    if (group.length > main.rows.length) main = { region, rows: group };
  }
  return main;
}

// ── Runs over every parcel ─────────────────────────────────────────────────
// one pathway's results for every parcel cached (rungauge.ts)
function runPathway(
  program: string,
  parcels: ParcelRow[],
  sliders: GaugeInputs,
  tierPdt: TodTier,
  tierIpdt: TodTier
): ParcelResult[] {
  if (parcels.length === 0) return [];
  const pathway = pathwayOf(program);
  const calc = (parcel: ParcelRow, s: GaugeInputs) => {
    const opts =
      pathway === "tod"
        ? { tier: parcel.tod_regime === "pdt" ? tierPdt : tierIpdt }
        : {};
    return calcParcel(
      pathway,
      parcel,
      parcelLevers(pathway, parcel, s, opts),
      opts
    );
  };
  return runGauge(
    `${dataKeyFor(program)}${program === "tod" ? `|${tierPdt}|${tierIpdt}` : ""}`,
    parcels,
    sliders,
    calc
  );
}

// TOD only: each parcel's envelope status at its regime's tier
function todStatusOf(
  program: string,
  results: ParcelResult[],
  tierPdt: TodTier,
  tierIpdt: TodTier
): Map<string, Envelope["status"]> {
  const out = new Map<string, Envelope["status"]>();
  if (program !== "tod") return out;
  for (const { parcel } of results) {
    const tier = parcel.tod_regime === "pdt" ? tierPdt : tierIpdt;
    out.set(parcel.tmk, pathwayEnvelope("tod", parcel, { tier }).status);
  }
  return out;
}

// scenario card's figures for one run
function summarize(
  results: ParcelResult[],
  todStatus: Map<string, Envelope["status"]>
) {
  // "not modeled" and "not applicable" are not infeasible: keep them out of
  // the denominator
  const modeled = results.filter((item) => {
    const status = todStatus.get(item.parcel.tmk);
    return status !== "not_modeled" && status !== "not_applicable";
  });
  const valid = modeled.filter(
    (item) => isFinite(item.result.max_units) && item.result.max_units > 0
  );

  const n = valid.length;
  if (n === 0) {
    return {
      totalUnits: 0,
      totalAffordableUnits: 0,
      strongUnits: 0,
      avgRoc: null,
      avgTargetRoc: null,
      avgRlvRatio: null,
      avgEquityMultiple: null,
      avgLeveredIrr: null,
      pctStrong: null,
      pctMarginal: null,
      pctPoor: null,
    };
  }

  let totalUnits = 0;
  let totalAffordable = 0;
  let strongUnits = 0;
  let sumRoc = 0;
  let sumTargetRoc = 0;
  let sumRlvRatio = 0;
  let nRlv = 0;
  let sumEqMult = 0;
  // a project whose cash flows never turn positive has no IRR: leave it out
  let sumIrr = 0;
  let nIrr = 0;
  let countStrong = 0;
  let countMarginal = 0;
  let countPoor = 0;

  for (const { result: r } of valid) {
    totalUnits += r.max_units;
    totalAffordable += r.affordable_units;
    sumRoc += r.dev_roc;
    sumTargetRoc += r.dev_target_roc;
    sumEqMult += r.dev_equity_multiple;
    if (isFinite(r.dev_levered_irr)) {
      sumIrr += r.dev_levered_irr;
      nIrr++;
    }

    const ratio = rlvRatio(r);
    if (ratio != null) {
      sumRlvRatio += ratio;
      nRlv++;
    }

    // same classifier the map dots and the parcel card use; a parcel's units
    // pencil when it rates Strong
    const level = overallLevel(r);
    if (level === "strong") {
      countStrong++;
      strongUnits += r.max_units;
    } else if (level === "marginal") countMarginal++;
    else countPoor++;
  }

  return {
    totalUnits,
    totalAffordableUnits: totalAffordable,
    strongUnits,
    avgRoc: sumRoc / n,
    avgTargetRoc: sumTargetRoc / n,
    avgRlvRatio: nRlv > 0 ? sumRlvRatio / nRlv : null,
    avgEquityMultiple: sumEqMult / n,
    avgLeveredIrr: nIrr > 0 ? sumIrr / nIrr : null,
    pctStrong: countStrong / n,
    pctMarginal: countMarginal / n,
    pctPoor: countPoor / n,
  };
}

// ── Component ──────────────────────────────────────────────────────────────
export function PolicyGaugeDashboard() {
  // opens on Standard, which is the bill6 pathway (see PROGRAMS in control-panel)
  const {
    inputs,
    modified,
    setFactor,
    handleInputsChange,
    handleReset,
    lockCount,
  } = useLevers();

  // The map and summary follow a deferred copy of the inputs: the control
  // panel repaints with the new value immediately, and the ~10k-parcel rerun
  // happens in a lower-priority render instead of blocking it.
  const mapInputs = useDeferredValue(inputs);

  const loadedParcels = useParcels(mapInputs.program);
  const activeParcels = loadedParcels ?? NO_PARCELS;
  const parcelsLoading = loadedParcels === null;

  // once the first pathway is on screen, warm the other pathways' chunks so
  // switching doesn't wait on the network
  useEffect(() => {
    if (!parcelsLoading) void prefetchAllParcels();
  }, [parcelsLoading]);

  // PD-T and IPD-T parcels each take their own tier
  const [todTierPdt, setTodTierPdt] = useState<TodTier>("base");
  const [todTierIpdt, setTodTierIpdt] = useState<TodTier>("base");

  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);
  // Whether the user has clicked a parcel since this pathway loaded. Until
  // they do, the header names the pathway's main region; after, the clicked
  // parcel's.
  const [userPicked, setUserPicked] = useState(false);

  // the selected parcel's project details, in a slide-out panel
  const [projectSummaryOpen, setProjectSummaryOpen] = useState(false);
  // the map area, which the project details open inside
  const [mapArea, setMapArea] = useState<HTMLElement | null>(null);
  // the legend shrinks to one short row when the panels leave the map narrow
  // (e.g. an iPad in landscape), not only on phones
  const [mapNarrow, setMapNarrow] = useState(false);
  useEffect(() => {
    if (!mapArea) return;
    const observer = new ResizeObserver(([entry]) => {
      setMapNarrow(entry.contentRect.width < 760);
    });
    observer.observe(mapArea);
    return () => observer.disconnect();
  }, [mapArea]);
  // Below lg the map fills the screen: the levers slide in from the left and
  // the parcel card only opens on a tapped parcel. Neither applies on desktop,
  // where both are always shown.
  const [leversOpen, setLeversOpen] = useState(false);
  const [parcelCardOpen, setParcelCardOpen] = useState(false);
  // the summary bar's breakdown, folded away when a parcel card opens so the
  // two don't stack over the map
  const [summaryOpen, setSummaryOpen] = useState(false);
  // desktop: either side panel can be put away
  const [showLevers, setShowLevers] = useState(true);
  const [showResults, setShowResults] = useState(true);

  // region holding most of this pathway's parcels
  const mainArea = useMemo(() => mainRegion(activeParcels), [activeParcels]);

  // Reset selection when program switches (or its data arrives), to a parcel
  // in the region the map is about to fly to. Not derivable state (the user
  // can also select parcels), so it is reset while rendering when the area
  // changes, rather than in an effect
  const [selectionArea, setSelectionArea] = useState<typeof mainArea | null>(
    null
  );
  if (selectionArea !== mainArea) {
    setSelectionArea(mainArea);
    setSelectedParcelId(mainArea.rows[0]?.tmk ?? null);
    setUserPicked(false);
    setParcelCardOpen(false);
  }

  const handleSelectParcel = useCallback((tmk: string) => {
    setSelectedParcelId(tmk);
    setUserPicked(true);
    setParcelCardOpen(true);
    setSummaryOpen(false);
  }, []);

  // the tour starts on the map, with nothing else open over it
  const handleTourStart = useCallback(() => {
    setLeversOpen(false);
    setSummaryOpen(false);
    // the tour points at both panels
    setShowLevers(true);
    setShowResults(true);
  }, []);

  // Escape closes the levers drawer on small screens
  useEffect(() => {
    if (!leversOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLeversOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leversOpen]);

  // Run gauge calc for every parcel on slider change (cached — see run-gauge.ts)
  const parcelResults = useMemo(
    () =>
      runPathway(
        mapInputs.program,
        activeParcels,
        mapInputs,
        todTierPdt,
        todTierIpdt
      ),
    [activeParcels, mapInputs, todTierPdt, todTierIpdt]
  );

  // TOD only: each parcel's envelope status at its regime's tier
  const todStatus = useMemo(
    () =>
      todStatusOf(mapInputs.program, parcelResults, todTierPdt, todTierIpdt),
    [parcelResults, mapInputs.program, todTierPdt, todTierIpdt]
  );

  const mapParcels = useMemo(
    () =>
      parcelResults.map((item) => ({
        ...item,
        notApplicable: todStatus.get(item.parcel.tmk) === "not_applicable",
      })),
    [parcelResults, todStatus]
  );

  const selectedParcel = useMemo(() => {
    return (
      parcelResults.find((item) => item.parcel.tmk === selectedParcelId) ??
      parcelResults[0] ??
      null
    );
  }, [parcelResults, selectedParcelId]);

  // the height, FAR and open-space bonus the pathway gives the selected parcel
  const selectedEnvelope = useMemo(() => {
    if (!selectedParcel) return null;
    const parcel = selectedParcel.parcel;
    return pathwayEnvelope(
      pathwayOf(mapInputs.program),
      parcel,
      mapInputs.program === "tod"
        ? { tier: parcel.tod_regime === "pdt" ? todTierPdt : todTierIpdt }
        : {}
    );
  }, [selectedParcel, mapInputs.program, todTierPdt, todTierIpdt]);


  // levers that follow the selected parcel until moved
  const derived = useMemo(
    () =>
      derivedLevers(
        mapInputs,
        selectedParcel
          ? { row: selectedParcel.parcel, result: selectedParcel.result }
          : null
      ),
    [mapInputs, selectedParcel]
  );

  // ── Aggregate financial metrics across all valid parcels ────────────────
  const summary = useMemo(
    () => ({
      ...summarize(parcelResults, todStatus),
      program: mapInputs.program,
    }),
    [parcelResults, mapInputs.program, todStatus]
  );

  // the same pathway with every lever at its default (TOD at the base tier):
  // what the scenario card's unit deltas are measured against
  const baseline = useMemo(() => {
    const defaults = PROGRAM_DEFAULTS[mapInputs.program] ?? BILL6_DEFAULTS;
    const results = runPathway(
      mapInputs.program,
      activeParcels,
      defaults,
      "base",
      "base"
    );
    return summarize(
      results,
      todStatusOf(mapInputs.program, results, "base", "base")
    );
  }, [activeParcels, mapInputs.program]);

  // TOD only: the selected parcel's regime for its card, and whether housing
  // is not applicable there at its tier
  const todLabel = useMemo(() => {
    if (mapInputs.program !== "tod" || !selectedParcel) return undefined;
    const regime = selectedParcel.parcel.tod_regime;
    if (!regime) return undefined;
    const name = regime === "pdt" ? "PD-T" : "IPD-T";
    return todStatus.get(selectedParcel.parcel.tmk) === "not_applicable"
      ? `${name}: Not Applicable`
      : name;
  }, [mapInputs.program, selectedParcel, todStatus]);

  // a parking lever set below the Article 6 minimum needs a variance
  const parkingWarning =
    derived.parking_ratio !== undefined &&
    mapInputs.parking_ratio !== undefined &&
    mapInputs.parking_ratio < derived.parking_ratio - 1e-9
      ? "Parking below legal minimum"
      : undefined;

  // The header names a place
  const areaRegion =
    userPicked && selectedParcel
      ? selectedParcel.parcel.region
      : mainArea.region;
  const areaTitle = areaRegion ? REGION_NAME[areaRegion] : "Oʻahu";

  const titledSummary = useMemo(
    () => ({
      ...summary,
      title: areaTitle,
      unitsDelta: summary.totalUnits - baseline.totalUnits,
      strongUnitsDelta: summary.strongUnits - baseline.strongUnits,
    }),
    [summary, baseline, areaTitle]
  );

  const parcelCard = (compact: boolean) =>
    selectedParcel && (
      <ParcelInfoOverlay
        // a newly tapped parcel opens with its breakdown folded again
        key={compact ? selectedParcel.parcel.tmk : undefined}
        parcelId={selectedParcel.parcel.tmk}
        address={selectedParcel.parcel.address}
        result={selectedParcel.result}
        todLabel={todLabel}
        todWarning={todLabel?.endsWith("Not Applicable")}
        warning={parkingWarning}
        compact={compact}
        onOpenSummary={() => setProjectSummaryOpen(true)}
      />
    );
  const mobileCardOpen = !!selectedParcel && parcelCardOpen;
  const mapOnly = !showLevers && !showResults;

  return (
    // one row pinned to the screen height: the levers wrapper below can't
    // take overflow-hidden (its tab hangs off the edge), so without this the
    // row would grow to the full height of the lever list
    // desktop: putting the levers away shrinks their column to nothing,
    // with the panel pinned to the column's right edge so it slides out left
    // at the same pace as the drawer on smaller screens
    <div
      className={`relative grid h-full grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden lg:transition-[grid-template-columns] lg:duration-300 lg:ease-out ${
        showLevers
          ? "lg:grid-cols-[464px_minmax(0,1fr)]"
          : "lg:grid-cols-[0px_minmax(0,1fr)]"
      }`}
    >
      {/* Levers: a column on desktop, a drawer over the map below lg */}
      <div
        className={`z-[1000] transition-transform duration-300 ease-out max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-[min(420px,calc(100vw-3rem))] max-lg:shadow-2xl max-lg:shadow-slate-900/20 lg:relative lg:flex lg:min-w-0 lg:translate-x-0 lg:justify-end lg:overflow-hidden ${
          leversOpen ? "translate-x-0" : "max-lg:-translate-x-full"
        }`}
      >
        <aside
          id="policy-levers"
          className={`relative h-full overflow-hidden border-r border-slate-200 shadow-sm shadow-slate-900/5 transition-[visibility] duration-300 lg:w-[464px] lg:shrink-0 ${
            showLevers ? "" : "lg:invisible"
          }`}
        >
          <ControlPanel
            inputs={inputs}
            onChange={handleInputsChange}
            onFactorChange={setFactor}
            modified={modified}
            defaults={defaultsFor(inputs.program)}
            derived={derived}
            onReset={handleReset}
            todTierPdt={todTierPdt}
            onTodTierPdtChange={setTodTierPdt}
            todTierIpdt={todTierIpdt}
            onTodTierIpdtChange={setTodTierIpdt}
            onTourStart={handleTourStart}
          />
        </aside>

        {/* the tab rides on the drawer's edge, so it is in reach open or shut */}
        <button
          type="button"
          data-tour="levers-toggle"
          onClick={() => setLeversOpen((open) => !open)}
          aria-expanded={leversOpen}
          aria-controls="policy-levers"
          aria-label={leversOpen ? "Hide policy levers" : "Show policy levers"}
          className="absolute left-full top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-r-xl bg-[#1D667F] px-2 py-3 text-white shadow-lg shadow-slate-900/20 transition-colors active:bg-[#2a7d99] lg:hidden"
        >
          {leversOpen ? (
            <ChevronLeft className="size-4" aria-hidden />
          ) : (
            <SlidersHorizontal className="size-4" aria-hidden />
          )}
          <span className="text-[11px] font-semibold [writing-mode:vertical-rl]">
            Levers
          </span>
          {lockCount > 0 && (
            <span
              className="flex size-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: "#F6A01B" }}
              title={`${lockCount} locked`}
            >
              {lockCount}
            </span>
          )}
        </button>
      </div>

      <section
        ref={setMapArea}
        data-tour="map"
        className="relative isolate min-w-0 bg-slate-100"
      >
        <ParcelMap
          parcels={mapParcels}
          rows={activeParcels}
          focusRows={mainArea.rows}
          selectedParcelId={selectedParcelId}
          onSelectParcel={handleSelectParcel}
        />

        {/* desktop: show or hide the side panels; right of the zoom buttons */}
        <div
          role="group"
          aria-label="Panels"
          data-tour="panel-toggles"
          className="absolute left-14 top-2.5 z-[500] hidden overflow-hidden rounded-lg border border-slate-300 bg-white/90 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur lg:flex"
        >
          <PanelToggle
            pressed={showLevers}
            onClick={() => setShowLevers((v) => !v)}
            icon={<PanelLeft className="size-3.5" aria-hidden />}
            label="Levers"
          />
          <PanelToggle
            pressed={showResults}
            onClick={() => setShowResults((v) => !v)}
            icon={<PanelRight className="size-3.5" aria-hidden />}
            label="Summary"
          />
          <PanelToggle
            pressed={mapOnly}
            onClick={() => {
              setShowLevers(mapOnly);
              setShowResults(mapOnly);
            }}
            icon={<MapIcon className="size-3.5" aria-hidden />}
            label="Map only"
          />
        </div>
        {/* a fresh node for every parcel the user picks, which the tour's map
            step watches for (the cards themselves stay mounted on desktop) */}
        {userPicked && (
          <span key={selectedParcelId} hidden data-parcel-picked />
        )}

        {parcelsLoading && (
          <div className="pointer-events-none absolute left-1/2 top-5 z-[500] -translate-x-1/2">
            <InlineLoaderSimple
              text="Loading parcels..."
              className="backdrop-blur"
            />
          </div>
        )}

        <div className="pointer-events-none absolute inset-0">
          {/* phones: a summary bar across the top, clear of the levers tab.
              From sm up (half a desktop screen, tablets): the full summary
              and parcel card in a right-hand column; the Levers/Summary
              toggles only exist on desktop. Each place tags its own copy
              for the tour. */}
          {/* desktop: putting the summary away slides it out right, the
              mirror of the levers */}
          <div
            className={`pointer-events-auto absolute left-12 right-3 top-3 z-[500] flex max-h-[calc(100%-1.5rem)] flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] sm:left-auto sm:w-[320px] md:w-[340px] lg:right-5 lg:top-5 lg:max-h-[calc(100%-2.5rem)] lg:transition-[transform,visibility] lg:duration-300 lg:ease-out [&::-webkit-scrollbar]:hidden ${
              showResults
                ? ""
                : "lg:invisible lg:translate-x-[calc(100%+1.25rem)]"
            }`}
          >
            <div data-tour="summary" className="sm:hidden">
              <ScenarioSummaryOverlay
                summary={titledSummary}
                compact
                expanded={summaryOpen}
                onExpandedChange={setSummaryOpen}
              />
            </div>
            <div data-tour="summary" className="hidden sm:block">
              <ScenarioSummaryOverlay summary={titledSummary} />
            </div>
            {selectedParcel && (
              <div data-tour="parcel-card" className="hidden sm:block">
                {parcelCard(false)}
              </div>
            )}
          </div>

          {/* phones: the parcel card opens over the legend for a tapped
              parcel, and can be put away. Kept on the page while shut (and
              the legend while covered), so the tour's step count holds.
              Clear of the map's attribution line, like the legend. */}
          <div
            data-tour="parcel-card"
            className={`pointer-events-auto absolute bottom-6 left-12 right-3 z-[510] flex max-h-[60%] flex-col transition-[transform,opacity,visibility] duration-300 ease-out sm:hidden ${
              mobileCardOpen ? "" : "invisible translate-y-6 opacity-0"
            }`}
          >
            {selectedParcel && (
              <>
                <button
                  type="button"
                  onClick={() => setParcelCardOpen(false)}
                  className="mb-1.5 flex items-center gap-1 self-end rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm backdrop-blur"
                >
                  <X className="size-3" aria-hidden />
                  Close
                </button>
                <div className="min-h-0 overflow-y-auto overscroll-contain rounded-2xl">
                  {parcelCard(true)}
                </div>
              </>
            )}
          </div>

          <div
            data-tour="legend"
            // phones: above the map's attribution line, which runs under it
            className={`pointer-events-auto absolute bottom-6 left-3 z-[500] transition-[opacity,visibility] duration-300 ease-out sm:bottom-3 lg:bottom-5 lg:left-5 ${
              mobileCardOpen ? "max-sm:invisible max-sm:opacity-0" : ""
            }`}
          >
            <MapLegend
              showNotApplicable={mapInputs.program === "tod"}
              compact={mapNarrow}
            />
          </div>
        </div>

        {selectedParcel && (
          <ProjectSummaryView
            open={projectSummaryOpen}
            onOpenChange={setProjectSummaryOpen}
            container={mapArea}
            parcelId={selectedParcel.parcel.tmk}
            address={selectedParcel.parcel.address}
            result={selectedParcel.result}
            offeredBonus={selectedEnvelope?.open_space_bonus ?? 0}
            zonedHeight={selectedParcel.parcel.height}
            maxFar={
              selectedEnvelope
                ? maxFarFor(selectedEnvelope, mapInputs.far_delta)
                : undefined
            }
            todLabel={todLabel}
            todWarning={todLabel?.endsWith("Not Applicable")}
            warning={parkingWarning}
          />
        )}
      </section>
    </div>
  );
}

// one of the map's panel buttons; pressed while its panel is shown
function PanelToggle({
  pressed,
  onClick,
  icon,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`flex items-center gap-1.5 border-l border-slate-300 px-2.5 py-1.5 transition-colors first:border-l-0 ${
        pressed
          ? "bg-[#1D667F] text-white"
          : "hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

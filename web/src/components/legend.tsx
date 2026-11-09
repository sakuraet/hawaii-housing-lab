import { cn } from "@/lib/utils";

export function MapLegend({
  showNotApplicable = false,
  compact = false,
}: {
  /** TOD: parcels where housing is not permitted at the chosen tier */
  showNotApplicable?: boolean;
  /** the map is narrow, e.g. an iPad between the side panels */
  compact?: boolean;
}) {
  return (
    // below md, or when the map is narrow, it shrinks to one short row, to
    // leave the map room and stay clear of the summary cards
    <div
      className={cn(
        "rounded-xl border border-white/40 bg-white/80 px-4 py-3 text-xs shadow-lg shadow-slate-900/10 backdrop-blur-md max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-2 max-md:px-2.5 max-md:py-1.5 max-md:text-[11px]",
        compact && "flex flex-wrap items-center gap-2 px-2.5 py-1.5 text-[11px]"
      )}
    >
      <div
        className={cn(
          "mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 max-md:mb-0",
          compact && "mb-0"
        )}
      >
        <span className={cn("max-md:hidden", compact && "hidden")}>
          Odds of Construction
        </span>
        <span className={cn("md:hidden", compact && "md:inline")}>Odds</span>
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-700 max-md:gap-x-2",
          compact && "gap-x-2"
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-1 ring-white" />
          <span className="tabular-nums">75–100%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 ring-1 ring-white" />
          <span className="tabular-nums">25–74%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-white" />
          <span className="tabular-nums">0–24%</span>
        </div>
        {showNotApplicable && (
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-500 ring-1 ring-white" />
            <span>Not applicable</span>
          </div>
        )}
      </div>
      <div
        className={cn(
          "mt-2 text-[11px] text-slate-500 max-md:hidden",
          compact && "hidden"
        )}
      >
        Circle size scales with potential units, zoom in for lot outlines
      </div>
    </div>
  );
}

"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Cross2Icon } from "@radix-ui/react-icons";
import type { ParcelOutput } from "feasim-challenge";

import { ProjectSummary } from "@/components/project-summary";

// the selected parcel's project details, in a panel that slides out from the
// right of the map area
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: HTMLElement | null;
  parcelId: string;
  address?: string;
  result: ParcelOutput;
  offeredBonus: number;
  zonedHeight?: number;
  maxFar?: number;
  /** TOD only: the parcel's regime, e.g. "IPD-T" or "PD-T: Not Applicable" */
  todLabel?: string;
  /** TOD only: the label is a warning (housing not applicable) */
  todWarning?: boolean;
  /** a caution about the scenario, e.g. parking below the legal minimum */
  warning?: string;
}

// same chips as the parcel card
const CHIP =
  "rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600";
const WARNING_CHIP =
  "rounded-full border border-amber-700 bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700";

export function ProjectSummaryView({
  open,
  onOpenChange,
  container,
  parcelId,
  address,
  result,
  offeredBonus,
  zonedHeight,
  maxFar,
  todLabel,
  todWarning,
  warning,
}: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Content
          data-tour="summary-panel"
          // clicks on the map, its zoom buttons and the levers keep it open
          onInteractOutside={(e) => e.preventDefault()}
          className="absolute inset-y-0 right-0 z-[900] flex w-[calc(100%-3.5rem)] max-w-[600px] flex-col overflow-hidden border-l bg-background shadow-2xl duration-300 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          <div className="border-b border-slate-200 px-6 py-4 pr-12">
            <DialogPrimitive.Title asChild>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Project Details
                </div>
                <div className="mt-0.5 text-base font-semibold tracking-tight text-slate-900">
                  {parcelId}
                </div>
                {address && (
                  <div className="text-sm text-slate-500">{address}</div>
                )}
              </div>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Project details for the selected parcel
            </DialogPrimitive.Description>
            {/* the parcel card's chips; -mr-6 lines them up with the pro
                forma below, past the room the header keeps for the close
                button */}
            <div className="-mr-6 mt-1 flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
              {(todLabel || warning) && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {todLabel && (
                    <span className={todWarning ? WARNING_CHIP : CHIP}>
                      {todLabel}
                    </span>
                  )}
                  {warning && <span className={WARNING_CHIP}>{warning}</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <ProjectSummary
              result={result}
              offeredBonus={offeredBonus}
              zonedHeight={zonedHeight}
              maxFar={maxFar}
            />
          </div>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100">
            <Cross2Icon className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

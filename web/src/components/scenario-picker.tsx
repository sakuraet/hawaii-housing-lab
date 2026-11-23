"use client";

import { Building2, Car, Landmark, TrainFront } from "lucide-react";
import type { ReactNode } from "react";
import type { ScenarioId } from "feasim-challenge";

// what each card says in a few words; the full description shows under the
// cards for the chosen one
const CARD: Record<ScenarioId, { icon: ReactNode; short: string }> = {
  baseline: { icon: <Building2 className="size-4" aria-hidden />, short: "Today's rules" },
  tod: { icon: <TrainFront className="size-4" aria-hidden />, short: "More near transit" },
  parking: { icon: <Car className="size-4" aria-hidden />, short: "No minimums" },
  fees: { icon: <Landmark className="size-4" aria-hidden />, short: "Fees cut 50%" },
};

interface Props {
  scenarios: readonly { id: ScenarioId; label: string }[];
  value: ScenarioId;
  onChange: (id: ScenarioId) => void;
  /** scenarios not defined in this county yet, which run the baseline */
  unavailable?: ReadonlySet<ScenarioId>;
  /** the chosen scenario's description and notes */
  note?: string;
}

// The scenarios as cards, so they read as the policy choice and look nothing
// like the county tabs above them
export function ScenarioPicker({ scenarios, value, onChange, unavailable, note }: Props) {
  return (
    <div data-tour="scenario-selector">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Scenario
      </p>
      <div role="radiogroup" aria-label="Scenario" className="grid grid-cols-2 gap-2">
        {scenarios.map((s) => {
          const active = s.id === value;
          const off = unavailable?.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(s.id)}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-brand bg-brand-50 ring-1 ring-brand"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span
                className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${
                  active ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {CARD[s.id].icon}
              </span>
              <span className="min-w-0">
                <span className={`block text-xs font-semibold ${active ? "text-brand-900" : "text-slate-800"}`}>
                  {s.label}
                </span>
                <span className="block text-[11px] leading-snug text-slate-500">
                  {off ? "Runs the baseline here" : CARD[s.id].short}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {note && <p className="mt-2 text-xs leading-relaxed text-slate-600">{note}</p>}
    </div>
  );
}

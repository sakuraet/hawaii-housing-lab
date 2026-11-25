"use client";

import type { CountyId } from "@/localities/counties";

interface Props {
  counties: readonly { id: CountyId; label: string }[];
  value: CountyId;
  onChange: (id: CountyId) => void;
  /** a line under the tabs */
  note?: string;
}

// The county, as one segmented bar: it picks the place, so it reads as
// navigation rather than as one of the policy choices below it
export function CountyTabs({ counties, value, onChange, note }: Props) {
  return (
    <div data-tour="county-selector">
      <div
        role="tablist"
        aria-label="County"
        className="grid grid-cols-4 rounded-lg bg-slate-100 p-1"
      >
        {counties.map((c) => {
          const active = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(c.id)}
              className={`cursor-pointer rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

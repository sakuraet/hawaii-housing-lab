"use client";

export interface ProgramOption<TId extends string = string> {
  id: TId;
  label: string;
  ready?: boolean;
}

interface Props<TId extends string> {
  /** the box's heading; "Program" unless set */
  label?: string;
  /** the tour's name for the box; "program-selector" unless set */
  tourId?: string;
  /** a line under the buttons */
  note?: string;
  programs: readonly ProgramOption<TId>[];
  value: TId;
  onChange: (id: TId) => void;
}

export function ProgramSelector<TId extends string>({
  label = "Program",
  tourId = "program-selector",
  note,
  programs,
  value,
  onChange,
}: Props<TId>) {
  return (
    <div
      data-tour={tourId}
      className="rounded-lg bg-slate-100/20 p-3"
    >
      <p className="mb-2 text-xs font-semibold text-white">{label}</p>
      <div className="flex flex-wrap gap-2">
        {programs.map((program) => {
          const ready = program.ready !== false;
          const active = value === program.id;
          return (
            <button
              key={program.id}
              type="button"
              disabled={!ready}
              onClick={() => ready && onChange(program.id)}
              className={`min-w-[30%] flex-1 rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-colors ${
                !ready
                  ? "cursor-not-allowed border border-white/20 bg-white/5 text-white/30"
                  : active
                    ? "cursor-pointer bg-[#1D667F] text-white"
                    : "cursor-pointer border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {program.label}
              {!ready && (
                <span className="ml-1 text-[10px] opacity-60">soon</span>
              )}
            </button>
          );
        })}
      </div>
      {note && <p className="mt-2 text-xs text-slate-200">{note}</p>}
    </div>
  );
}

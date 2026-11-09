"use client";

export interface ProgramOption<TId extends string = string> {
  id: TId;
  label: string;
  ready?: boolean;
}

interface Props<TId extends string> {
  programs: readonly ProgramOption<TId>[];
  value: TId;
  onChange: (id: TId) => void;
}

export function ProgramSelector<TId extends string>({
  programs,
  value,
  onChange,
}: Props<TId>) {
  return (
    <div
      data-tour="program-selector"
      className="rounded-lg bg-slate-100 p-3"
    >
      <p className="mb-2 text-xs font-semibold text-slate-700">Program</p>
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
                  ? "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-300"
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
    </div>
  );
}

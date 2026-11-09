"use client";

import { useRef, useState } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Info icon with a tip: a mouse hovers it open, a tap or Enter toggles it, and
// a tap anywhere else closes it. A popover rather than a tooltip, since Radix
// tooltips never open on touch. It sits above the tour's shade (z 1200), so a
// tip opened during the tour isn't dimmed.
export function InfoTip({
  title,
  text,
  side = "right",
  align = "start",
  large = false,
}: {
  title?: string;
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** the factor charts' slightly bigger icon */
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef<number | undefined>(undefined);
  // the press was a mouse's, whose hover already opened the tip
  const mouse = useRef(false);

  const hover = (e: React.PointerEvent, entering: boolean) => {
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(leaveTimer.current);
    if (entering) setOpen(true);
    // a beat to cross the gap from the icon onto the tip
    else leaveTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={(e) => hover(e, true)}
          onPointerLeave={(e) => hover(e, false)}
          onPointerDown={(e) => (mouse.current = e.pointerType === "mouse")}
          // a mouse click keeps the hovered tip open instead of toggling it shut
          onClick={(e) => {
            if (mouse.current) {
              e.preventDefault();
              setOpen(true);
            }
            mouse.current = false;
          }}
          className={`flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-slate-100 hover:text-slate-700 ${
            large ? "size-5 text-neutral-600" : "size-4 text-neutral-500"
          }`}
          aria-label={title ? `About ${title}` : "More info"}
        >
          <svg
            width={large ? 12 : 11}
            height={large ? 12 : 11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={6}
        collisionPadding={8}
        // focus stays on the icon, so a hover doesn't pull it into the tip
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={(e) => hover(e, true)}
        onPointerLeave={(e) => hover(e, false)}
        // narrows to the room beside the icon on a phone rather than running
        // off the screen
        className="z-[1300] w-[min(16rem,var(--radix-popover-content-available-width))] rounded-lg border-slate-200 bg-white p-2.5 shadow-lg"
      >
        {title && (
          <p className="mb-1 text-[10px] font-semibold text-slate-800">
            {title}
          </p>
        )}
        <p className="text-[10px] leading-relaxed text-slate-500">{text}</p>
      </PopoverContent>
    </Popover>
  );
}

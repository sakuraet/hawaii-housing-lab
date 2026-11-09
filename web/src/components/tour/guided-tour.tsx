"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, CirclePlay, MousePointerClick, X } from "lucide-react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

// =========================================================
// TYPES
// =========================================================

export type TourPlacement = "top" | "bottom" | "left" | "right";

export interface TourTask {
  /** what the reader should try, shown until they do it */
  prompt: string;
  /** shown once they have */
  done: string;
  /**
   * Selector for an element that shows up once the task is done (a map
   * popup, say). Without one, any press or key inside the spotlight counts.
   */
  until?: string;
  /** move on by itself once the task is done, after a beat to show it */
  advance?: boolean;
}

export interface TourStep {
  /** `data-tour` value of the element to spotlight; omit for a centred card */
  target?: string;
  title: string;
  body: ReactNode;
  /** preferred side for the card; falls back to whichever side fits */
  placement?: TourPlacement;
  /** makes the step hands-on: the spotlit element stays live to try */
  task?: TourTask;
  /**
   * once the task is done, the step turns to what it opened: the spotlight
   * moves to this target and the card shows this text instead
   */
  then?: Omit<TourStep, "task" | "then">;
}

// =========================================================
// LAYOUT
// =========================================================

const PAD = 8; // spotlight padding around the target
const GAP = 14; // between the spotlight and the card
const MARGIN = 12; // card's minimum distance from the viewport edge
const CARD_W = 400;
const MOBILE_W = 640; // below this the card becomes a bottom sheet
const SWIPE_PX = 50; // horizontal travel that counts as a swipe on the sheet

// sits above Leaflet's panes and controls (up to 1000), and under the info
// tips (1300) so one opened during the tour isn't dimmed
const Z = 1200;

const BRAND = "#1D667F";

// the shade over everything outside the spotlight
const SHADE = "rgba(15, 23, 42, 0.55)";

const SPRING = { type: "spring", stiffness: 380, damping: 36 } as const;

type Rect = { top: number; left: number; width: number; height: number };
type Layout = { rect: Rect | null; vw: number; vh: number };

const sameLayout = (a: Layout | null, b: Layout) =>
  !!a &&
  a.vw === b.vw &&
  a.vh === b.vh &&
  (a.rect === b.rect ||
    (!!a.rect &&
      !!b.rect &&
      a.rect.top === b.rect.top &&
      a.rect.left === b.rect.left &&
      a.rect.width === b.rect.width &&
      a.rect.height === b.rect.height));

const isMobile = () => window.innerWidth < MOBILE_W;

// The first copy of a target that is laid out and not pushed off the side of
// the screen. A target can be tagged in two places with one hidden per
// breakpoint (the gauge's parcel card), sit in a closed drawer, or be kept
// invisible until needed; any of these gets no spotlight. Off the top or
// bottom is fine: it is scrolled to.
function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    if (
      r.width > 0 &&
      r.height > 0 &&
      r.right > 1 &&
      r.left < window.innerWidth - 1 &&
      getComputedStyle(el).visibility !== "hidden"
    ) {
      return el;
    }
  }
  return null;
}

// The band of the screen an element's scroll panels actually show: the
// window, cut down by every ancestor that clips its content
function visibleBounds(el: HTMLElement) {
  let top = 0;
  let bottom = window.innerHeight;
  for (
    let p = el.parentElement;
    p && p !== document.body;
    p = p.parentElement
  ) {
    if (getComputedStyle(p).overflowY === "visible") continue;
    const r = p.getBoundingClientRect();
    top = Math.max(top, r.top);
    bottom = Math.min(bottom, r.bottom);
  }
  return { top, bottom };
}

// a step can run if it points at nothing or its target is on the page now
const isAvailable = (step: TourStep) =>
  !step.target || findTarget(step.target) !== null;

// A step counts toward the total if its target is laid out at all, even shut
// in a drawer or invisible, since the reader opens those during the tour.
// Targets hidden at this screen size (display: none) don't count.
const isCounted = (step: TourStep) =>
  !step.target ||
  Array.from(document.querySelectorAll(`[data-tour="${step.target}"]`)).some(
    (el) => el.getClientRects().length > 0
  );

// The spotlit element moves under us: panels scroll, the map flies, cards
// grow. Follow it every frame, but only re-render when something moved.
function useLayout(target: string | undefined, active: boolean) {
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => {
    if (!active) return;
    let last: Layout | null = null;
    let frame = 0;
    const tick = () => {
      const r = findTarget(target)?.getBoundingClientRect();
      const next: Layout = {
        vw: window.innerWidth,
        vh: window.innerHeight,
        rect: r
          ? {
              top: r.top - PAD,
              left: r.left - PAD,
              width: r.width + PAD * 2,
              height: r.height + PAD * 2,
            }
          : null,
      };
      if (!sameLayout(last, next)) {
        last = next;
        setLayout(next);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);
  return active ? layout : null;
}

// First side that fits, in order of preference. A target too big to sit
// beside (the map) gets the card in its own bottom-right corner.
function placeCard(
  rect: Rect,
  card: { w: number; h: number },
  vw: number,
  vh: number,
  preferred?: TourPlacement
): { top: number; left: number } {
  const clamp = (top: number, left: number) => ({
    top: Math.min(Math.max(top, MARGIN), vh - card.h - MARGIN),
    left: Math.min(Math.max(left, MARGIN), vw - card.w - MARGIN),
  });
  const midX = rect.left + rect.width / 2 - card.w / 2;
  const midY = rect.top + rect.height / 2 - card.h / 2;
  const sides: TourPlacement[] = [
    ...(preferred ? [preferred] : []),
    "bottom",
    "right",
    "top",
    "left",
  ];
  for (const side of sides) {
    if (side === "bottom") {
      const top = rect.top + rect.height + GAP;
      if (top + card.h <= vh - MARGIN) return clamp(top, midX);
    } else if (side === "top") {
      const top = rect.top - GAP - card.h;
      if (top >= MARGIN) return clamp(top, midX);
    } else if (side === "right") {
      const left = rect.left + rect.width + GAP;
      if (left + card.w <= vw - MARGIN) return clamp(midY, left);
    } else {
      const left = rect.left - GAP - card.w;
      if (left >= MARGIN) return clamp(midY, left);
    }
  }
  return clamp(
    rect.top + rect.height - card.h - 16,
    rect.left + rect.width - card.w - 16
  );
}

// =========================================================
// PERSISTENCE
// =========================================================

// Browser storage can be missing or throw (private windows, blocked site
// data); the tour then just opens on every visit.
function hasSeen(key: string) {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

// Whether a tour is open anywhere on the page, for controls that don't work
// under the tour's overlay (the Copy menu's dropdown sits beneath it)
let tourOpen = false;
const tourListeners = new Set<() => void>();

function setTourOpen(value: boolean) {
  tourOpen = value;
  tourListeners.forEach((listener) => listener());
}

function subscribeTour(listener: () => void) {
  tourListeners.add(listener);
  return () => {
    tourListeners.delete(listener);
  };
}

export function useTourOpen() {
  return useSyncExternalStore(
    subscribeTour,
    () => tourOpen,
    () => false
  );
}

function markSeen(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable */
  }
}

// =========================================================
// MAIN COMPONENT
// =========================================================

interface GuidedTourProps {
  /** names the tour in storage; bump it to show a reworked tour again */
  id: string;
  steps: TourStep[];
  /** open by itself on a reader's first visit */
  autoStart?: boolean;
  /** classes for the launcher button */
  className?: string;
  /** runs as the tour opens, to set the page up for it */
  onStart?: () => void;
}

/**
 * A click-through product tour: a spotlight on one element at a time with a
 * card explaining it. The spotlit element stays live, so a step with a `task`
 * asks the reader to try it (drag a slider, click a parcel) before moving on.
 * On phones the card becomes a bottom sheet that swipes between steps.
 *
 * Targets are found by `data-tour="..."` attributes, so steps can be shared by
 * any view that tags the same elements.
 */
export function GuidedTour({
  id,
  steps,
  autoStart = true,
  className,
  onStart,
}: GuidedTourProps) {
  const storageKey = `uhero-tour:${id}`;
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [taskDone, setTaskDone] = useState(false);
  // Steps counted in the progress, checked on every move. Sections come and
  // go with the screen size and the reader (the lever drawer opens partway
  // through on phones), so a step that can't point at anything when reached
  // is skipped rather than shown over nothing.
  const [shown, setShown] = useState<number[]>([]);

  const step = steps[index];
  const position = shown.indexOf(index);
  const last = position === shown.length - 1;
  // what the card shows and points at: the step's follow-up once its task is done
  const turned = taskDone && !!step?.then;
  const view = turned ? { ...step, ...step.then } : step;
  const layout = useLayout(view?.target, open);

  const goTo = useCallback(
    (i: number) => {
      const available = steps.flatMap((s, j) =>
        j === i || isCounted(s) ? [j] : []
      );
      setShown(available);
      setIndex(i);
      setTaskDone(false);
    },
    [steps]
  );

  // the nearest step in a direction whose section is on the page now
  const nearest = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let j = from + dir; j >= 0 && j < steps.length; j += dir) {
        if (isAvailable(steps[j])) return j;
      }
      return null;
    },
    [steps]
  );

  const start = useCallback(() => {
    onStart?.();
    goTo(0);
    setOpen(true);
  }, [onStart, goTo]);

  const close = useCallback(() => {
    setOpen(false);
    markSeen(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    setTourOpen(true);
    return () => setTourOpen(false);
  }, [open]);

  const next = useCallback(() => {
    const j = nearest(index, 1);
    if (j === null) close();
    else goTo(j);
  }, [nearest, index, close, goTo]);

  const back = useCallback(() => {
    const j = nearest(index, -1);
    if (j !== null) goTo(j);
  }, [nearest, index, goTo]);

  // first visit: open once the page has settled
  useEffect(() => {
    if (!autoStart || open || hasSeen(storageKey)) return;
    const timer = window.setTimeout(start, 800);
    return () => window.clearTimeout(timer);
  }, [autoStart, open, storageKey, start]);

  // Bring the step's target into view, nested scroll panels included. "In
  // view" is what its panels show, less what the phone sheet covers: a panel
  // under the site header starts below it, so a target scrolled up behind the
  // header still needs scrolling. Checked for a while rather than once, as the
  // target may not be laid out yet when the step opens (a drawer still sliding
  // in, a card about to appear) or may move once it is (content loading above
  // it). The reader scrolling themselves ends it.
  useEffect(() => {
    if (!open || !view?.target) return;
    const target = view.target;
    let lastScroll = -Infinity;
    const check = () => {
      const el = findTarget(target);
      // on phones, wait for the sheet so its cover is known
      const sheet = document.querySelector<HTMLElement>("[data-tour-sheet]");
      if (!el || (isMobile() && !sheet)) return;
      const band = visibleBounds(el);
      if (sheet) {
        // its height, not its rect: it may still be sliding in
        const h = sheet.offsetHeight;
        if (sheet.dataset.tourSheet === "top") band.top = Math.max(band.top, h);
        else band.bottom = Math.min(band.bottom, window.innerHeight - h);
      }
      const r = el.getBoundingClientRect();
      const room = band.bottom - band.top;
      const tall = r.height > room * 0.8;
      // a tall target only needs to fill most of the band
      const seen = tall
        ? Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top) >=
          room * 0.6
        : r.top >= band.top - 1 && r.bottom <= band.bottom + 1;
      // one smooth scroll at a time
      if (seen || performance.now() - lastScroll < 600) return;
      lastScroll = performance.now();
      el.scrollIntoView({
        behavior: "smooth",
        // above the phone sheet, the top of the band is the free part
        block: tall || sheet ? "start" : "center",
      });
    };
    check();
    const timer = window.setInterval(check, 200);
    const stop = () => window.clearInterval(timer);
    const end = window.setTimeout(stop, 2500);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    return () => {
      stop();
      window.clearTimeout(end);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
    };
  }, [open, view?.target]);

  // hands-on steps: watch for the reader doing the task
  useEffect(() => {
    if (!open || !step?.task) return;
    const { until } = step.task;

    if (until) {
      // only a new match counts, not one already open when the step began
      const before = document.querySelector(until);
      const timer = window.setInterval(() => {
        const now = document.querySelector(until);
        if (now && now !== before) setTaskDone(true);
      }, 150);
      return () => window.clearInterval(timer);
    }

    const inside = (e: Event) => {
      const el = findTarget(step.target);
      return !!el && e.target instanceof Node && el.contains(e.target);
    };
    // a press that starts in the spotlight and is released anywhere: covers
    // clicks, taps and slider drags that end off the track
    let pressed = false;
    const down = (e: PointerEvent) => {
      pressed = inside(e);
    };
    const up = () => {
      if (pressed) setTaskDone(true);
      pressed = false;
    };
    const key = (e: KeyboardEvent) => {
      if (inside(e) && e.key !== "Tab") setTaskDone(true);
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("keyup", key, true);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("keyup", key, true);
    };
  }, [open, step]);

  // a task that leads straight into the next step moves on once it is done
  useEffect(() => {
    if (!open || !taskDone || !step?.task?.advance) return;
    const timer = window.setTimeout(next, 900);
    return () => window.clearTimeout(timer);
  }, [open, taskDone, step, next]);

  // Escape closes; arrows step, unless they are moving a slider or a field
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.matches("input, textarea, select, [contenteditable]") ||
          !!el.closest("[role=slider], [role=listbox], [role=menu]"));
      if (typing) return;
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, back]);

  // the cards count and jump among the steps on the page, not all of them
  const nav: NavProps = {
    index: Math.max(position, 0),
    total: shown.length,
    last,
    blocked: !!step?.task && !taskDone,
    onBack: back,
    onNext: next,
    // a dot for a step that isn't on screen yet lands on the next one that is
    onJump: (i) =>
      goTo(
        isAvailable(steps[shown[i]])
          ? shown[i]
          : (nearest(shown[i], 1) ?? shown[i])
      ),
    onClose: close,
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100",
          className
        )}
      >
        <CirclePlay className="size-4" aria-hidden />
        Take the tour
      </button>

      {open &&
        step &&
        layout &&
        createPortal(
          // the wrapper itself lets clicks through: only the inactive wash
          // and the card catch them, so the spotlit element stays live
          <div
            className="pointer-events-none fixed inset-0"
            style={{ zIndex: Z }}
          >
            <Spotlight layout={layout} />
            {layout.vw < MOBILE_W ? (
              <MobileSheet
                {...nav}
                // a fresh sheet slides in when it changes ends
                key={dockFor(layout)}
                dock={dockFor(layout)}
                title={view.title}
                titleId={titleId}
              >
                <StepContent
                  step={view}
                  index={index}
                  turned={turned}
                  taskDone={taskDone}
                  titleId={titleId}
                />
              </MobileSheet>
            ) : (
              <DesktopCard
                {...nav}
                layout={layout}
                placement={view.placement}
                titleId={titleId}
              >
                <StepContent
                  step={view}
                  index={index}
                  turned={turned}
                  taskDone={taskDone}
                  titleId={titleId}
                />
              </DesktopCard>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

// =========================================================
// SPOTLIGHT
// =========================================================

/**
 * Shades the page around the spotlit section, leaving the section itself
 * clear and clickable. The shade is the cutout's own shadow, so the cutout
 * keeps rounded corners; four invisible panels around it block clicks on the
 * rest of the page. With nothing to point at, the shade covers everything.
 */
function Spotlight({ layout }: { layout: Layout }) {
  const { rect, vw, vh } = layout;

  if (!rect) {
    return (
      <motion.div
        className="pointer-events-auto fixed inset-0"
        style={{ backgroundColor: SHADE }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />
    );
  }

  // the hole, clipped to the viewport
  const top = Math.max(rect.top, 0);
  const left = Math.max(rect.left, 0);
  const right = Math.min(rect.left + rect.width, vw);
  const bottom = Math.min(rect.top + rect.height, vh);
  const middle = Math.max(bottom - top, 0);

  const panels = [
    { top: 0, left: 0, width: vw, height: top },
    { top: bottom, left: 0, width: vw, height: vh - bottom },
    { top, left: 0, width: left, height: middle },
    { top, left: right, width: vw - right, height: middle },
  ];

  return (
    <>
      {panels.map((panel, i) => (
        <div
          key={i}
          className="pointer-events-auto fixed"
          style={{
            ...panel,
            width: Math.max(panel.width, 0),
            height: Math.max(panel.height, 0),
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ))}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed rounded-xl"
        style={{ boxShadow: `0 0 0 9999px ${SHADE}` }}
        initial={false}
        animate={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }}
        transition={SPRING}
      />
    </>
  );
}

// =========================================================
// CARD CONTENT (shared by the desktop card and the phone sheet)
// =========================================================

function StepContent({
  step,
  index,
  turned,
  taskDone,
  titleId,
}: {
  step: TourStep;
  index: number;
  /** showing the step's follow-up */
  turned: boolean;
  taskDone: boolean;
  titleId: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={`${index}${turned ? "-then" : ""}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
      >
        <h2 id={titleId} className="text-lg font-semibold text-slate-900">
          {step.title}
        </h2>
        <div className="mt-1.5 space-y-2 text-base leading-relaxed text-slate-600">
          {step.body}
        </div>

        {step.task && (
          <div
            className={cn(
              "mt-3 flex items-start gap-2 rounded-lg border px-2.5 py-2 text-base font-medium transition-colors",
              taskDone
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-dashed border-sky-300 bg-sky-50 text-sky-900"
            )}
            aria-live="polite"
          >
            {taskDone ? (
              <Check className="mt-1 size-4 shrink-0" aria-hidden />
            ) : (
              <MousePointerClick className="mt-1 size-4 shrink-0" aria-hidden />
            )}
            <span>{taskDone ? step.task.done : step.task.prompt}</span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

interface NavProps {
  /** position among the steps on the page */
  index: number;
  total: number;
  /** no step on the page after this one: Next reads "Finish" */
  last: boolean;
  /** a hands-on step the reader hasn't done yet: Next reads "Skip" */
  blocked: boolean;
  onBack: () => void;
  onNext: () => void;
  /** go to a position among the steps on the page */
  onJump: (i: number) => void;
  onClose: () => void;
}

const nextLabel = ({ last, blocked }: NavProps) =>
  last ? "Finish" : blocked ? "Skip" : "Next";

function CloseButton({
  onClose,
  large,
}: {
  onClose: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close tour"
      className={cn(
        "flex items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700",
        large ? "size-9" : "size-6"
      )}
    >
      <X className={large ? "size-4" : "size-3.5"} />
    </button>
  );
}

// =========================================================
// DESKTOP: a card beside the spotlight
// =========================================================

function DesktopCard({
  layout,
  placement,
  titleId,
  children,
  ...nav
}: NavProps & {
  layout: Layout;
  placement?: TourPlacement;
  titleId: string;
  children: ReactNode;
}) {
  const { rect, vw, vh } = layout;
  const { index, total, blocked, onBack, onNext, onJump, onClose } = nav;
  const cardRef = useRef<HTMLDivElement>(null);
  const cardH = useHeight(cardRef, 220);

  // keyboard focus follows the card so screen readers announce each step
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, [index]);

  // beside the spotlight, centred when there is nothing to point at
  const cardW = Math.min(CARD_W, vw - MARGIN * 2);
  const pos = rect
    ? placeCard(rect, { w: cardW, h: cardH }, vw, vh, placement)
    : { top: (vh - cardH) / 2, left: (vw - cardW) / 2 };

  return (
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      // short screens (a phone on its side) scroll the step instead of
      // pushing the card off the top
      className="pointer-events-auto fixed flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-2xl shadow-slate-900/25 outline-none"
      style={{ width: cardW, maxHeight: vh - MARGIN * 2 }}
      initial={{ opacity: 0, scale: 0.96, top: pos.top, left: pos.left }}
      animate={{ opacity: 1, scale: 1, top: pos.top, left: pos.left }}
      transition={SPRING}
    >
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Step {index + 1} of {total}
        </span>
        <CloseButton onClose={onClose} />
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-contain">
        {children}
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
        {/* progress, and a way to jump to any step */}
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === index ? "step" : undefined}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === index ? 16 : 6,
                backgroundColor: i <= index ? BRAND : "#cbd5e1",
              }}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {index > 0 && (
            <button
              type="button"
              onClick={onBack}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={onNext}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors",
              blocked
                ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                : "bg-[#1D667F] text-white hover:bg-[#2a7d99]"
            )}
          >
            {nextLabel(nav)}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// =========================================================
// PHONE: a bottom sheet
// =========================================================

/**
 * The card as a bottom sheet: full width, thumb-sized buttons, swipe left or
 * right to change steps. The handle collapses it to just the controls, so a
 * section it would cover can be seen and tried.
 */
// The sheet sits at the bottom unless it would cover more of the spotlit
// section there than at the top: a parcel card, the legend, or the Levers tab
// halfway down a short phone screen. Measured against the sheet at its
// tallest, so the side doesn't flip with the length of a step's text.
type Dock = "top" | "bottom";
const SHEET_MAX = 0.45; // of the screen height, as the sheet's max-h
const dockFor = ({ rect, vh }: Layout): Dock => {
  if (!rect || rect.height >= vh * 0.6) return "bottom";
  const underBottom = Math.max(
    rect.top + rect.height - vh * (1 - SHEET_MAX),
    0
  );
  const underTop = Math.max(vh * SHEET_MAX - rect.top, 0);
  return underTop < underBottom ? "top" : "bottom";
};

function MobileSheet({
  dock,
  title,
  titleId,
  children,
  ...nav
}: NavProps & {
  dock: Dock;
  title: string;
  titleId: string;
  children: ReactNode;
}) {
  const atTop = dock === "top";
  const { index, total, blocked, onBack, onNext, onClose } = nav;
  const sheetRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  // a swipe that ends on a button must not also press it
  const swiped = useRef(false);

  // every step opens expanded; screen readers hear the new step
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-expands the sheet when the step changes; the reader can collapse it again
    setCollapsed(false);
    sheetRef.current?.focus({ preventScroll: true });
  }, [index]);

  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // a mostly sideways swipe changes step; one toward the screen edge the
    // sheet is docked to collapses it, and the other way expands it
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped.current = true;
      if (dx < 0) onNext();
      else if (index > 0) onBack();
    } else if (Math.abs(dy) > SWIPE_PX && Math.abs(dy) > Math.abs(dx)) {
      swiped.current = true;
      setCollapsed(atTop ? dy < 0 : dy > 0);
    }
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swiped.current) return;
    swiped.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <motion.div
      ref={sheetRef}
      data-tour-sheet={dock}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      tabIndex={-1}
      // under half the screen (SHEET_MAX), so the page above it stays usable;
      // a long step scrolls inside
      className={cn(
        "pointer-events-auto fixed inset-x-0 flex max-h-[45svh] touch-pan-y flex-col border-slate-200 bg-white text-slate-900 outline-none",
        atTop
          ? "top-0 rounded-b-2xl border-b shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)]"
          : "bottom-0 rounded-t-2xl border-t shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.35)]"
      )}
      style={
        atTop
          ? { paddingTop: "max(env(safe-area-inset-top), 12px)" }
          : { paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }
      }
      initial={{ y: atTop ? "-100%" : "100%" }}
      animate={{ y: 0 }}
      transition={SPRING}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeStart.current = null)}
      onClickCapture={onClickCapture}
    >
      {/* handle, on the sheet's inner edge: tap or swipe to collapse and
          expand. touch-none so the browser doesn't take the swipe as a
          scroll */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expand tour card" : "Collapse tour card"}
        aria-expanded={!collapsed}
        className={cn(
          "flex w-full shrink-0 touch-none justify-center",
          atTop ? "order-last pb-2.5 pt-2" : "pb-1 pt-2.5"
        )}
      >
        <span className="h-1.5 w-10 rounded-full bg-slate-300" />
      </button>

      <div className="flex shrink-0 items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-500">
            {index + 1} / {total}
          </span>
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
            <motion.span
              className="block h-full rounded-full"
              style={{ backgroundColor: BRAND }}
              initial={false}
              animate={{ width: `${((index + 1) / total) * 100}%` }}
              transition={SPRING}
            />
          </span>
        </div>
        <CloseButton onClose={onClose} large />
      </div>

      {/* collapsed, the sheet keeps only the step title and the controls */}
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-1">
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="w-full truncate py-1 text-left text-base font-semibold text-slate-900"
          >
            {/* the title stays labelled for the dialog while collapsed */}
            <span id={titleId}>{title}</span>
          </button>
        ) : (
          children
        )}
      </div>

      <div className="mt-3 flex shrink-0 items-center gap-2 px-4">
        {index > 0 && (
          <button
            type="button"
            onClick={onBack}
            className="h-11 flex-1 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 active:bg-slate-100"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          className={cn(
            "h-11 flex-[2] rounded-lg text-sm font-semibold",
            blocked
              ? "border border-slate-200 text-slate-700 active:bg-slate-100"
              : "bg-[#1D667F] text-white active:bg-[#2a7d99]"
          )}
        >
          {nextLabel(nav)}
        </button>
      </div>
    </motion.div>
  );
}

// an element's rendered height, kept current as its content changes
function useHeight(ref: React.RefObject<HTMLElement | null>, initial: number) {
  const [height, setHeight] = useState(initial);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

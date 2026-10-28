// Schedules: the one rule shape for any value that depends on a quantity
// (lot size, construction value, cubic yards, units), such as a lot-size
// scaled FAR, tiered lot coverage, a permit fee table or the loading-space
// table. A county writes its rule as data in this shape; evaluateSchedule
// turns it into a number.

/**
 * One band of a schedule. Within the band:
 *
 *   linear:  base + ((x - over) * rate) / per
 *   stepped: base + round((x - over) / step) * rate
 *
 * A flat value is a band with only `base`.
 */
export interface Band {
  /** upper bound of x for this band; null = no limit */
  upTo: number | null;
  /** true: the band holds x <= upTo; false: x < upTo */
  inclusive: boolean;
  base: number;
  /** amount added per `per` units of x above `over` (or per step) */
  rate?: number;
  /** x below which nothing is added; default 0 */
  over?: number;
  /** divisor for `rate` in a linear band; default 1 */
  per?: number;
  /** step size; set it for a stepped band */
  step?: number;
  /** how a stepped band counts a partial step; default "ceil" */
  round?: "ceil" | "half_up";
}

export interface Schedule {
  /** checked in order; the first band that holds x applies */
  bands: Band[];
  /** result floor and ceiling, applied after the band */
  min?: number;
  max?: number;
  /** where the rule comes from, for example "ROH Table 21-3.3" */
  source: string;
}

/** a schedule with one value whatever x is */
export function flat(value: number, source: string): Schedule {
  return { bands: [{ upTo: null, inclusive: true, base: value }], source };
}

// § 21-6.20(b)(1), § 21-6.110(b)(3): a fraction of 0.5 or more rounds up
function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5 + 1e-9);
}

function holds(band: Band, x: number): boolean {
  if (band.upTo == null) return true;
  return band.inclusive ? x <= band.upTo : x < band.upTo;
}

/** the schedule's value at x; 0 if no band holds x */
export function evaluateSchedule(schedule: Schedule, x: number): number {
  const band = schedule.bands.find((b) => holds(b, x));
  if (!band) return 0;
  const over = band.over ?? 0;
  let value = band.base;
  if (band.rate != null) {
    if (band.step != null) {
      const steps = (x - over) / band.step;
      const counted =
        band.round === "half_up" ? roundHalfUp(steps) : Math.ceil(steps);
      value = band.base + counted * band.rate;
    } else {
      value = band.base + ((x - over) * band.rate) / (band.per ?? 1);
    }
  }
  if (schedule.min != null && value < schedule.min) value = schedule.min;
  if (schedule.max != null && value > schedule.max) value = schedule.max;
  return value;
}

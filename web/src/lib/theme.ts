// The Hawaiʻi Housing Lab palette: UHERO's blue, teal and orange. Tailwind's
// `brand` and `lock` colors (tailwind.config.ts) come from here, and so do the
// few places that set a color inline. The map's red, yellow and green
// feasibility colors are the engine's (LEVEL_COLOR) and stay apart from these.

/** UHERO blue and its shades: selected buttons, sliders, figures */
export const BRAND = {
  50: "#E9F3F6",
  100: "#D0E5EB",
  600: "#2A7D99",
  700: "#1D667F",
  900: "#123F4F",
} as const;

/** the main brand color */
export const BRAND_COLOR = BRAND[700];

/** a lever at the scenario's default */
export const DEFAULT_COLOR = "#4BACC6";

/** a lever the user has set, which keeps its value across scenarios */
export const LOCK_COLOR = "#F6A01B";

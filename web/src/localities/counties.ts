// The counties the tool can show, keyed by the engine's locality ids. Bounds
// are [south-west, north-east] corners in latitude and longitude, framing each
// county's islands on the map.

export type CountyId = "hi-honolulu" | "hi-maui" | "hi-hawaii" | "hi-kauai";

export interface County {
  id: CountyId;
  label: string;
  bounds: [[number, number], [number, number]];
}

export const COUNTIES: readonly County[] = [
  // Oʻahu
  { id: "hi-honolulu", label: "Honolulu", bounds: [[21.25, -158.29], [21.72, -157.64]] },
  // Maui, Molokaʻi, Lānaʻi and Kahoʻolawe
  { id: "hi-maui", label: "Maui", bounds: [[20.5, -157.32], [21.23, -155.97]] },
  // Hawaiʻi Island
  { id: "hi-hawaii", label: "Hawaiʻi", bounds: [[18.9, -156.07], [20.28, -154.8]] },
  // Kauaʻi and Niʻihau
  { id: "hi-kauai", label: "Kauaʻi", bounds: [[21.75, -160.25], [22.25, -159.28]] },
];

export const DEFAULT_COUNTY: CountyId = "hi-honolulu";

export const countyOf = (id: CountyId): County =>
  COUNTIES.find((c) => c.id === id) ?? COUNTIES[0];

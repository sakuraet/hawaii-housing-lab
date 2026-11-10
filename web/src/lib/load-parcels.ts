// load-parcels.ts — loads each program's (Honolulu) or county's parcel data
// only when it's needed.
//
// Each data file is about 1 MB. We used to load all five when the page opened,
// which made the map slow to appear. Now we load just the program on screen
// first, and grab the others in the background afterwards.

import { useEffect, useState } from "react";

import type { ParcelRow } from "@/lib/parcels";

// One loader per program. Each file is only downloaded when we ask for it,
// not all at once when the page opens. The files are served from
// public/data/, which git ignores (see public/data/README.md).
const fetchJson = (file: string) => async () => {
  const res = await fetch(`/data/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return { default: (await res.json()) as unknown };
};
// Honolulu has a file per pathway; each other county has one file, run on
// its current zoning
const PATHWAY_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  bill6: fetchJson("parcels-bill6.json"),
  bill7: fetchJson("parcels-bill7.json"),
  standard: fetchJson("parcels-standard.json"),
  tod: fetchJson("parcels-tod.json"),
  h201: fetchJson("parcels-h201.json"),
};
const LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  ...PATHWAY_LOADERS,
  "hi-maui": fetchJson("parcels-hi-maui.json"),
  "hi-hawaii": fetchJson("parcels-hi-hawaii.json"),
  "hi-kauai": fetchJson("parcels-hi-kauai.json"),
};

// Picks which data file to use: the county's, or for Honolulu the program's.
// If the program isn't in the list, use bill6 so the map is never empty.
export function dataKeyFor(program: string, county = "hi-honolulu"): string {
  if (county !== "hi-honolulu") return county;
  return program in PATHWAY_LOADERS ? program : "bill6";
}

// `rows` stores data that's finished loading, so going back to a program
// is instant.
// `pending` stores downloads that are still in progress, so we never
// download the same file twice.
const rows = new Map<string, ParcelRow[]>();
const pending = new Map<string, Promise<ParcelRow[]>>();

// Downloads one data file and saves it in `rows`.
// If the download fails, it's removed from `pending` so the next request
// tries again instead of getting the same failure forever.
async function download(key: string): Promise<ParcelRow[]> {
  try {
    const m = await LOADERS[key]();
    const data = m.default as ParcelRow[];
    rows.set(key, data);
    return data;
  } catch (err) {
    pending.delete(key);
    throw err;
  }
}

// Loads one program's (Honolulu) or county's data.
export function loadParcels(program: string, county?: string): Promise<ParcelRow[]> {
  const key = dataKeyFor(program, county);
  let p = pending.get(key);
  if (!p) {
    p = download(key);
    pending.set(key, p);
  }
  return p;
}

// Loads every Honolulu program's data in the background, so switching
// programs later is fast. Called once the first program is showing.
// A failed background download is fine to ignore — it retries on demand.
export async function prefetchAllParcels() {
  await Promise.allSettled(
    Object.keys(PATHWAY_LOADERS).map((program) => loadParcels(program))
  );
}

// Gives the dashboard the parcels for the current program and county.
// If they're loaded, it returns them. If not, it returns null (so the loader
// shows), then updates the page once the data arrives.
export function useParcels(program: string, county?: string): ParcelRow[] | null {
  // `rows` lives outside React, so React can't tell when new data lands in it.
  // Bumping this counter is how we tell React "re-render and check again".
  const [, setVersion] = useState(0);
  const data = rows.get(dataKeyFor(program, county)) ?? null;

  useEffect(() => {
    if (data) return;
    let live = true;
    // effects can't be async themselves, so the await lives in here
    const load = async () => {
      try {
        await loadParcels(program, county);
        if (live) setVersion((v) => v + 1);
      } catch (err) {
        // keep the loader up; switching programs and back will retry
        console.error(`Failed to load ${dataKeyFor(program, county)} parcels`, err);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, [program, county, data]);

  return data;
}

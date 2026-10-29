// The localities the model knows, by id. A parcel or a set of inputs names
// its county with `locality` (for example "hi-maui"); without one it is
// Honolulu, as in the original model.

import type { Locality, PathwayId } from "../core/locality";
import { honolulu } from "./hi/honolulu";
import { maui } from "./hi/maui";

const LOCALITIES = new Map<string, Locality>([
  [honolulu.id, honolulu],
  [maui.id, maui],
]);

/** the locality's id when a parcel or inputs name none */
export const DEFAULT_LOCALITY_ID = honolulu.id;

/** add a locality the model can run, such as a new county's config */
export function registerLocality(loc: Locality): void {
  LOCALITIES.set(loc.id, loc);
}

/** the ids of every locality the model can run */
export function localityIds(): string[] {
  return [...LOCALITIES.keys()];
}

/** the locality with this id; Honolulu when there is none; an error for an
 *  id the model does not know */
export function getLocality(id?: string): Locality {
  if (id == null) return honolulu;
  const loc = LOCALITIES.get(id);
  if (!loc) {
    throw new Error(`Unknown locality "${id}". Known: ${localityIds().join(", ")}`);
  }
  return loc;
}

/** stops a run of a pathway the locality does not have */
export function assertPathway(loc: Locality, program: PathwayId): void {
  if (!loc.pathways.includes(program)) {
    throw new Error(
      `${loc.name} (${loc.id}) has no "${program}" pathway. It has: ${loc.pathways.join(", ")}`
    );
  }
}

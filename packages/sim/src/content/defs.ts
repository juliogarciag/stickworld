/**
 * Every def in the game, keyed by a numeric id. Ids are forever: never reuse
 * or renumber one, even after its thing is removed.
 *
 * Each feature claims a block of 100 ids here and spreads its list in below.
 * Claimed blocks:
 *
 *     0-99     reserved
 *     200-299  inventory: the items the stick man can hold (features/inventory/defs.ts)
 *
 * The next free block is 300-399.
 */
import { itemDefs } from '../features/inventory/defs';

export interface Def {
  readonly id: number;
  readonly name: string;
}

export const defs: readonly Def[] = [...itemDefs];

assertUniqueIds(defs);

/** The def with this id, or undefined if none has it. */
export function getDef(id: number): Def | undefined {
  return defs.find((def) => def.id === id);
}

// ---- Helpers ----

function assertUniqueIds(list: readonly Def[]): void {
  const seen = new Set<number>();
  for (const def of list) {
    if (seen.has(def.id)) throw new Error(`two defs claim id ${def.id}`);
    seen.add(def.id);
  }
}

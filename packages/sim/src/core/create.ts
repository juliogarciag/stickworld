import { features } from '../features';
import { Sim, type SimHandle } from './sim';
import type { SimSnapshot } from './snapshot';

export interface CreateSimOptions {
  /** The level to start on, by id. */
  readonly level: number;
  /** Seed for the sim's rng. Same seed + same commands = same state. */
  readonly seed?: number;
}

/** A sim running every registered feature, at the start of `level`. */
export function createSim({ level, seed = 1 }: CreateSimOptions): SimHandle {
  return new Sim({ features, start: { seed, level } });
}

/** A sim that continues from `snapshot` exactly as the sim it was taken from would have. */
export function restoreSim(snapshot: SimSnapshot): SimHandle {
  return new Sim({ features, snapshot });
}

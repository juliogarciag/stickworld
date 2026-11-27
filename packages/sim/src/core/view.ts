import { getLevelById } from '../content/levels';
import type { Level } from '../content/levels/types';
import type { SimHandle } from './sim';

/**
 * What views read. Every function here takes a SimHandle and returns plain
 * data to draw; none of them change the sim. Features add their own view
 * functions next to their code and export them from `src/index.ts`.
 */

/** The level the sim is playing, as its data file has it: the floor to draw and what is placed on it. */
export function getLevel(sim: SimHandle): Level {
  return getLevelById(sim.level);
}

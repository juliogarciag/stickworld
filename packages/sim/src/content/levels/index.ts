import { level1 } from './level1';
import type { Level } from './types';

/** Every level, in the order they are played. Add a new level by adding one line here; the level itself is a new file next to this one. */
export const levels: readonly Level[] = [level1];

/** The level with this id. Throws for an id no level has: asking for a level that does not exist is a bug in the caller. */
export function levelById(id: number): Level {
  const level = levels.find((candidate) => candidate.id === id);
  if (!level) throw new RangeError(`no level ${id}; the levels are ${levels.map((candidate) => candidate.id).join(', ')}`);
  return level;
}

import { clubRow } from './clubRow';
import { clubYard } from './clubYard';
import { level1 } from './level1';
import { level2 } from './level2';
import { level3 } from './level3';
import type { Level } from './types';

/**
 * Every level, in the order they are played. Add a new level by adding one line here; the level
 * itself is a new file next to this one.
 */
export const levels: readonly Level[] = [level1, level2, level3];

/**
 * Levels that are not part of the game: no level leads to one and its flag leads nowhere. Each is
 * a place to try something whose own level does not exist yet, reached only by its id
 * (`VITE_LEVEL=<id>`, `loadLevel(<id>)` in a dev build, `createSim({ level })` in a test).
 */
export const practiceLevels: readonly Level[] = [clubYard, clubRow];

/**
 * The level with this id, of the game or for practice. Throws for an id no level has: asking for a
 * level that does not exist is a bug in the caller.
 */
export function getLevelById(id: number): Level {
  const level = [...levels, ...practiceLevels].find((candidate) => candidate.id === id);
  if (!level) {
    throw new RangeError(
      `no level ${id}; the levels are ${[...levels, ...practiceLevels].map((candidate) => candidate.id).join(', ')}`,
    );
  }
  return level;
}

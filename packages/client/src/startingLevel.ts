import { levels, practiceLevels } from '@stickworld/sim';

/**
 * The level a dev build starts on: `VITE_LEVEL` when it names a level that exists, of the game or
 * for practice, else the first.
 */
export function getStartingLevel(configured: string | undefined): number {
  const requested = Number(configured);
  const found = [...levels, ...practiceLevels].find((level) => level.id === requested);
  return found ? found.id : (levels[0]?.id ?? 1);
}

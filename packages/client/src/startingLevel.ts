import { levels } from '@stickworld/sim';

/** The level a dev build starts on: `VITE_LEVEL` when it names a level that exists, else the first. */
export function startingLevel(configured: string | undefined): number {
  const requested = Number(configured);
  const found = levels.find((level) => level.id === requested);
  return found ? found.id : (levels[0]?.id ?? 1);
}

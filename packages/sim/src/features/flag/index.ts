import { levels } from '../../content/levels';
import type { Level, Placement } from '../../content/levels/types';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Feature } from '../../core/feature';
import { playerSlice } from '../player/state';
import { FLAG_DEF_ID, flagDef, LEVEL_END } from './defs';
import { flagSlice } from './state';

/**
 * The flag at the end of a level. Touching it finishes the level; after a
 * short pause the next level starts, when there is one.
 */
export const flagFeature: Feature = {
  name: 'flag',
  slices: [flagSlice],

  update(sim) {
    const flag = sim.stateOf(flagSlice);
    if (flag.reachedAtTick === null) {
      const placed = flagPlacedIn(sim.levelDef);
      const { x, y } = sim.stateOf(playerSlice);
      if (placed && touchesFlag({ feet: { x, y }, placed })) flag.reachedAtTick = sim.tick;
      return;
    }
    const nextLevel = levelToStartNow({ levels, level: sim.level, ticksSinceReached: sim.tick - flag.reachedAtTick, dt: sim.dt });
    if (nextLevel) sim.startLevel(nextLevel.id);
  },
};

/** Where the level's flag stands, or undefined for a level without one. */
export function flagPlacedIn(level: Level): Placement | undefined {
  return level.placements.find((placement) => placement.defId === FLAG_DEF_ID);
}

// ---- Helpers ----

/** True when he is within reach of the stick and any part of him is level with it: he cannot jump over a flag taller than his jump. */
function touchesFlag({ feet, placed }: { feet: { x: number; y: number }; placed: Placement }): boolean {
  const withinReach = Math.abs(feet.x - placed.at.x) <= flagDef.reach;
  const levelWithTheStick = feet.y >= placed.at.y - flagDef.height && feet.y - STICK_MAN_HEIGHT <= placed.at.y;
  return withinReach && levelWithTheStick;
}

interface FinishedLevel {
  /** Every level, in the order they are played. */
  readonly levels: readonly Level[];
  /** The id of the finished level. */
  readonly level: number;
  readonly ticksSinceReached: number;
  readonly dt: number;
}

/** The level that follows the finished one, once the pause after its flag is over; undefined during the pause and after the last level. */
function levelToStartNow({ levels, level, ticksSinceReached, dt }: FinishedLevel): Level | undefined {
  if (ticksSinceReached < Math.round(LEVEL_END.pauseBeforeNextLevel / dt)) return undefined;
  const finished = levels.findIndex((candidate) => candidate.id === level);
  return finished === -1 ? undefined : levels[finished + 1];
}

export const __testing__ = { levelToStartNow };

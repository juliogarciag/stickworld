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
    const next = levelAfter(sim.level);
    const pauseIsOver = (sim.tick - flag.reachedAtTick) * sim.dt >= LEVEL_END.pauseBeforeNextLevel;
    if (next && pauseIsOver) sim.startLevel(next.id);
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

function levelAfter(id: number): Level | undefined {
  return levels[levels.findIndex((level) => level.id === id) + 1];
}

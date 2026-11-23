import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import type { WalkDirection } from './commands';
import { hasFinishedLevel, walkDirectionNow } from './index';
import { playerSlice } from './state';

/** The stick man as a view needs him: where he is and what he is doing. Which way each limb points is the view's business. */
export interface StickManView {
  /** Where his feet are, in metres. */
  readonly feet: Point;
  /** 1 when he looks right, -1 when he looks left. */
  readonly facing: 1 | -1;
  /** `jumping` is any time his feet are off the floor; `cheering` is standing on the floor with the level finished. */
  readonly action: 'standing' | 'walking' | 'jumping' | 'cheering';
  /** Metres walked on the floor since he last stood still or landed: how far along his walk he is. */
  readonly distanceWalked: number;
  /** Metres per second, positive when he falls: how far along a jump he is. 0 on the floor. */
  readonly verticalSpeed: number;
  /** Metres per second, positive to the right: how fast he is going sideways, on the floor or drifting in the air. */
  readonly horizontalSpeed: number;
  /** Which way the sim believes the player wants to walk, whether or not he can right now. */
  readonly walkDirectionAsked: WalkDirection;
}

export function stickManOf(handle: SimHandle): StickManView {
  const sim = simBehind(handle);
  const player = sim.stateOf(playerSlice);
  return {
    feet: { x: player.x, y: player.y },
    facing: player.facing,
    action: !player.onFloor ? 'jumping' : hasFinishedLevel(sim) ? 'cheering' : walkDirectionNow(sim) !== 0 ? 'walking' : 'standing',
    distanceWalked: player.distanceWalked,
    verticalSpeed: player.verticalSpeed,
    horizontalSpeed: player.horizontalSpeed,
    walkDirectionAsked: player.walkDirection,
  };
}

// ---- Helpers ----

/** Every SimHandle is a Sim: `createSim` and `restoreSim` are the only ways to get one. */
function simBehind(handle: SimHandle): Sim {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return handle;
}

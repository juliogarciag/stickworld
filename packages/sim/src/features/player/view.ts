import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import type { WalkDirection } from './commands';
import { hasFinishedLevel, isFallingOffAnEdge, walkDirectionNow } from './index';
import { playerSlice } from './state';

/** The stick man as a view needs him: where he is and what he is doing. Which way each limb points is the view's business. */
export interface StickManView {
  /** Where his feet are, in metres. */
  readonly feet: Point;
  /** 1 when he looks right, -1 when he looks left. */
  readonly facing: 1 | -1;
  /**
   * `jumping` is any time his feet are off the floor and he is not seated; `cheering` is standing on the floor with the
   * level finished; `seated` is sitting in the airplane, and then `feet` is the middle of its underside.
   */
  readonly action: 'standing' | 'walking' | 'jumping' | 'cheering' | 'seated';
  /** Metres walked on the floor since he last stood still or landed: how far along his walk he is. */
  readonly distanceWalked: number;
  /** Metres per second, positive when he falls: how far along a jump he is. 0 on the floor. */
  readonly verticalSpeed: number;
  /** Metres per second, positive to the right: how fast he went sideways this tick, walking, jumping or drifting as he falls off an edge. On the tick he lands it is still the speed he came down with. */
  readonly horizontalSpeed: number;
  /** True while he is in the air because he walked off an edge, and not because he jumped: the fall that has momentum. */
  readonly fallingOffAnEdge: boolean;
  /** Which way the sim believes the player wants to walk, whether or not he can right now. */
  readonly walkDirectionAsked: WalkDirection;
  /** True while he holds something over his head with both hands (the airplane, as `airplaneOf` has it). */
  readonly carrying: boolean;
}

export function stickManOf(handle: SimHandle): StickManView {
  const sim = simBehind(handle);
  const player = sim.stateOf(playerSlice);
  return {
    feet: { x: player.x, y: player.y },
    facing: player.facing,
    action: player.seated ? 'seated' : !player.onFloor ? 'jumping' : hasFinishedLevel(sim) ? 'cheering' : walkDirectionNow(sim) !== 0 ? 'walking' : 'standing',
    distanceWalked: player.distanceWalked,
    verticalSpeed: player.verticalSpeed,
    horizontalSpeed: player.horizontalSpeed,
    fallingOffAnEdge: isFallingOffAnEdge(player),
    walkDirectionAsked: player.walkDirection,
    carrying: player.carrying,
  };
}

// ---- Helpers ----

/** Every SimHandle is a Sim: `createSim` and `restoreSim` are the only ways to get one. */
function simBehind(handle: SimHandle): Sim {
  if (!(handle instanceof Sim)) throw new TypeError('not a sim made by createSim or restoreSim');
  return handle;
}

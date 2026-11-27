import type { Point } from '../../content/levels/types';
import { Sim, type SimHandle } from '../../core/sim';
import type { WalkDirection } from './commands';
import type { MovementTuning } from './defs';
import { isFallingOffEdge, isStandingCheering, getWalkDirectionNow } from './index';
import { movementTuningSlice, playerSlice } from './state';

/**
 * The stick man as a view needs it: where the stick man is and what it is doing. Which way each
 * limb points is the view's business.
 */
export interface StickManView {
  /** Where the stick man's feet are, in metres. */
  readonly feet: Point;
  /** 1 when the stick man looks right, -1 when it looks left. */
  readonly facing: 1 | -1;
  /**
   * `jumping` is any time the stick man's feet are off the floor and it is not seated; `cheering`
   * is standing on the floor under the flag the stick man reached, which on the last level ends
   * when playing again is offered; `seated` is sitting in the airplane, and then `feet` is the
   * middle of its underside.
   */
  readonly action: 'standing' | 'walking' | 'jumping' | 'cheering' | 'seated';
  /**
   * Metres walked on the floor since the stick man last stood still or landed: how far along the
   * stick man's walk it is.
   */
  readonly distanceWalked: number;
  /**
   * Metres per second, positive when the stick man falls: how far along a jump the stick man is. 0
   * on the floor.
   */
  readonly verticalSpeed: number;
  /**
   * Metres per second, positive to the right: how fast the stick man went sideways this tick,
   * walking, jumping or drifting as it falls off an edge. On the tick the stick man lands it is
   * still the speed the stick man came down with.
   */
  readonly horizontalSpeed: number;
  /**
   * True while the stick man is in the air because it walked off an edge, and not because it
   * jumped: the fall that has momentum.
   */
  readonly isFallingOffEdge: boolean;
  /**
   * Which way the sim believes the player wants to walk, whether or not the stick man can right
   * now.
   */
  readonly walkDirectionAsked: WalkDirection;
  /**
   * True while the stick man holds something over the stick man's head with both hands (the
   * airplane, as `getAirplane` has it).
   */
  readonly isCarrying: boolean;
}

export function getStickMan(handle: SimHandle): StickManView {
  const sim = getSimBehind(handle);
  const player = sim.getStateOf(playerSlice);
  return {
    feet: { x: player.x, y: player.y },
    facing: player.facing,
    action: player.isSeated
      ? 'seated'
      : !player.isOnFloor
        ? 'jumping'
        : isStandingCheering(sim)
          ? 'cheering'
          : getWalkDirectionNow(sim) !== 0
            ? 'walking'
            : 'standing',
    distanceWalked: player.distanceWalked,
    verticalSpeed: player.verticalSpeed,
    horizontalSpeed: player.horizontalSpeed,
    isFallingOffEdge: isFallingOffEdge(player),
    walkDirectionAsked: player.walkDirection,
    isCarrying: player.isCarrying,
  };
}

/**
 * How the stick man walks, jumps and falls right now: what the movement panel of a dev build shows
 * and changes.
 */
export function getMovementTuning(handle: SimHandle): MovementTuning {
  return { ...getSimBehind(handle).getStateOf(movementTuningSlice) };
}

// ---- Helpers ----

/** Every SimHandle is a Sim: `createSim` and `restoreSim` are the only ways to get one. */
function getSimBehind(handle: SimHandle): Sim {
  if (!(handle instanceof Sim)) {
    throw new TypeError('not a sim made by createSim or restoreSim');
  }
  return handle;
}

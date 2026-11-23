import type { Level } from '@stickworld/sim';
import type { HeldDirection } from '../input/walkKeys';
import { walkCycleLength, type StickManPose } from '../render/stickMan';

/**
 * LOOK TEST ONLY (issue #1). A stick man who walks along the floor without
 * the sim knowing: there is no walking rule yet. The Level 1 ticket (issue
 * #2) puts his position, facing and walk cycle in the sim and deletes this
 * file; the scene then draws the pose the sim gives it.
 *
 * Until an arrow key is pressed he paces from one end of the floor to the
 * other by himself. After that the arrow keys walk him and he stands when
 * none is held.
 */

/** How fast the demo walks, in metres per second, and how close to the floor's ends he turns round. Not tuning: the sim will own both. */
const DEMO = { speed: 1.5, turnMargin: 0.6 } as const;

export interface WalkDemo {
  /** Moves him by `seconds` of walking and returns the pose to draw. */
  walkFor(seconds: number, held: HeldDirection): StickManPose;
  /** The pose as it is now. */
  pose(): StickManPose;
  /** Stops him where he is (or lets him go again), so a check can look at a still picture. */
  setPaused(paused: boolean): void;
}

export function walkAlongTheFloor(level: Level): WalkDemo {
  const first = level.floor[0];
  const last = level.floor[level.floor.length - 1];
  const leftEnd = (first?.from.x ?? level.start.x) + DEMO.turnMargin;
  const rightEnd = (last?.to.x ?? level.start.x) - DEMO.turnMargin;
  const cycleLength = walkCycleLength();

  let x = level.start.x;
  let facing: 1 | -1 = 1;
  let walkCycle = 0;
  let walking = true;
  let paused = false;
  let keysTookOver = false;

  const pose = (): StickManPose => ({ feet: { x, y: level.start.y }, facing, action: walking ? 'walking' : 'standing', walkCycle });

  return {
    pose,
    setPaused(next) {
      paused = next;
    },
    walkFor(seconds, held) {
      if (paused) return pose();
      if (held !== 0) keysTookOver = true;
      if (keysTookOver) {
        walking = held !== 0;
        if (held !== 0) facing = held;
      } else if ((facing === 1 && x >= rightEnd) || (facing === -1 && x <= leftEnd)) {
        facing = facing === 1 ? -1 : 1;
      }
      if (!walking) {
        walkCycle = 0;
        return pose();
      }
      const reached = Math.max(leftEnd, Math.min(rightEnd, x + facing * DEMO.speed * seconds));
      walkCycle = (walkCycle + Math.abs(reached - x) / cycleLength) % 1;
      x = reached;
      return pose();
    },
  };
}

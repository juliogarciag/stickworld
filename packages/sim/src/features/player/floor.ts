import type { FloorSegment } from '../../content/levels/types';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
import { PLAYER } from './defs';

/** How high the floor is at `x`, or undefined over a gap or past the floor's ends. */
export function floorHeightAt(floor: readonly FloorSegment[], x: number): number | undefined {
  const segment = floor.find(({ from, to }) => from.x <= x && x <= to.x);
  if (!segment) return undefined;
  const { from, to } = segment;
  return from.y + ((x - from.x) / (to.x - from.x)) * (to.y - from.y);
}

/** The y of the floor's lowest point (y points down, so the largest). */
export function lowestFloorHeight(floor: readonly FloorSegment[]): number {
  return Math.max(...floor.flatMap(({ from, to }) => [from.y, to.y]));
}

/**
 * How far to each side of his feet his body reaches, `aboveFeet` metres above them: nothing at his feet, widening to
 * half his width, and nothing again above his head. He is a controlled body with a simple outline, not a shape with physics.
 */
export function bodyReachAt(aboveFeet: number): number {
  if (aboveFeet <= 0 || aboveFeet >= STICK_MAN_HEIGHT) return 0;
  return (STICK_MAN_WIDTH / 2) * Math.min(1, aboveFeet / PLAYER.fullWidthAbove);
}

/**
 * Where a body in the air at `feet` has to be so that no floor segment's end is inside it, or undefined when it is clear
 * already. `awayFromFloor` is the side the end pushed him to: 1 to the right, -1 to the left. Right for flat floors with
 * gaps wider than he is, which is all the levels have: each segment pushes by the height of its nearer end.
 */
export function clearOfFloorEnds(floor: readonly FloorSegment[], feet: { readonly x: number; readonly y: number }): { x: number; awayFromFloor: 1 | -1 } | undefined {
  for (const { from, to } of floor) {
    const nearerEnd = feet.x < (from.x + to.x) / 2 ? from : to;
    const awayFromFloor = nearerEnd === from ? -1 : 1;
    const reach = bodyReachAt(feet.y - nearerEnd.y);
    const x = nearerEnd.x + awayFromFloor * reach;
    if (reach > 0 && (x - feet.x) * awayFromFloor > 0) return { x, awayFromFloor };
  }
  return undefined;
}

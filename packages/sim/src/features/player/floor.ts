import type { FloorSegment } from '../../content/levels/types';
import { STICK_MAN_HEIGHT, STICK_MAN_WIDTH } from '../../content/tuning';
import { PLAYER } from './defs';

/** How high the floor is at `x`, or undefined over a gap or past the floor's ends. */
export function getFloorHeightAt(floor: readonly FloorSegment[], x: number): number | undefined {
  const segment = floor.find((segment) => segment.start.x <= x && x <= segment.end.x);
  if (!segment) {
    return undefined;
  }
  const { start, end } = segment;
  return start.y + ((x - start.x) / (end.x - start.x)) * (end.y - start.y);
}

/**
 * Where a step from `from` towards `to` ends when the ends of the floor line under `from` stop it:
 * `to`, or the end of the line less half the stick man's width. `to` itself when there is no line
 * under `from`.
 */
export function keepOverLine(
  floor: readonly FloorSegment[],
  range: { readonly start: number; readonly end: number },
): number {
  const line = floor.find(
    (segment) => segment.start.x <= range.start && range.start <= segment.end.x,
  );
  if (!line) {
    return range.end;
  }
  return Math.max(
    line.start.x + STICK_MAN_WIDTH / 2,
    Math.min(line.end.x - STICK_MAN_WIDTH / 2, range.end),
  );
}

/** The y of the floor's lowest point (y points down, so the largest). */
export function getLowestFloorHeight(floor: readonly FloorSegment[]): number {
  return Math.max(...floor.flatMap((segment) => [segment.start.y, segment.end.y]));
}

/**
 * Where a body in the air at `feet` has to be so that no floor segment's end is inside it, or
 * undefined when it is clear already. `awayFromFloor` is the side the end pushed the stick man to:
 * 1 to the right, -1 to the left. Right for flat floors with gaps wider than the stick man is,
 * which is all the levels have: each segment pushes by the height of its nearer end.
 */
export function findClearOfFloorEnds(
  floor: readonly FloorSegment[],
  feet: { readonly x: number; readonly y: number },
): { x: number; awayFromFloor: 1 | -1 } | undefined {
  for (const { start, end } of floor) {
    const nearerEnd = feet.x < (start.x + end.x) / 2 ? start : end;
    const awayFromFloor = nearerEnd === start ? -1 : 1;
    const reach = getBodyReachAt(feet.y - nearerEnd.y);
    const x = nearerEnd.x + awayFromFloor * reach;
    if (reach > 0 && (x - feet.x) * awayFromFloor > 0) {
      return { x, awayFromFloor };
    }
  }
  return undefined;
}

// ---- Helpers ----

/**
 * How far to each side of the stick man's feet its body reaches, `aboveFeet` metres above them:
 * nothing at the stick man's feet, widening to half its width, and nothing again above its head.
 * The stick man is a controlled body with a simple outline, not a shape with physics.
 */
function getBodyReachAt(aboveFeet: number): number {
  if (aboveFeet <= 0 || aboveFeet >= STICK_MAN_HEIGHT) {
    return 0;
  }
  return (STICK_MAN_WIDTH / 2) * Math.min(1, aboveFeet / PLAYER.fullWidthAbove);
}

import type { Point } from '@stickworld/sim';

/** A straight line between two points. Twice the same point is that point alone. */
export type Line = readonly [Point, Point];

/** How far apart two straight lines are at their closest: 0 when they cross or touch. */
export function distanceBetweenLines(one: Line, other: Line): number {
  if (linesCross(one, other)) return 0;
  return Math.min(distanceToLine(one[0], other), distanceToLine(one[1], other), distanceToLine(other[0], one), distanceToLine(other[1], one));
}

// ---- Helpers ----

function distanceToLine(point: Point, [from, to]: Line): number {
  const along = { x: to.x - from.x, y: to.y - from.y };
  const lengthSquared = along.x * along.x + along.y * along.y;
  const share = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * along.x + (point.y - from.y) * along.y) / lengthSquared));
  return Math.hypot(point.x - (from.x + along.x * share), point.y - (from.y + along.y * share));
}

/** True when each line has its two ends on opposite sides of the other. Lines that only touch are caught by the distances. */
function linesCross([a, b]: Line, [c, d]: Line): boolean {
  const side = (from: Point, to: Point, point: Point): number => Math.sign((to.x - from.x) * (point.y - from.y) - (to.y - from.y) * (point.x - from.x));
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

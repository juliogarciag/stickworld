import type { Point } from '@stickworld/sim';

/** A straight line between two points. Twice the same point is that point alone. */
export type Line = readonly [Point, Point];

/** How far apart two straight lines are at their closest: 0 when they cross or touch. */
export function measureDistanceBetweenLines(one: Line, other: Line): number {
  if (areLinesCrossing(one, other)) {
    return 0;
  }
  return Math.min(
    measureDistanceToLine(one[0], other),
    measureDistanceToLine(one[1], other),
    measureDistanceToLine(other[0], one),
    measureDistanceToLine(other[1], one),
  );
}

// ---- Helpers ----

function measureDistanceToLine(point: Point, [start, end]: Line): number {
  const direction = { x: end.x - start.x, y: end.y - start.y };
  const lengthSquared = direction.x * direction.x + direction.y * direction.y;
  const share =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * direction.x + (point.y - start.y) * direction.y) / lengthSquared,
          ),
        );
  return Math.hypot(
    point.x - (start.x + direction.x * share),
    point.y - (start.y + direction.y * share),
  );
}

/**
 * True when each line has its two ends on opposite sides of the other. Lines that only touch are
 * caught by the distances.
 */
function areLinesCrossing(one: Line, other: Line): boolean {
  const getSideOf = ([start, end]: Line, point: Point): number =>
    Math.sign((end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x));
  return (
    getSideOf(one, other[0]) * getSideOf(one, other[1]) < 0 &&
    getSideOf(other, one[0]) * getSideOf(other, one[1]) < 0
  );
}

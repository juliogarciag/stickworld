import type { FloorSegment } from '../../content/levels/types';

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

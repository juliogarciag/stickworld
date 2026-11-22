import type { Level } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { toPixels } from './units';

/** The level's floor as pencil strokes in world pixels: one line per segment, so a gap stays a gap. */
export function floorStrokes(level: Level): Stroke[] {
  return level.floor.map(({ from, to }) => ({
    points: [
      { x: toPixels(from.x), y: toPixels(from.y) },
      { x: toPixels(to.x), y: toPixels(to.y) },
    ],
    thickness: PENCIL.thickness,
  }));
}

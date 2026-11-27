import type { Level } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/** The level's floor as pencil strokes in world pixels: one line per segment, so a gap stays a gap. */
export function buildFloorStrokes(level: Level): Stroke[] {
  return level.floor.map(({ from, to }) => ({
    points: [
      { x: convertToPixels(from.x), y: convertToPixels(from.y) },
      { x: convertToPixels(to.x), y: convertToPixels(to.y) },
    ],
    thickness: PENCIL.thickness,
  }));
}

import type { Level } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * The level's floor as pencil strokes in world pixels: one line per segment, so a gap stays a gap.
 */
export function buildFloorStrokes(level: Level): Stroke[] {
  return level.floor.map((segment) => ({
    points: [
      { x: convertToPixels(segment.start.x), y: convertToPixels(segment.start.y) },
      { x: convertToPixels(segment.end.x), y: convertToPixels(segment.end.y) },
    ],
    thickness: PENCIL.thickness,
  }));
}

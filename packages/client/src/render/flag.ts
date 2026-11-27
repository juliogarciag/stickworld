import type { FlagView } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/** The flag's shape, as shares of the stick's height. View detail only. */
const FLAG = {
  clothHeight: 0.26,
  clothLength: 0.42,
  /** How far below the top of the stick the cloth hangs once it is all the way up. */
  gapAtTop: 0.04,
  /** How far below that it waits until the stick man reaches it. */
  loweredBy: 0.42,
} as const;

/** The flag as pencil strokes in world pixels: a stick, and a triangle of cloth that is higher up it the more `raised` the flag is. */
export function buildFlagStrokes({ at, height, raised }: FlagView): Stroke[] {
  const top = at.y - height;
  const clothTop = top + height * (FLAG.gapAtTop + FLAG.loweredBy * (1 - raised));
  const cloth = [
    { x: at.x, y: clothTop },
    { x: at.x + height * FLAG.clothLength, y: clothTop + (height * FLAG.clothHeight) / 2 },
    { x: at.x, y: clothTop + height * FLAG.clothHeight },
  ];
  return [
    { points: [at, { x: at.x, y: top }].map(convertPointToPixels), thickness: PENCIL.thickness },
    { points: cloth.map(convertPointToPixels), thickness: PENCIL.thickness, closed: true },
  ];
}

// ---- Helpers ----

const convertPointToPixels = (point: { x: number; y: number }): { x: number; y: number } => ({ x: convertToPixels(point.x), y: convertToPixels(point.y) });

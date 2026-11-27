import type { CheckpointView } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/** The checkpoint's shape, in metres: a peg up to his knee with a diamond on top, and a tick over it once it is passed. View detail only. */
const CHECKPOINT = {
  pegHeight: 0.45,
  /** From the middle of the diamond to each of its corners. */
  diamondReach: 0.14,
  /** How far over the top of the diamond the lowest point of the tick is. */
  tickAbove: 0.12,
  tickShortArm: 0.1,
  tickLongArm: 0.26,
} as const;

/** The checkpoint as pencil strokes in world pixels: a peg and a diamond, with a tick over them once he has passed it. */
export function buildCheckpointStrokes({ at, passed }: CheckpointView): Stroke[] {
  const { pegHeight, diamondReach: reach, tickAbove, tickShortArm, tickLongArm } = CHECKPOINT;
  const middle = { x: at.x, y: at.y - pegHeight - reach };
  const diamond = [
    { x: middle.x, y: middle.y - reach },
    { x: middle.x + reach, y: middle.y },
    { x: middle.x, y: middle.y + reach },
    { x: middle.x - reach, y: middle.y },
  ];
  const strokes: Stroke[] = [
    { points: [at, { x: at.x, y: at.y - pegHeight }].map(convertPointToPixels), thickness: PENCIL.thickness },
    { points: diamond.map(convertPointToPixels), thickness: PENCIL.thickness, closed: true },
  ];
  if (!passed) return strokes;
  const lowest = { x: at.x, y: middle.y - reach - tickAbove };
  const tick = [{ x: lowest.x - tickShortArm, y: lowest.y - tickShortArm }, lowest, { x: lowest.x + tickLongArm, y: lowest.y - tickLongArm }];
  return [...strokes, { points: tick.map(convertPointToPixels), thickness: PENCIL.thickness }];
}

// ---- Helpers ----

const convertPointToPixels = (point: { x: number; y: number }): { x: number; y: number } => ({ x: convertToPixels(point.x), y: convertToPixels(point.y) });

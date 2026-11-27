import { createFixedUnits } from '../render/fixedUnits';
import type { Stroke } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import type { Rectangle } from './itemSlots';

/**
 * The edge of the sheet that is being turned away, drawn over both sheets:
 * a pencil line down its right side, and beside it the shadow it throws on
 * the sheet under it, as hatching. Where the edge is comes from the page
 * turn; how it is drawn is decided here.
 */
export function buildPageEdgeStrokes(edgeAt: number, seen: Rectangle): Stroke[] {
  const x = seen.x + edgeAt * seen.width;
  const nextUnit = createFixedUnits(0x7a9e);
  const hatches: Stroke[] = [];
  for (let y = seen.y - EDGE.hatchLength; y < seen.y + seen.height; y += EDGE.betweenHatches) {
    const length = EDGE.hatchLength * (0.45 + 0.55 * nextUnit());
    const from = { x: x + EDGE.besideTheLine, y: y + nextUnit() * EDGE.betweenHatches * 0.5 };
    hatches.push({ points: [from, { x: from.x + length, y: from.y + length * EDGE.hatchSlope }], thickness: EDGE.hatchThickness });
  }
  return [{ points: [{ x, y: seen.y - EDGE.pastTheView }, { x, y: seen.y + seen.height + EDGE.pastTheView }], thickness: PENCIL.thickness }, ...hatches];
}

// ---- Helpers ----

/** Sizes in the HUD camera's world pixels. */
const EDGE = {
  /** How far above and below the view the line goes on, so neither of its ends is seen. */
  pastTheView: 40,
  besideTheLine: 9,
  betweenHatches: 23,
  hatchLength: 78,
  /** How far down a hatch goes for every pixel across. */
  hatchSlope: 0.55,
  hatchThickness: 2.4,
} as const;

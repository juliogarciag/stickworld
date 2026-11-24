import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID, type ItemSlot } from '@stickworld/sim';
import type { Stroke, StrokePoint } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';

/**
 * The item slots, drawn in pencil in the top right corner of the screen, small,
 * out of the way of what is written on the sheet and of the letter he holds
 * up: a box per slot
 * with the item it holds inside, and a second, heavier
 * box around the selected one. What a slot holds and whether it is selected
 * are the sim's (`itemSlotsOf`); only where and how it is drawn is decided here.
 *
 * A slot has no number written under it: with one slot the key that selects
 * it is never needed, and a "1" under the box read as how many he has. When
 * there are several slots, say which key is which some other way.
 */

/** A rectangle of the HUD, in the HUD camera's world pixels. */
export interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where slot number `slot` (counted from 1) is drawn when the HUD camera sees `seen`: a row from the top right corner, the first slot in the corner and each next one to its left. */
export function itemSlotBox(slot: number, seen: Rectangle): Rectangle {
  const fromTheRight = SLOT_LAYOUT.margin + SLOT_LAYOUT.side + (slot - 1) * (SLOT_LAYOUT.side + SLOT_LAYOUT.spacing);
  return { x: seen.x + seen.width - fromTheRight, y: seen.y + SLOT_LAYOUT.margin, width: SLOT_LAYOUT.side, height: SLOT_LAYOUT.side };
}

/** The strokes that draw `slots` when the HUD camera sees `seen`. For each slot, in this order: its box, the item it holds, and last the second box when it is selected. */
export function itemSlotStrokes(slots: readonly ItemSlot[], seen: Rectangle): Stroke[] {
  return slots.flatMap(({ slot, itemDefId, selected }) => {
    const box = itemSlotBox(slot, seen);
    const drawnIn = (shape: UnitPath): Stroke => ({ points: shape.map((point) => pointIn(box, point)), thickness: PENCIL.thickness });
    return [
      { points: cornersOf(box), thickness: PENCIL.thickness, closed: true },
      ...(itemDefId === null ? [] : (ITEM_DRAWINGS[itemDefId] ?? UNKNOWN_ITEM)).map(drawnIn),
      ...(selected ? [{ points: cornersOf(grownBy(box, SLOT_LAYOUT.selectedOutset)), thickness: PENCIL.thickness * SLOT_LAYOUT.selectedWeight, closed: true }] : []),
    ];
  });
}

// ---- Helpers ----

/** Sizes in the HUD camera's world pixels, which are the level's: the HUD is drawn at the level's zoom, so its pencil is the same weight. */
const SLOT_LAYOUT = {
  /** From the corner of the screen to the first slot. */
  margin: 48,
  /** A little larger than the box of a key in a prompt: it is there to be glanced at, not looked at. */
  side: 72,
  /** Between two slots. */
  spacing: 24,
  /** How far outside a slot's box the selected slot's second box is. */
  selectedOutset: 9,
  /** How much heavier than a usual line the second box is. */
  selectedWeight: 1.5,
} as const;

/** A path in shares of a slot's box: (0, 0) is its top left corner and (1, 1) its bottom right. A point may lie outside. */
type UnitPath = readonly StrokePoint[];

/** How each item looks in a slot, by its def id. */
const ITEM_DRAWINGS: Readonly<Record<number, readonly UnitPath[]>> = {
  // A sheet of paper, a little askew, with its top right corner folded over.
  [PAPER_ITEM_ID]: [
    [
      { x: 0.3, y: 0.2 },
      { x: 0.6, y: 0.17 },
      { x: 0.74, y: 0.3 },
      { x: 0.76, y: 0.8 },
      { x: 0.32, y: 0.83 },
      { x: 0.3, y: 0.2 },
    ],
    [
      { x: 0.6, y: 0.17 },
      { x: 0.61, y: 0.31 },
      { x: 0.74, y: 0.3 },
    ],
  ],
  // The paper airplane from the side: a dart, with the fold along its middle.
  [AIRPLANE_ITEM_ID]: [
    [
      { x: 0.84, y: 0.44 },
      { x: 0.16, y: 0.26 },
      { x: 0.26, y: 0.52 },
      { x: 0.38, y: 0.74 },
      { x: 0.84, y: 0.44 },
    ],
    [
      { x: 0.84, y: 0.44 },
      { x: 0.26, y: 0.52 },
    ],
  ],
};

/** An item with no drawing yet still shows the slot is not empty: a cross. */
const UNKNOWN_ITEM: readonly UnitPath[] = [
  [
    { x: 0.3, y: 0.3 },
    { x: 0.7, y: 0.7 },
  ],
  [
    { x: 0.7, y: 0.3 },
    { x: 0.3, y: 0.7 },
  ],
];

function pointIn(box: Rectangle, share: StrokePoint): StrokePoint {
  return { x: box.x + share.x * box.width, y: box.y + share.y * box.height };
}

/** The four corners of `box`, starting at the top left, the way a hand draws a square. */
function cornersOf({ x, y, width, height }: Rectangle): StrokePoint[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

function grownBy({ x, y, width, height }: Rectangle, outset: number): Rectangle {
  return { x: x - outset, y: y - outset, width: width + 2 * outset, height: height + 2 * outset };
}

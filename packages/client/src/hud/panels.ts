import type { RecipeListView } from '@stickworld/sim';
import type { Stroke, StrokePoint } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import { written } from './handwriting';
import { itemSlotBox, type Rectangle } from './itemSlots';

/**
 * What he holds up to look at, drawn over the level: the letter he is
 * reading, as a sheet with its text, and the list of recipes he knows. What
 * the letter says, which recipes are listed and whether either is out are the
 * sim's (`letterOf`, `recipeListOf`); only where and how they are drawn is
 * decided here.
 */

/** The sheet of the letter he reads, centred near the top of what the HUD camera sees, as tall as its text needs. */
export function letterSheetStrokes(text: string, seen: Rectangle): Stroke[] {
  const width = Math.min(SHEET.width, seen.width - 2 * SHEET.fromTheTop);
  const textAt = { x: seen.x + (seen.width - width) / 2 + SHEET.padding, y: seen.y + SHEET.fromTheTop + SHEET.padding };
  const words = written(text, { at: textAt, letterHeight: SHEET.letterHeight, lineWidth: width - 2 * SHEET.padding });
  const sheet = { x: textAt.x - SHEET.padding, y: textAt.y - SHEET.padding, width, height: words.height + 2 * SHEET.padding };
  return [{ points: askew(sheet, SHEET.askew), thickness: PENCIL.thickness, closed: true }, ...words.strokes];
}

/** The list of recipes, in a box beside the item slots: a line for each recipe he knows, or a line that says there is none. */
export function recipeListStrokes(list: RecipeListView, seen: Rectangle): Stroke[] {
  const lastSlot = itemSlotBox(1, seen);
  const corner = { x: lastSlot.x + lastSlot.width + LIST.besideTheSlots, y: lastSlot.y };
  const rows = list.recipes.length === 0 ? [LIST.whenEmpty] : list.recipes.map((recipe) => recipe.name);
  const lines = rows.map((row, index) => written(row, { at: { x: corner.x + LIST.padding, y: corner.y + LIST.padding + index * LIST.rowHeight }, letterHeight: LIST.letterHeight }));
  const box = { x: corner.x, y: corner.y, width: Math.max(...lines.map((line) => line.width)) + 2 * LIST.padding, height: (rows.length - 1) * LIST.rowHeight + LIST.letterHeight + 2 * LIST.padding };
  return [{ points: askew(box, LIST.askew), thickness: PENCIL.thickness, closed: true }, ...lines.flatMap((line) => line.strokes)];
}

// ---- Helpers ----

/** Sizes in the HUD camera's world pixels, which are the level's. */
const SHEET = {
  width: 900,
  fromTheTop: 64,
  padding: 44,
  letterHeight: 30,
  /** How far each corner of the sheet is off a true rectangle: it was cut by hand. */
  askew: 7,
} as const;

const LIST = {
  besideTheSlots: 52,
  padding: 30,
  letterHeight: 28,
  /** From the top of one recipe's line to the top of the next. */
  rowHeight: 52,
  askew: 4,
  /** What the list says while he knows no recipe. The HUD's own words: no def has them. */
  whenEmpty: 'nothing yet',
} as const;

/** The four corners of `box`, each a little off: clockwise from the top left. */
function askew({ x, y, width, height }: Rectangle, by: number): StrokePoint[] {
  return [
    { x: x - by * 0.4, y: y + by },
    { x: x + width + by * 0.6, y: y - by * 0.5 },
    { x: x + width - by * 0.3, y: y + height + by * 0.8 },
    { x: x + by * 0.7, y: y + height - by * 0.3 },
  ];
}

import type { Stroke, StrokePoint } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import { buildWriting } from './handwriting';
import type { Rectangle } from './itemSlots';

/**
 * What he holds up to look at, drawn over the level: the letter he is
 * reading, as a sheet with its text and, under it, what it has taught him.
 * What the letter says, what it teaches and whether it is out are the sim's
 * (`getLetter`); only where and how they are drawn is decided here.
 */

/** A letter as it is held up: what it says, and the name of what reading it has taught him, or null when it teaches nothing. */
export interface LetterHeldUp {
  readonly text: string;
  readonly teaches: string | null;
}

/**
 * The sheet of the letter he reads, centred near the top of what the HUD camera sees, as tall as what is on it
 * needs: its text and, a little apart under it, a line that says what he has learned.
 */
export function buildLetterSheetStrokes({ text, teaches }: LetterHeldUp, seen: Rectangle): Stroke[] {
  const width = Math.min(SHEET.width, seen.width - 2 * SHEET.fromTheTop);
  const textAt = { x: seen.x + (seen.width - width) / 2 + SHEET.padding, y: seen.y + SHEET.fromTheTop + SHEET.padding };
  const lineWidth = width - 2 * SHEET.padding;
  const words = buildWriting(text, { at: textAt, letterHeight: SHEET.letterHeight, lineWidth });
  const learned = teaches === null ? null : buildWriting(`${SHEET.learned} ${teaches}`, { at: { x: textAt.x, y: textAt.y + words.height + SHEET.aboveWhatHeLearned }, letterHeight: SHEET.letterHeight, lineWidth });
  const heightOfWhatIsWritten = learned === null ? words.height : words.height + SHEET.aboveWhatHeLearned + learned.height;
  const sheet = { x: textAt.x - SHEET.padding, y: textAt.y - SHEET.padding, width, height: heightOfWhatIsWritten + 2 * SHEET.padding };
  return [{ points: skew(sheet, SHEET.askew), thickness: PENCIL.thickness, closed: true }, ...words.strokes, ...(learned?.strokes ?? [])];
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
  /** From the bottom of the letter's text to the top of the line that says what he learned. */
  aboveWhatHeLearned: 40,
  /** What goes before the name of what he learned. The HUD's own words: no def has them. */
  learned: 'learned:',
} as const;

/** The four corners of `box`, each a little off: clockwise from the top left. */
function skew({ x, y, width, height }: Rectangle, by: number): StrokePoint[] {
  return [
    { x: x - by * 0.4, y: y + by },
    { x: x + width + by * 0.6, y: y - by * 0.5 },
    { x: x + width - by * 0.3, y: y + height + by * 0.8 },
    { x: x + by * 0.7, y: y + height - by * 0.3 },
  ];
}

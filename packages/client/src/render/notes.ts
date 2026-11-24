import type { NoteView } from '@stickworld/sim';
import { written } from '../hud/handwriting';
import { keysAndWords } from '../hud/keysAndWords';
import type { Stroke } from './strokes';
import { rubbedOutSoFar } from './strokes/partly';
import { toPixels } from './units';

/**
 * The notes on a level's sheet as pencil strokes: words written where the
 * level's data puts them, with the keys for what a note is about drawn in
 * boxes before it. What a note says, what it is about and whether it has
 * been rubbed out are the sim's (`notesOf`); which keys those are is the
 * input's, handed in as `keysFor`; how it is written is decided here.
 */

/** The names of the keys for each thing a note can be about, as the player knows them. */
export type KeysForNotes = Readonly<Record<NonNullable<NoteView['about']>, readonly string[]>>;

/** The strokes of every note, in world pixels. A note that has been rubbed out goes stroke by stroke, in the order it was written. */
export function noteStrokes(notes: readonly NoteView[], keysFor: KeysForNotes): Stroke[] {
  return notes.flatMap((note) => {
    const strokes = note.title ? titleStrokes(note) : keyedStrokes(note, note.about ? keysFor[note.about] : []);
    return note.rubbedOutFor === null ? strokes : rubbedOutSoFar(strokes, note.rubbedOutFor / NOTES.rubbedOutIn);
  });
}

/** True while `notes` are drawn the same from frame to frame: none of them is being rubbed out right now. */
export function notesAreStill(notes: readonly NoteView[]): boolean {
  return notes.every((note) => note.rubbedOutFor === null || note.rubbedOutFor >= NOTES.rubbedOutIn);
}

// ---- Helpers ----

/** Sizes in world pixels, and seconds. View detail only. */
const NOTES = {
  /** How tall the capitals of a title are. */
  titleLetterHeight: toPixels(0.72),
  /** A note about something he does: the boxes of its keys and its words. */
  keyed: { keySide: toPixels(0.52), insideTheKey: toPixels(0.12), letterHeight: toPixels(0.27), besideTheKey: toPixels(0.2) },
  /** How long rubbing a note out takes. */
  rubbedOutIn: 0.45,
} as const;

/** A title: its words alone, large, centred on where the note is, standing on its line. */
function titleStrokes({ words, at }: NoteView): Stroke[] {
  const letterHeight = NOTES.titleLetterHeight;
  const { width } = written(words, { at: { x: 0, y: 0 }, letterHeight });
  return written(words, { at: { x: toPixels(at.x) - width / 2, y: toPixels(at.y) - letterHeight }, letterHeight }).strokes;
}

/** A note with the keys it is about: boxes and words, centred on where the note is, the boxes standing on its line. */
function keyedStrokes({ words, at }: NoteView, keys: readonly string[]): Stroke[] {
  const sizes = NOTES.keyed;
  const { width } = keysAndWords({ keys, words, at: { x: 0, y: 0 }, sizes });
  return keysAndWords({ keys, words, at: { x: toPixels(at.x) - width / 2, y: toPixels(at.y) - sizes.keySide }, sizes }).strokes;
}

export const __testing__ = { NOTES };

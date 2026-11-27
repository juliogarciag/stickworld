import type { NoteView } from '@stickworld/sim';
import { buildWriting } from '../hud/handwriting';
import { buildKeysAndWords } from '../hud/keysAndWords';
import type { Stroke } from './strokes';
import { getRubbedOutSoFar } from './strokes/partly';
import { convertToPixels } from './units';

/**
 * The notes on a level's sheet as pencil strokes: words written where the
 * level's data puts them, with the keys for what a note is about drawn in
 * boxes before it. What a note says, what it is about and whether it has
 * been rubbed out are the sim's (`getNotes`); which keys those are is the
 * input's, handed in as `keysFor`; how it is written is decided here.
 */

/** The names of the keys for each thing a note can be about, as the player knows them. */
export type KeysForNotes = Readonly<Record<NonNullable<NoteView['topic']>, readonly string[]>>;

/**
 * The strokes of every note, in world pixels. A note that has been rubbed out goes stroke by
 * stroke, in the order it was written.
 */
export function buildNoteStrokes(notes: readonly NoteView[], keysFor: KeysForNotes): Stroke[] {
  return notes.flatMap((note) => {
    const strokes = note.isTitle
      ? buildTitleStrokes(note)
      : buildKeyedStrokes(note, note.topic ? keysFor[note.topic] : []);
    return note.rubbedOutFor === null
      ? strokes
      : getRubbedOutSoFar(strokes, note.rubbedOutFor / NOTES.rubbedOutIn);
  });
}

/**
 * True while `notes` are drawn the same from frame to frame: none of them is being rubbed out right
 * now.
 */
export function areNotesStill(notes: readonly NoteView[]): boolean {
  return notes.every(
    (note) => note.rubbedOutFor === null || note.rubbedOutFor >= NOTES.rubbedOutIn,
  );
}

// ---- Helpers ----

/** Sizes in world pixels, and seconds. View detail only. */
const NOTES = {
  /** How tall the capitals of a title are. */
  titleLetterHeight: convertToPixels(0.72),
  /** A note about something the stick man does: the boxes of its keys and its words. */
  keyed: {
    keySide: convertToPixels(0.52),
    keyPadding: convertToPixels(0.12),
    letterHeight: convertToPixels(0.27),
    keyGap: convertToPixels(0.2),
  },
  /** How long rubbing a note out takes. */
  rubbedOutIn: 0.45,
} as const;

/** A title: its words alone, large, centred on where the note is, standing on its line. */
function buildTitleStrokes(note: NoteView): Stroke[] {
  const letterHeight = NOTES.titleLetterHeight;
  const { width } = buildWriting(note.words, { position: { x: 0, y: 0 }, letterHeight });
  return buildWriting(note.words, {
    position: {
      x: convertToPixels(note.position.x) - width / 2,
      y: convertToPixels(note.position.y) - letterHeight,
    },
    letterHeight,
  }).strokes;
}

/**
 * A note with the keys it is about: boxes and words, centred on where the note is, the boxes
 * standing on its line.
 */
function buildKeyedStrokes(note: NoteView, keys: readonly string[]): Stroke[] {
  const sizes = NOTES.keyed;
  const { width } = buildKeysAndWords({ keys, words: note.words, position: { x: 0, y: 0 }, sizes });
  return buildKeysAndWords({
    keys,
    words: note.words,
    position: {
      x: convertToPixels(note.position.x) - width / 2,
      y: convertToPixels(note.position.y) - sizes.keySide,
    },
    sizes,
  }).strokes;
}

export const __testing__ = { NOTES };

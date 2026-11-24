import type { Stroke, StrokePoint } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import { written } from './handwriting';

/**
 * How the game shows a key to the player, wherever it does: the key's name
 * in a box, and beside it a word or two for what the key does. The HUD's
 * prompts, the notes on a level's sheet and the end's "play again" are all
 * drawn by this.
 */

/** How big the boxes and the words are, in the pixels of whoever draws them. */
export interface KeySizes {
  /** The side of a key's box. A key with a long name gets a wider one. */
  readonly keySide: number;
  /** The least room between a key's name and the sides of its box. */
  readonly insideTheKey: number;
  /** How tall the capitals are, of the key's name and of the words. */
  readonly letterHeight: number;
  /** From one key's box to the next, and from the last box to the words. */
  readonly besideTheKey: number;
}

export interface KeysAndWords {
  /** The names of the keys as the player knows them, each drawn in a box of its own. */
  readonly keys: readonly string[];
  readonly words: string;
  /** The top left corner of the first key's box. */
  readonly at: StrokePoint;
  readonly sizes: KeySizes;
}

/** The strokes of the boxed keys and their words, with how wide all of it came out. For each key its box, then its name; the words last. */
export function keysAndWords({ keys, words, at, sizes }: KeysAndWords): { strokes: Stroke[]; width: number } {
  const strokes: Stroke[] = [];
  const letterTop = at.y + (sizes.keySide - sizes.letterHeight) / 2;
  let x = at.x;
  for (const key of keys) {
    const name = written(key, { at: { x: 0, y: 0 }, letterHeight: sizes.letterHeight });
    const box = { x, y: at.y, width: Math.max(sizes.keySide, name.width + 2 * sizes.insideTheKey), height: sizes.keySide };
    strokes.push(
      { points: [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }], thickness: Math.min(PENCIL.thickness, sizes.keySide * BOX_THICKNESS), closed: true },
      ...written(key, { at: { x: box.x + (box.width - name.width) / 2, y: letterTop }, letterHeight: sizes.letterHeight }).strokes,
    );
    x += box.width + sizes.besideTheKey;
  }
  const said = written(words, { at: { x, y: letterTop }, letterHeight: sizes.letterHeight });
  strokes.push(...said.strokes);
  return { strokes, width: x + said.width - at.x };
}

// ---- Helpers ----

/** How thick a box's line is, as a share of its side; never thicker than the pencil. */
const BOX_THICKNESS = 0.09;

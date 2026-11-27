import type { Stroke, StrokePoint } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import { buildWriting } from './handwriting';

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
  readonly keyPadding: number;
  /** How tall the capitals are, of the key's name and of the words. */
  readonly letterHeight: number;
  /** From one key's box to the next, and from the last box to the words. */
  readonly keyGap: number;
}

export interface KeysAndWords {
  /** The names of the keys as the player knows them, each drawn in a box of its own. */
  readonly keys: readonly string[];
  readonly words: string;
  /** The top left corner of the first key's box. */
  readonly position: StrokePoint;
  readonly sizes: KeySizes;
}

/**
 * The strokes of the boxed keys and their words, with how wide all of it came out. For each key its
 * box, then its name; the words last.
 */
export function buildKeysAndWords(keysAndWords: KeysAndWords): {
  strokes: Stroke[];
  width: number;
} {
  const strokes: Stroke[] = [];
  const letterTop =
    keysAndWords.position.y + (keysAndWords.sizes.keySide - keysAndWords.sizes.letterHeight) / 2;
  let x = keysAndWords.position.x;
  for (const key of keysAndWords.keys) {
    const name = buildWriting(key, {
      position: { x: 0, y: 0 },
      letterHeight: keysAndWords.sizes.letterHeight,
    });
    const box = {
      x,
      y: keysAndWords.position.y,
      width: Math.max(keysAndWords.sizes.keySide, name.width + 2 * keysAndWords.sizes.keyPadding),
      height: keysAndWords.sizes.keySide,
    };
    strokes.push(
      {
        points: [
          { x: box.x, y: box.y },
          { x: box.x + box.width, y: box.y },
          { x: box.x + box.width, y: box.y + box.height },
          { x: box.x, y: box.y + box.height },
        ],
        thickness: Math.min(PENCIL.thickness, keysAndWords.sizes.keySide * BOX_THICKNESS),
        isClosed: true,
      },
      ...buildWriting(key, {
        position: { x: box.x + (box.width - name.width) / 2, y: letterTop },
        letterHeight: keysAndWords.sizes.letterHeight,
      }).strokes,
    );
    x += box.width + keysAndWords.sizes.keyGap;
  }
  const said = buildWriting(keysAndWords.words, {
    position: { x, y: letterTop },
    letterHeight: keysAndWords.sizes.letterHeight,
  });
  strokes.push(...said.strokes);
  return { strokes, width: x + said.width - keysAndWords.position.x };
}

// ---- Helpers ----

/** How thick a box's line is, as a share of its side; never thicker than the pencil. */
const BOX_THICKNESS = 0.09;

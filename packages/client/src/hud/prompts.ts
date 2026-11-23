import type { InteractionMeaning, ItemUseMeaning } from '@stickworld/sim';
import type { Stroke } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import { written } from './handwriting';
import type { Rectangle } from './itemSlots';

/**
 * What the two action keys would do right now, written in a corner of the
 * screen: the key in a box and a word or two beside it. A key that would do
 * nothing is not shown. What each key would do is the sim's (`itemUseOf`,
 * `interactionOf`); the words for it and where they are drawn are decided here.
 */

/** One key and what it is for right now. */
export interface Prompt {
  /** The key's name as the player knows it. */
  readonly key: string;
  readonly words: string;
}

export interface KeysWouldDo {
  /** What using the held item would do, and the name of the key that does it. */
  readonly itemUse: ItemUseMeaning | null;
  readonly useItemKey: string;
  /** What interacting with the world would do, and the name of the key that does it. */
  readonly interaction: InteractionMeaning | null;
  readonly interactKey: string;
}

/** The prompts to show: the item key first, then the interact key, each only when it would do something. */
export function promptsFor({ itemUse, useItemKey, interaction, interactKey }: KeysWouldDo): Prompt[] {
  return [...(itemUse === null ? [] : [{ key: useItemKey, words: ITEM_USE_WORDS[itemUse] }]), ...(interaction === null ? [] : [{ key: interactKey, words: INTERACTION_WORDS[interaction] }])];
}

/** The strokes that draw `prompts` in the bottom left corner of what the HUD camera sees, one above the other. */
export function promptStrokes(prompts: readonly Prompt[], seen: Rectangle): Stroke[] {
  return prompts.flatMap(({ key, words }, index) => {
    const fromTheBottom = prompts.length - 1 - index;
    const box = { x: seen.x + PROMPTS.margin, y: seen.y + seen.height - PROMPTS.margin - PROMPTS.keySide - fromTheBottom * PROMPTS.rowHeight, side: PROMPTS.keySide };
    const keyName = written(key, { at: { x: 0, y: 0 }, letterHeight: PROMPTS.letterHeight });
    const inset = { x: box.x + (box.side - keyName.width) / 2, y: box.y + (box.side - PROMPTS.letterHeight) / 2 };
    return [
      { points: [{ x: box.x, y: box.y }, { x: box.x + box.side, y: box.y }, { x: box.x + box.side, y: box.y + box.side }, { x: box.x, y: box.y + box.side }], thickness: PENCIL.thickness, closed: true },
      ...written(key, { at: inset, letterHeight: PROMPTS.letterHeight }).strokes,
      ...written(words, { at: { x: box.x + box.side + PROMPTS.besideTheKey, y: inset.y }, letterHeight: PROMPTS.letterHeight }).strokes,
    ];
  });
}

// ---- Helpers ----

/** The HUD's own words for what a key would do. */
const ITEM_USE_WORDS: Readonly<Record<ItemUseMeaning, string>> = {
  putLetterAway: 'put it away',
  openRecipes: 'what can it make?',
  craft: 'fold it',
  closeRecipes: 'put it back',
  place: 'set it down',
};

const INTERACTION_WORDS: Readonly<Record<InteractionMeaning, string>> = {
  read: 'read',
  putLetterAway: 'put it away',
  closeRecipes: 'put it back',
  lift: 'lift',
  putDown: 'put down',
  board: 'board',
};

/** Sizes in the HUD camera's world pixels, which are the level's. */
const PROMPTS = {
  /** From the corner of the screen, as far as the item slots are from theirs. */
  margin: 56,
  keySide: 58,
  letterHeight: 28,
  besideTheKey: 24,
  /** From the top of one prompt to the top of the next. */
  rowHeight: 80,
} as const;

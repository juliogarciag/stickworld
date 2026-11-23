import type { InteractionMeaning, ItemUseMeaning } from '@stickworld/sim';
import type { Stroke } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';
import { written } from './handwriting';
import type { Rectangle } from './itemSlots';

/**
 * What the keys would do right now, written in a corner of the screen: the
 * key in a box and a word or two beside it. A key that would do nothing is
 * not shown. What each action key would do is the sim's (`itemUseOf`,
 * `interactionOf`), and so is whether he is seated in the airplane, where the
 * keys that fly it are shown; the words and where they are drawn are decided here.
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
  /** The name of what using the held item would make, or null when it would make nothing. */
  readonly wouldMake: string | null;
  readonly useItemKey: string;
  /** What interacting with the world would do, and the name of the key that does it. */
  readonly interaction: InteractionMeaning | null;
  readonly interactKey: string;
  /** True while he is seated in the airplane, and the names of the keys that fly it. */
  readonly seated: boolean;
  readonly flightKeys: { readonly climb: string; readonly dive: string; readonly jumpOut: string };
}

/** The prompts to show: the item key first, then the interact key, each only when it would do something, then the keys that fly the airplane while he is seated in it. */
export function promptsFor({ itemUse, wouldMake, useItemKey, interaction, interactKey, seated, flightKeys }: KeysWouldDo): Prompt[] {
  return [
    ...(itemUse === null ? [] : [{ key: useItemKey, words: ITEM_USE_WORDS[itemUse](wouldMake) }]),
    ...(interaction === null ? [] : [{ key: interactKey, words: INTERACTION_WORDS[interaction] }]),
    ...(seated ? [{ key: flightKeys.climb, words: FLIGHT_WORDS.climb }, { key: flightKeys.dive, words: FLIGHT_WORDS.dive }, { key: flightKeys.jumpOut, words: FLIGHT_WORDS.jumpOut }] : []),
  ];
}

/** The strokes that draw `prompts` in the bottom left corner of what the HUD camera sees, one above the other. */
export function promptStrokes(prompts: readonly Prompt[], seen: Rectangle): Stroke[] {
  return prompts.flatMap(({ key, words }, index) => {
    const fromTheBottom = prompts.length - 1 - index;
    const keyName = written(key, { at: { x: 0, y: 0 }, letterHeight: PROMPTS.letterHeight });
    // A key with a long name (the space bar) gets a box as wide as its name needs.
    const box = { x: seen.x + PROMPTS.margin, y: seen.y + seen.height - PROMPTS.margin - PROMPTS.keySide - fromTheBottom * PROMPTS.rowHeight, width: Math.max(PROMPTS.keySide, keyName.width + 2 * PROMPTS.insideTheKey), height: PROMPTS.keySide };
    const inset = { x: box.x + (box.width - keyName.width) / 2, y: box.y + (box.height - PROMPTS.letterHeight) / 2 };
    return [
      { points: [{ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, { x: box.x, y: box.y + box.height }], thickness: PENCIL.thickness, closed: true },
      ...written(key, { at: inset, letterHeight: PROMPTS.letterHeight }).strokes,
      ...written(words, { at: { x: box.x + box.width + PROMPTS.besideTheKey, y: inset.y }, letterHeight: PROMPTS.letterHeight }).strokes,
    ];
  });
}

// ---- Helpers ----

/**
 * The HUD's own words for what a key would do. Each names the thing it is done to: "it" would be the letter in one
 * prompt and the airplane in the next. Everything he makes so far is folded paper, so making is called folding.
 */
const ITEM_USE_WORDS: Readonly<Record<ItemUseMeaning, (wouldMake: string | null) => string>> = {
  craft: (wouldMake) => (wouldMake === null ? 'fold it' : `fold a ${wouldMake}`),
  place: () => 'set the airplane down',
};

const INTERACTION_WORDS: Readonly<Record<InteractionMeaning, string>> = {
  read: 'read the letter',
  putLetterAway: 'put the letter away',
  lift: 'lift the airplane',
  putDown: 'put the airplane down',
  board: 'board the airplane',
};

const FLIGHT_WORDS = { climb: 'climb', dive: 'dive', jumpOut: 'jump out' } as const;

/** Sizes in the HUD camera's world pixels, which are the level's. */
const PROMPTS = {
  /** From the corner of the screen, as far as the item slots are from theirs. */
  margin: 56,
  keySide: 58,
  /** The least room between a key's name and the sides of its box. */
  insideTheKey: 14,
  letterHeight: 28,
  besideTheKey: 24,
  /** From the top of one prompt to the top of the next. */
  rowHeight: 80,
} as const;

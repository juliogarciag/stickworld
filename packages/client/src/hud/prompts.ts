import type { FlyingHint, InteractionMeaning, ItemUseMeaning } from '@stickworld/sim';
import type { ColouredPencil, Stroke } from '../render/strokes';
import type { Rectangle } from './itemSlots';
import { buildKeysAndWords } from './keysAndWords';

/**
 * What the keys would do right now, written in a corner of the screen: the
 * key in a box and a word or two beside it. A key that would do nothing is
 * not shown. Above them, in words alone, what he has still to be told: that
 * the airplane goes to the edge, and in green once it is there that it is
 * ready (`getFlyingHint`). What each action key would do is the sim's (`getItemUse`,
 * `getInteraction`), and so is whether he is seated in the airplane, where the
 * keys that fly it are shown; the words and where they are drawn are decided here.
 */

/** One key and what it is for right now, or words alone: something to do that no one key does. */
export interface Prompt {
  /** The key's name as the player knows it, or null for words with no key. */
  readonly key: string | null;
  readonly words: string;
  /** The coloured pencil the prompt is written in, or absent for graphite: green for the airplane that is ready. */
  readonly colour?: ColouredPencil;
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
  /** What he has still to be told about flying the airplane he has, or null (`getFlyingHint`). */
  readonly flyingHint: FlyingHint | null;
}

/**
 * The prompts to show: first what he has still to be told, in words alone; then the item key and the interact key,
 * each only when it would do something; then the keys that fly the airplane while he is seated in it.
 */
export function getPromptsFor({ itemUse, wouldMake, useItemKey, interaction, interactKey, seated, flightKeys, flyingHint }: KeysWouldDo): Prompt[] {
  return [
    ...(flyingHint === null ? [] : [FLYING_HINTS[flyingHint]]),
    ...(itemUse === null ? [] : [{ key: useItemKey, words: ITEM_USE_WORDS[itemUse](wouldMake) }]),
    ...(interaction === null ? [] : [{ key: interactKey, words: INTERACTION_WORDS[interaction] }]),
    ...(seated ? [{ key: flightKeys.climb, words: FLIGHT_WORDS.climb }, { key: flightKeys.dive, words: FLIGHT_WORDS.dive }, { key: flightKeys.jumpOut, words: FLIGHT_WORDS.jumpOut }] : []),
  ];
}

/** The strokes that draw `prompts` in the bottom left corner of what the HUD camera sees, one above the other. */
export function buildPromptStrokes(prompts: readonly Prompt[], seen: Rectangle): Stroke[] {
  return prompts.flatMap(({ key, words, colour }, index) => {
    const fromTheBottom = prompts.length - 1 - index;
    const at = { x: seen.x + PROMPTS.margin, y: seen.y + seen.height - PROMPTS.margin - PROMPTS.keySide - fromTheBottom * PROMPTS.rowHeight };
    const { strokes } = buildKeysAndWords({ keys: key === null ? [] : [key], words, at, sizes: PROMPTS });
    return colour === undefined ? strokes : strokes.map((stroke) => ({ ...stroke, colour }));
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
  pickUp: 'pick up the paper',
};

/**
 * What he is told about the airplane before he has flown it, in words with no key: where to take it, then, in green,
 * that he got it there. The keys under it say which one boards it.
 */
const FLYING_HINTS: Readonly<Record<FlyingHint, Prompt>> = {
  takeItToAnEdge: { key: null, words: 'take the airplane to the edge' },
  readyToBoard: { key: null, words: 'the airplane is ready', colour: 'green' },
};

const FLIGHT_WORDS = { climb: 'climb', dive: 'dive', jumpOut: 'jump out' } as const;

/** Sizes in the HUD camera's world pixels, which are the level's. */
const PROMPTS = {
  /** From the corner of the screen, as far as the item slots are from theirs. */
  margin: 56,
  keySide: 58,
  insideTheKey: 14,
  letterHeight: 28,
  besideTheKey: 24,
  /** From the top of one prompt to the top of the next. */
  rowHeight: 80,
} as const;

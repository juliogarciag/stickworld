import {
  PAPER_AIRPLANE_RECIPE_ID,
  SPEAR_RECIPE_ID,
  type FlyingHint,
  type InteractionMeaning,
  type ItemUseMeaning,
  type RecipeView,
} from '@stickworld/sim';
import type { ColouredPencil, Stroke } from '../render/strokes';
import type { Rectangle } from './itemSlots';
import { buildKeysAndWords } from './keysAndWords';

/**
 * What the keys would do right now, written in a corner of the screen: the
 * key in a box and a word or two beside it. A key that would do nothing is
 * not shown. Above them, in words alone, what the stick man has still to be told: that
 * the airplane goes to the edge, and in green once it is there that it is
 * ready (`getFlyingHint`). What each action key would do is the sim's (`getItemUse`,
 * `getInteraction`), and so is whether the stick man is seated in the airplane, where the
 * keys that fly it are shown; the words and where they are drawn are decided here.
 */

/** One key and what it is for right now, or words alone: something to do that no one key does. */
export interface Prompt {
  /** The key's name as the player knows it, or null for words with no key. */
  readonly key: string | null;
  readonly words: string;
  /**
   * The coloured pencil the prompt is written in, or absent for graphite: green for the airplane
   * that is ready.
   */
  readonly colour?: ColouredPencil;
}

export interface PromptInput {
  /** What using the held item would do, and the name of the key that does it. */
  readonly itemUse: ItemUseMeaning | null;
  /** The recipe using the held item would make, or null when it would make nothing. */
  readonly wouldMake: RecipeView | null;
  readonly useItemKey: string;
  /** What interacting with the world would do, and the name of the key that does it. */
  readonly interaction: InteractionMeaning | null;
  readonly interactKey: string;
  /** True while the stick man is seated in the airplane, and the names of the keys that fly it. */
  readonly isSeated: boolean;
  readonly flightKeys: { readonly climb: string; readonly dive: string; readonly jumpOut: string };
  /**
   * What the stick man has still to be told about flying the airplane it has, or null
   * (`getFlyingHint`).
   */
  readonly flyingHint: FlyingHint | null;
}

/**
 * The prompts to show: first what the stick man has still to be told, in words alone; then the item
 * key and the interact key, each only when it would do something; then the keys that fly the
 * airplane while the stick man is seated in it.
 */
export function getPromptsFor(input: PromptInput): Prompt[] {
  return [
    ...(input.flyingHint === null ? [] : [FLYING_HINTS[input.flyingHint]]),
    ...(input.itemUse === null
      ? []
      : [{ key: input.useItemKey, words: ITEM_USE_WORDS[input.itemUse](input.wouldMake) }]),
    ...(input.interaction === null
      ? []
      : [{ key: input.interactKey, words: INTERACTION_WORDS[input.interaction] }]),
    ...(input.isSeated
      ? [
          { key: input.flightKeys.climb, words: FLIGHT_WORDS.climb },
          { key: input.flightKeys.dive, words: FLIGHT_WORDS.dive },
          { key: input.flightKeys.jumpOut, words: FLIGHT_WORDS.jumpOut },
        ]
      : []),
  ];
}

/**
 * The strokes that draw `prompts` in the bottom left corner of what the HUD camera sees, one above
 * the other.
 */
export function buildPromptStrokes(prompts: readonly Prompt[], seen: Rectangle): Stroke[] {
  return prompts.flatMap((prompt, index) => {
    const indexFromBottom = prompts.length - 1 - index;
    const position = {
      x: seen.x + PROMPTS.margin,
      y:
        seen.y +
        seen.height -
        PROMPTS.margin -
        PROMPTS.keySide -
        indexFromBottom * PROMPTS.rowHeight,
    };
    const { strokes } = buildKeysAndWords({
      keys: prompt.key === null ? [] : [prompt.key],
      words: prompt.words,
      position,
      sizes: PROMPTS,
    });
    return prompt.colour === undefined
      ? strokes
      : strokes.map((stroke) => ({ ...stroke, colour: prompt.colour }));
  });
}

// ---- Helpers ----

/**
 * The HUD's own words for making each recipe, by its def id: what is done to the item it is made
 * from is not the same for each. A recipe with no words here is made, and named as the sim names
 * it.
 */
const CRAFT_WORDS: Readonly<Record<number, string>> = {
  [PAPER_AIRPLANE_RECIPE_ID]: 'fold a paper airplane',
  [SPEAR_RECIPE_ID]: 'sharpen the pencil',
};

function getCraftWords(wouldMake: RecipeView | null): string {
  if (wouldMake === null) {
    return 'make it';
  }
  return CRAFT_WORDS[wouldMake.defId] ?? `make a ${wouldMake.name}`;
}

/**
 * The HUD's own words for what a key would do. Each names the thing it is done to: "it" would be
 * the letter in one prompt and the airplane in the next.
 */
const ITEM_USE_WORDS: Readonly<Record<ItemUseMeaning, (wouldMake: RecipeView | null) => string>> = {
  craft: getCraftWords,
  place: () => 'set the airplane down',
  thrust: () => 'thrust the spear',
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
 * What the stick man is told about the airplane before the stick man has flown it, in words with no
 * key: where to take it, then, in green, that the stick man got it there. The keys under it say
 * which one boards it.
 */
const FLYING_HINTS: Readonly<Record<FlyingHint, Prompt>> = {
  takeToEdge: { key: null, words: 'take the airplane to the edge' },
  readyToBoard: { key: null, words: 'the airplane is ready', colour: 'green' },
};

const FLIGHT_WORDS = { climb: 'climb', dive: 'dive', jumpOut: 'jump out' } as const;

/** Sizes in the HUD camera's world pixels, which are the level's. */
const PROMPTS = {
  /** From the corner of the screen, as far as the item slots are from theirs. */
  margin: 56,
  keySide: 58,
  keyPadding: 14,
  letterHeight: 28,
  keyGap: 24,
  /** From the top of one prompt to the top of the next. */
  rowHeight: 80,
} as const;

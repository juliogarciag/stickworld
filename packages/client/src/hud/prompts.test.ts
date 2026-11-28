import { PAPER_AIRPLANE_RECIPE_ID, SPEAR_RECIPE_ID, type RecipeView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildWriting } from './handwriting';
import { getPromptsFor, buildPromptStrokes } from './prompts';
import { keepUntilChanged } from './unchanged';

describe('getPromptsFor', () => {
  it('shows nothing when neither key would do anything', () => {
    expect(getPromptsFor({ ...KEYS, itemUse: null, interaction: null })).toEqual([]);
  });

  it('names each key with what it would do, the item key first', () => {
    expect(getPromptsFor({ ...KEYS, itemUse: 'place', interaction: 'lift' })).toEqual([
      { key: 'J', words: 'set the airplane down' },
      { key: 'K', words: 'lift the airplane' },
    ]);
    expect(getPromptsFor({ ...KEYS, itemUse: null, interaction: 'board' })).toEqual([
      { key: 'K', words: 'board the airplane' },
    ]);
  });

  it('names the keys that fly the airplane while the stick man is seated in it, and only then', () => {
    expect(getPromptsFor({ ...KEYS, itemUse: null, interaction: null, isSeated: true })).toEqual([
      { key: '↑', words: 'climb' },
      { key: '↓', words: 'dive' },
      { key: 'SPACE', words: 'jump out' },
    ]);
  });

  it('says first, in words with no key, that the airplane goes to the edge while the stick man has still to be told', () => {
    expect(
      getPromptsFor({ ...KEYS, itemUse: null, interaction: 'putDown', flyingHint: 'takeToEdge' }),
    ).toEqual([
      { key: null, words: 'take the airplane to the edge' },
      { key: 'K', words: 'put the airplane down' },
    ]);
    expect(
      getPromptsFor({ ...KEYS, itemUse: null, interaction: null, flyingHint: 'takeToEdge' }),
    ).toEqual([{ key: null, words: 'take the airplane to the edge' }]);
  });

  it('says in green, in words with no key, that the airplane is ready once it sits on the edge, above the key that boards it', () => {
    expect(
      getPromptsFor({ ...KEYS, itemUse: null, interaction: 'board', flyingHint: 'readyToBoard' }),
    ).toEqual([
      { key: null, words: 'the airplane is ready', colour: 'green' },
      { key: 'K', words: 'board the airplane' },
    ]);
  });

  it('says what would be made, by the name the sim gives it', () => {
    expect(
      getPromptsFor({ ...KEYS, itemUse: 'craft', wouldMake: AIRPLANE_RECIPE, interaction: null }),
    ).toEqual([{ key: 'J', words: 'fold a paper airplane' }]);
  });

  it('says what is done to the paper to make each thing of it, and makes by name what it has no words for', () => {
    const getCraftWords = (recipe: RecipeView | null): string =>
      getPromptsFor({ ...KEYS, itemUse: 'craft', wouldMake: recipe, interaction: null })[0]!.words;
    expect(getCraftWords(AIRPLANE_RECIPE)).toBe('fold a paper airplane');
    expect(getCraftWords(SPEAR_RECIPE)).toBe('roll a spear');
    expect(getCraftWords({ defId: 499, name: 'paper boat' })).toBe('make a paper boat');
  });

  it('shows the key that switches under the item key, with what would be made instead, only while there is something to switch to', () => {
    const making = {
      ...KEYS,
      itemUse: 'craft',
      wouldMake: SPEAR_RECIPE,
      interaction: null,
    } as const;
    expect(
      getPromptsFor({ ...making, canSwitchItemUse: true, couldMakeInstead: AIRPLANE_RECIPE }),
    ).toEqual([
      { key: 'J', words: 'roll a spear' },
      { key: 'L', words: 'fold a paper airplane instead' },
    ]);
    expect(getPromptsFor(making)).toEqual([{ key: 'J', words: 'roll a spear' }]);
  });

  it('says the spear is thrust, and shows no key for it while it cannot be', () => {
    expect(getPromptsFor({ ...KEYS, itemUse: 'thrust', interaction: null })).toEqual([
      { key: 'J', words: 'thrust the spear' },
    ]);
    expect(getPromptsFor({ ...KEYS, itemUse: null, interaction: null })).toEqual([]);
  });

  it('has words for everything a key can mean, and each names what it is done to', () => {
    const words = [
      ...(['craft', 'place', 'thrust'] as const).map(
        (itemUse) =>
          getPromptsFor({ ...KEYS, itemUse, wouldMake: AIRPLANE_RECIPE, interaction: null })[0]
            ?.words,
      ),
      ...(['read', 'putLetterAway', 'lift', 'putDown', 'board', 'pickUp'] as const).map(
        (interaction) => getPromptsFor({ ...KEYS, itemUse: null, interaction })[0]?.words,
      ),
    ];
    for (const prompt of words) {
      expect(prompt).toMatch(/letter|airplane|paper|spear/);
    }
  });
});

describe('buildPromptStrokes', () => {
  it('draws each prompt as a boxed key and its words, in the bottom left corner, one above the other', () => {
    const one = buildPromptStrokes([{ key: 'K', words: 'lift' }], CAMERA_SEES);
    expect(one[0]).toMatchObject({ isClosed: true });
    expect(one).toHaveLength(
      1 + buildWriting('K', WRITING).strokes.length + buildWriting('lift', WRITING).strokes.length,
    );
    const points = one.flatMap((stroke) => stroke.points);
    expect(Math.min(...points.map((point) => point.x))).toBeGreaterThan(CAMERA_SEES.x);
    expect(Math.max(...points.map((point) => point.y))).toBeLessThan(
      CAMERA_SEES.y + CAMERA_SEES.height,
    );
    expect(Math.min(...points.map((point) => point.y))).toBeGreaterThan(
      CAMERA_SEES.y + CAMERA_SEES.height * 0.75,
    );

    const two = buildPromptStrokes(
      [
        { key: 'J', words: 'fold it' },
        { key: 'K', words: 'lift' },
      ],
      CAMERA_SEES,
    );
    const topOfFirst = Math.min(...two[0]!.points.map((point) => point.y));
    expect(topOfFirst).toBeLessThan(Math.min(...one[0]!.points.map((point) => point.y)));
    expect(Math.max(...two.flatMap((stroke) => stroke.points).map((point) => point.y))).toBe(
      Math.max(...points.map((point) => point.y)),
    );
  });

  it("writes words with no key as words alone, in a row of their own above the keys, starting where a key's box would", () => {
    const hint = { key: null, words: 'take the airplane to the edge' };
    const alone = buildPromptStrokes([hint], CAMERA_SEES);
    expect(alone.some((stroke) => stroke.isClosed)).toBe(false);
    expect(alone).toHaveLength(buildWriting(hint.words, WRITING).strokes.length);
    const withOneKey = buildPromptStrokes([hint, { key: 'K', words: 'lift' }], CAMERA_SEES);
    const [box] = buildPromptStrokes([{ key: 'K', words: 'lift' }], CAMERA_SEES);
    const hintPoints = withOneKey.slice(0, alone.length).flatMap((stroke) => stroke.points);
    expect(Math.max(...hintPoints.map((point) => point.y))).toBeLessThan(
      Math.min(...box!.points.map((point) => point.y)),
    );
    expect(Math.min(...hintPoints.map((point) => point.x))).toBeCloseTo(
      Math.min(...box!.points.map((point) => point.x)),
      0,
    );
  });

  it('writes a prompt in its coloured pencil, and only that prompt', () => {
    const strokes = buildPromptStrokes(
      [
        { key: null, words: 'the airplane is ready', colour: 'green' },
        { key: 'K', words: 'board the airplane' },
      ],
      CAMERA_SEES,
    );
    const ready = buildWriting('the airplane is ready', WRITING).strokes.length;
    expect(strokes.slice(0, ready).every((stroke) => stroke.colour === 'green')).toBe(true);
    expect(strokes.slice(ready).every((stroke) => stroke.colour === undefined)).toBe(true);
  });

  it('gives a key with a long name a box as wide as the name needs, and puts the words after it', () => {
    const [box, ...rest] = buildPromptStrokes([{ key: 'SPACE', words: 'jump out' }], CAMERA_SEES);
    const boxXs = box!.points.map((point) => point.x);
    const name = buildWriting('SPACE', WRITING);
    expect(Math.max(...boxXs) - Math.min(...boxXs)).toBeGreaterThan(name.width);
    const nameStrokes = rest.slice(0, name.strokes.length);
    const wordStrokes = rest.slice(name.strokes.length);
    expect(
      Math.min(...nameStrokes.flatMap((stroke) => stroke.points).map((point) => point.x)),
    ).toBeGreaterThan(Math.min(...boxXs));
    expect(
      Math.max(...nameStrokes.flatMap((stroke) => stroke.points).map((point) => point.x)),
    ).toBeLessThan(Math.max(...boxXs));
    expect(
      Math.min(...wordStrokes.flatMap((stroke) => stroke.points).map((point) => point.x)),
    ).toBeGreaterThan(Math.max(...boxXs));

    const [square] = buildPromptStrokes([{ key: 'K', words: 'lift' }], CAMERA_SEES);
    const squareXs = square!.points.map((point) => point.x);
    const squareYs = square!.points.map((point) => point.y);
    expect(Math.max(...squareXs) - Math.min(...squareXs)).toBe(
      Math.max(...squareYs) - Math.min(...squareYs),
    );
  });

  it('draws nothing for no prompts', () => {
    expect(buildPromptStrokes([], CAMERA_SEES)).toEqual([]);
  });
});

describe('keepWhileUnchanged', () => {
  it('gives back the very same value while the key is the same, and makes a new one when it changes', () => {
    const kept = keepUntilChanged<number[]>();
    let made = 0;
    const make = (): number[] => [(made += 1)];
    const first = kept('a', make);
    expect(kept('a', make)).toBe(first);
    expect(made).toBe(1);
    expect(kept('b', make)).not.toBe(first);
    expect(kept('a', make)).toEqual([3]);
  });
});

// ---- Helpers ----

const KEYS = {
  useItemKey: 'J',
  canSwitchItemUse: false,
  couldMakeInstead: null,
  switchItemUseKey: 'L',
  interactKey: 'K',
  wouldMake: null,
  isSeated: false,
  flightKeys: { climb: '↑', dive: '↓', jumpOut: 'SPACE' },
  flyingHint: null,
} as const;
const SPEAR_RECIPE = { defId: SPEAR_RECIPE_ID, name: 'spear' };
const AIRPLANE_RECIPE = { defId: PAPER_AIRPLANE_RECIPE_ID, name: 'paper airplane' };
const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const WRITING = { position: { x: 0, y: 0 }, letterHeight: 28 };

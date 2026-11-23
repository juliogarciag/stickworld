import { describe, expect, it } from 'vitest';
import { written } from './handwriting';
import { promptsFor, promptStrokes } from './prompts';
import { keptWhileUnchanged } from './unchanged';

describe('promptsFor', () => {
  it('shows nothing when neither key would do anything', () => {
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: null })).toEqual([]);
  });

  it('names each key with what it would do, the item key first', () => {
    expect(promptsFor({ ...KEYS, itemUse: 'place', interaction: 'lift' })).toEqual([
      { key: 'J', words: 'set it down' },
      { key: 'K', words: 'lift' },
    ]);
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: 'board' })).toEqual([{ key: 'K', words: 'board' }]);
  });

  it('has words for everything a key can mean', () => {
    for (const itemUse of ['putLetterAway', 'openRecipes', 'craft', 'closeRecipes', 'place'] as const) expect(promptsFor({ ...KEYS, itemUse, interaction: null })[0]?.words).toBeTruthy();
    for (const interaction of ['read', 'putLetterAway', 'closeRecipes', 'lift', 'putDown', 'board'] as const) expect(promptsFor({ ...KEYS, itemUse: null, interaction })[0]?.words).toBeTruthy();
  });
});

describe('promptStrokes', () => {
  it('draws each prompt as a boxed key and its words, in the bottom left corner, one above the other', () => {
    const one = promptStrokes([{ key: 'K', words: 'lift' }], CAMERA_SEES);
    expect(one[0]).toMatchObject({ closed: true });
    expect(one).toHaveLength(1 + written('K', WRITING).strokes.length + written('lift', WRITING).strokes.length);
    const points = one.flatMap((stroke) => stroke.points);
    expect(Math.min(...points.map((point) => point.x))).toBeGreaterThan(CAMERA_SEES.x);
    expect(Math.max(...points.map((point) => point.y))).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height);
    expect(Math.min(...points.map((point) => point.y))).toBeGreaterThan(CAMERA_SEES.y + CAMERA_SEES.height * 0.75);

    const two = promptStrokes([{ key: 'J', words: 'fold it' }, { key: 'K', words: 'lift' }], CAMERA_SEES);
    const topOfFirst = Math.min(...two[0]!.points.map((point) => point.y));
    expect(topOfFirst).toBeLessThan(Math.min(...one[0]!.points.map((point) => point.y)));
    expect(Math.max(...two.flatMap((stroke) => stroke.points).map((point) => point.y))).toBe(Math.max(...points.map((point) => point.y)));
  });

  it('draws nothing for no prompts', () => {
    expect(promptStrokes([], CAMERA_SEES)).toEqual([]);
  });
});

describe('keptWhileUnchanged', () => {
  it('gives back the very same value while the key is the same, and makes a new one when it changes', () => {
    const kept = keptWhileUnchanged<number[]>();
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

const KEYS = { useItemKey: 'J', interactKey: 'K' } as const;
const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const WRITING = { at: { x: 0, y: 0 }, letterHeight: 28 };

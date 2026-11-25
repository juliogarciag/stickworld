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
      { key: 'J', words: 'set the airplane down' },
      { key: 'K', words: 'lift the airplane' },
    ]);
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: 'board' })).toEqual([{ key: 'K', words: 'board the airplane' }]);
  });

  it('names the keys that fly the airplane while he is seated in it, and only then', () => {
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: null, seated: true })).toEqual([
      { key: '↑', words: 'climb' },
      { key: '↓', words: 'dive' },
      { key: 'SPACE', words: 'jump out' },
    ]);
  });

  it('says first, in words with no key, that the airplane goes to the edge while he has still to be told', () => {
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: 'putDown', flyingHint: 'takeItToAnEdge' })).toEqual([
      { key: null, words: 'take the airplane to the edge' },
      { key: 'K', words: 'put the airplane down' },
    ]);
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: null, flyingHint: 'takeItToAnEdge' })).toEqual([{ key: null, words: 'take the airplane to the edge' }]);
  });

  it('says in green, in words with no key, that the airplane is ready once it sits on the edge, above the key that boards it', () => {
    expect(promptsFor({ ...KEYS, itemUse: null, interaction: 'board', flyingHint: 'readyToBoard' })).toEqual([
      { key: null, words: 'the airplane is ready', colour: 'green' },
      { key: 'K', words: 'board the airplane' },
    ]);
  });

  it('says what would be made, by the name the sim gives it', () => {
    expect(promptsFor({ ...KEYS, itemUse: 'craft', wouldMake: 'paper airplane', interaction: null })).toEqual([{ key: 'J', words: 'fold a paper airplane' }]);
  });

  it('has words for everything a key can mean, and each names what it is done to', () => {
    const words = [
      ...(['craft', 'place'] as const).map((itemUse) => promptsFor({ ...KEYS, itemUse, wouldMake: 'paper airplane', interaction: null })[0]?.words),
      ...(['read', 'putLetterAway', 'lift', 'putDown', 'board', 'pickUp'] as const).map((interaction) => promptsFor({ ...KEYS, itemUse: null, interaction })[0]?.words),
    ];
    for (const prompt of words) expect(prompt).toMatch(/letter|airplane|paper/);
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

  it('writes words with no key as words alone, in a row of their own above the keys, starting where a key\'s box would', () => {
    const hint = { key: null, words: 'take the airplane to the edge' };
    const alone = promptStrokes([hint], CAMERA_SEES);
    expect(alone.some((stroke) => stroke.closed)).toBe(false);
    expect(alone).toHaveLength(written(hint.words, WRITING).strokes.length);
    const withAKey = promptStrokes([hint, { key: 'K', words: 'lift' }], CAMERA_SEES);
    const [box] = promptStrokes([{ key: 'K', words: 'lift' }], CAMERA_SEES);
    const hintPoints = withAKey.slice(0, alone.length).flatMap((stroke) => stroke.points);
    expect(Math.max(...hintPoints.map((point) => point.y))).toBeLessThan(Math.min(...box!.points.map((point) => point.y)));
    expect(Math.min(...hintPoints.map((point) => point.x))).toBeCloseTo(Math.min(...box!.points.map((point) => point.x)), 0);
  });

  it('writes a prompt in its coloured pencil, and only that prompt', () => {
    const strokes = promptStrokes([{ key: null, words: 'the airplane is ready', colour: 'green' }, { key: 'K', words: 'board the airplane' }], CAMERA_SEES);
    const ready = written('the airplane is ready', WRITING).strokes.length;
    expect(strokes.slice(0, ready).every((stroke) => stroke.colour === 'green')).toBe(true);
    expect(strokes.slice(ready).every((stroke) => stroke.colour === undefined)).toBe(true);
  });

  it('gives a key with a long name a box as wide as the name needs, and puts the words after it', () => {
    const [box, ...rest] = promptStrokes([{ key: 'SPACE', words: 'jump out' }], CAMERA_SEES);
    const boxXs = box!.points.map((point) => point.x);
    const name = written('SPACE', WRITING);
    expect(Math.max(...boxXs) - Math.min(...boxXs)).toBeGreaterThan(name.width);
    const nameStrokes = rest.slice(0, name.strokes.length);
    const wordStrokes = rest.slice(name.strokes.length);
    expect(Math.min(...nameStrokes.flatMap((stroke) => stroke.points).map((point) => point.x))).toBeGreaterThan(Math.min(...boxXs));
    expect(Math.max(...nameStrokes.flatMap((stroke) => stroke.points).map((point) => point.x))).toBeLessThan(Math.max(...boxXs));
    expect(Math.min(...wordStrokes.flatMap((stroke) => stroke.points).map((point) => point.x))).toBeGreaterThan(Math.max(...boxXs));

    const [square] = promptStrokes([{ key: 'K', words: 'lift' }], CAMERA_SEES);
    const squareXs = square!.points.map((point) => point.x);
    const squareYs = square!.points.map((point) => point.y);
    expect(Math.max(...squareXs) - Math.min(...squareXs)).toBe(Math.max(...squareYs) - Math.min(...squareYs));
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

const KEYS = { useItemKey: 'J', interactKey: 'K', wouldMake: null, seated: false, flightKeys: { climb: '↑', dive: '↓', jumpOut: 'SPACE' }, flyingHint: null } as const;
const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const WRITING = { at: { x: 0, y: 0 }, letterHeight: 28 };

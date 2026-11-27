import { describe, expect, it } from 'vitest';
import { buildWriting } from './handwriting';
import { buildKeysAndWords } from './keysAndWords';

describe('buildKeysAndWords', () => {
  it('draws each key as a box with its name inside, one after another, and the words after the last', () => {
    const { strokes, width } = buildKeysAndWords({ keys: ['←', '→'], words: 'walk', position: POSITION, sizes: SIZES });
    const boxes = strokes.filter((stroke) => stroke.isClosed);
    expect(boxes).toHaveLength(2);
    const [first, second] = boxes.map((box) => ({ left: Math.min(...box.points.map((point) => point.x)), right: Math.max(...box.points.map((point) => point.x)), top: Math.min(...box.points.map((point) => point.y)) }));
    expect(first).toEqual({ left: POSITION.x, right: POSITION.x + SIZES.keySide, top: POSITION.y });
    expect(second!.left).toBe(first!.right + SIZES.keyGap);
    const said = buildWriting('walk', { position: { x: 0, y: 0 }, letterHeight: SIZES.letterHeight });
    expect(strokes).toHaveLength(2 + buildWriting('←', WRITING).strokes.length + buildWriting('→', WRITING).strokes.length + said.strokes.length);
    const xs = strokes.flatMap((stroke) => stroke.points).map((point) => point.x);
    expect(Math.max(...xs) - POSITION.x).toBeCloseTo(width, 6);
    expect(width).toBeCloseTo(2 * (SIZES.keySide + SIZES.keyGap) + said.width, 6);
  });

  it('gives a key with a long name a box as wide as the name needs', () => {
    const { strokes } = buildKeysAndWords({ keys: ['ENTER'], words: 'play again', position: POSITION, sizes: SIZES });
    const boxXs = strokes[0]!.points.map((point) => point.x);
    const name = buildWriting('ENTER', WRITING);
    expect(Math.max(...boxXs) - Math.min(...boxXs)).toBeCloseTo(name.width + 2 * SIZES.keyPadding, 6);
  });

  it('is only the words when there is no key', () => {
    expect(buildKeysAndWords({ keys: [], words: 'walk', position: POSITION, sizes: SIZES }).strokes.every((stroke) => !stroke.isClosed)).toBe(true);
  });

  it('draws a small box with a thinner line than a large one', () => {
    const small = buildKeysAndWords({ keys: ['K'], words: '', position: POSITION, sizes: { ...SIZES, keySide: 20 } }).strokes[0]!;
    const large = buildKeysAndWords({ keys: ['K'], words: '', position: POSITION, sizes: SIZES }).strokes[0]!;
    expect(small.thickness).toBeLessThan(large.thickness);
  });
});

// ---- Helpers ----

const POSITION = { x: 100, y: 200 };
const SIZES = { keySide: 58, keyPadding: 14, letterHeight: 28, keyGap: 24 };
const WRITING = { position: { x: 0, y: 0 }, letterHeight: SIZES.letterHeight };

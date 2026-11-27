import { describe, expect, it } from 'vitest';
import { __testing__, buildWriting } from './handwriting';

describe('buildWriting', () => {
  it('writes every letter of a word as strokes inside its line, left to right', () => {
    const { strokes, width, height } = buildWriting('paper', {
      position: POSITION,
      letterHeight: 30,
    });
    expect(strokes.length).toBeGreaterThanOrEqual(5);
    expect(height).toBe(30);
    for (const point of strokes.flatMap((stroke) => stroke.points)) {
      expect(point.x).toBeGreaterThanOrEqual(POSITION.x);
      expect(point.x).toBeLessThanOrEqual(POSITION.x + width + 1e-9);
      expect(point.y).toBeGreaterThanOrEqual(POSITION.y);
      expect(point.y).toBeLessThanOrEqual(POSITION.y + height);
    }
    const starts = strokes.map((stroke) => Math.min(...stroke.points.map((point) => point.x)));
    expect(starts[starts.length - 1]).toBeGreaterThan(starts[0]!);
  });

  it('prints in capitals: small letters and capitals come out the same', () => {
    expect(buildWriting('fold it', { position: POSITION, letterHeight: 30 })).toEqual(
      buildWriting('FOLD IT', { position: POSITION, letterHeight: 30 }),
    );
  });

  it('has a drawing for every letter, every digit and the marks a sentence needs', () => {
    for (const character of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,'!?:-") {
      const glyph = __testing__.GLYPHS[character];
      expect(glyph, character).toBeDefined();
      expect(
        glyph!.paths.every(
          (path) =>
            path.length >= 2 &&
            path.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        ),
        character,
      ).toBe(true);
    }
  });

  it('leaves a space for a character it cannot write, and writes nothing for it', () => {
    expect(buildWriting('~', { position: POSITION, letterHeight: 30 }).strokes).toEqual([]);
    expect(buildWriting('a~b', { position: POSITION, letterHeight: 30 }).width).toBe(
      buildWriting('a b', { position: POSITION, letterHeight: 30 }).width,
    );
  });

  it('starts a new line where the next word would not fit, and never breaks a word', () => {
    const text = 'a sheet of paper can fly';
    const oneLine = buildWriting(text, { position: POSITION, letterHeight: 30 });
    const wrappedText = buildWriting(text, {
      position: POSITION,
      letterHeight: 30,
      lineWidth: oneLine.width / 3,
    });
    expect(wrappedText.height).toBeGreaterThan(oneLine.height);
    expect(wrappedText.width).toBeLessThanOrEqual(oneLine.width / 3);
    expect(wrappedText.strokes).toHaveLength(oneLine.strokes.length);
    expect(__testing__.wrapText('ONE TWO', 0.1)).toEqual(['ONE', 'TWO']);
    expect(__testing__.wrapText('  ONE   TWO ', Infinity)).toEqual(['ONE TWO']);
  });

  it('is twice as big at twice the letter height, and never thicker than the pencil', () => {
    const small = buildWriting('fly', { position: POSITION, letterHeight: 20 });
    const big = buildWriting('fly', { position: POSITION, letterHeight: 40 });
    expect(big.width).toBeCloseTo(small.width * 2, 9);
    expect(big.strokes[0]!.thickness).toBeGreaterThan(small.strokes[0]!.thickness);
    const huge = buildWriting('fly', { position: POSITION, letterHeight: 400 });
    expect(huge.strokes[0]!.thickness).toBe(
      buildWriting('fly', { position: POSITION, letterHeight: 800 }).strokes[0]!.thickness,
    );
  });

  it('writes nothing for no text', () => {
    expect(buildWriting('', { position: POSITION, letterHeight: 30 })).toEqual({
      strokes: [],
      width: 0,
      height: 30,
    });
  });
});

// ---- Helpers ----

const POSITION = { x: 100, y: 50 };

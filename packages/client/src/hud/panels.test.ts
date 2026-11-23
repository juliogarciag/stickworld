import { describe, expect, it } from 'vitest';
import type { Stroke } from '../render/strokes';
import { written } from './handwriting';
import { letterSheetStrokes } from './panels';

describe('letterSheetStrokes', () => {
  it('draws a sheet near the top of the screen with all of the text inside it', () => {
    const [sheet, ...words] = letterSheetStrokes(LETTER, CAMERA_SEES);
    expect(sheet).toMatchObject({ closed: true });
    expect(words.length).toBeGreaterThan(TEXT.replaceAll(' ', '').length / 2);
    const box = boundsOf([sheet!]);
    const text = boundsOf(words);
    expect(text.left).toBeGreaterThan(box.left);
    expect(text.right).toBeLessThan(box.right);
    expect(text.top).toBeGreaterThan(box.top);
    expect(text.bottom).toBeLessThan(box.bottom);
    expect(box.top).toBeGreaterThan(CAMERA_SEES.y);
    expect(box.bottom).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height / 2);
    expect((box.left + box.right) / 2).toBeCloseTo(CAMERA_SEES.x + CAMERA_SEES.width / 2, -1);
  });

  it('says under the text what the letter has taught him, inside a sheet that is taller for it', () => {
    const [plainSheet, ...plainWords] = letterSheetStrokes(LETTER, CAMERA_SEES);
    const [sheet, ...words] = letterSheetStrokes(TEACHING, CAMERA_SEES);
    expect(words).toHaveLength(plainWords.length + written('learned: paper airplane', WRITING).strokes.length);
    expect(heightOf([sheet!])).toBeGreaterThan(heightOf([plainSheet!]));
    expect(boundsOf(words).bottom).toBeGreaterThan(boundsOf(plainWords).bottom);
    expect(boundsOf(words).bottom).toBeLessThan(boundsOf([sheet!]).bottom);
  });

  it('is taller for a longer letter, and stays on a narrow screen', () => {
    expect(heightOf(letterSheetStrokes({ ...LETTER, text: `${TEXT} ${TEXT}` }, CAMERA_SEES))).toBeGreaterThan(heightOf(letterSheetStrokes(LETTER, CAMERA_SEES)));
    const narrow = { ...CAMERA_SEES, width: 600 };
    const box = boundsOf(letterSheetStrokes(TEACHING, narrow));
    expect(box.left).toBeGreaterThan(narrow.x);
    expect(box.right).toBeLessThan(narrow.x + narrow.width);
  });
});

// ---- Helpers ----

const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const WRITING = { at: { x: 0, y: 0 }, letterHeight: 30 };
const TEXT = 'A sheet of paper can fly. Fold it into an airplane and carry it to the edge.';
const LETTER = { text: TEXT, teaches: null };
const TEACHING = { text: TEXT, teaches: 'paper airplane' };

function boundsOf(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  return { left: Math.min(...points.map((point) => point.x)), right: Math.max(...points.map((point) => point.x)), top: Math.min(...points.map((point) => point.y)), bottom: Math.max(...points.map((point) => point.y)) };
}

function heightOf(strokes: readonly Stroke[]): number {
  const { top, bottom } = boundsOf(strokes);
  return bottom - top;
}

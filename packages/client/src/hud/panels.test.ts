import { describe, expect, it } from 'vitest';
import type { Stroke } from '../render/strokes';
import { buildWriting } from './handwriting';
import { buildLetterSheetStrokes } from './panels';

describe('buildLetterSheetStrokes', () => {
  it('draws a sheet near the top of the screen with all of the text inside it', () => {
    const [sheet, ...words] = buildLetterSheetStrokes(LETTER, CAMERA_SEES);
    expect(sheet).toMatchObject({ isClosed: true });
    expect(words.length).toBeGreaterThan(TEXT.replaceAll(' ', '').length / 2);
    const box = getBounds([sheet!]);
    const text = getBounds(words);
    expect(text.left).toBeGreaterThan(box.left);
    expect(text.right).toBeLessThan(box.right);
    expect(text.top).toBeGreaterThan(box.top);
    expect(text.bottom).toBeLessThan(box.bottom);
    expect(box.top).toBeGreaterThan(CAMERA_SEES.y);
    expect(box.bottom).toBeLessThan(CAMERA_SEES.y + CAMERA_SEES.height / 2);
    expect((box.left + box.right) / 2).toBeCloseTo(CAMERA_SEES.x + CAMERA_SEES.width / 2, -1);
  });

  it('says under the text what the letter has taught the stick man, inside a sheet that is taller for it', () => {
    const [plainSheet, ...plainWords] = buildLetterSheetStrokes(LETTER, CAMERA_SEES);
    const [sheet, ...words] = buildLetterSheetStrokes(TEACHING, CAMERA_SEES);
    expect(words).toHaveLength(plainWords.length + buildWriting('learned: paper airplane', WRITING).strokes.length);
    expect(measureHeight([sheet!])).toBeGreaterThan(measureHeight([plainSheet!]));
    expect(getBounds(words).bottom).toBeGreaterThan(getBounds(plainWords).bottom);
    expect(getBounds(words).bottom).toBeLessThan(getBounds([sheet!]).bottom);
  });

  it('is taller for a longer letter, and stays on a narrow screen', () => {
    expect(measureHeight(buildLetterSheetStrokes({ ...LETTER, text: `${TEXT} ${TEXT}` }, CAMERA_SEES))).toBeGreaterThan(measureHeight(buildLetterSheetStrokes(LETTER, CAMERA_SEES)));
    const narrow = { ...CAMERA_SEES, width: 600 };
    const box = getBounds(buildLetterSheetStrokes(TEACHING, narrow));
    expect(box.left).toBeGreaterThan(narrow.x);
    expect(box.right).toBeLessThan(narrow.x + narrow.width);
  });
});

// ---- Helpers ----

const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const WRITING = { position: { x: 0, y: 0 }, letterHeight: 30 };
const TEXT = 'A sheet of paper can fly. Fold it into an airplane and carry it to the edge.';
const LETTER = { text: TEXT, teaches: null };
const TEACHING = { text: TEXT, teaches: 'paper airplane' };

function getBounds(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  return { left: Math.min(...points.map((point) => point.x)), right: Math.max(...points.map((point) => point.x)), top: Math.min(...points.map((point) => point.y)), bottom: Math.max(...points.map((point) => point.y)) };
}

function measureHeight(strokes: readonly Stroke[]): number {
  const { top, bottom } = getBounds(strokes);
  return bottom - top;
}

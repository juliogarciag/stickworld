import { describe, expect, it } from 'vitest';
import type { Stroke } from '../render/strokes';
import { itemSlotBox } from './itemSlots';
import { letterSheetStrokes, recipeListStrokes } from './panels';

describe('letterSheetStrokes', () => {
  it('draws a sheet near the top of the screen with all of the text inside it', () => {
    const [sheet, ...words] = letterSheetStrokes(TEXT, CAMERA_SEES);
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

  it('is taller for a longer letter, and stays on a narrow screen', () => {
    expect(heightOf(letterSheetStrokes(`${TEXT} ${TEXT}`, CAMERA_SEES))).toBeGreaterThan(heightOf(letterSheetStrokes(TEXT, CAMERA_SEES)));
    const narrow = { ...CAMERA_SEES, width: 600 };
    const box = boundsOf(letterSheetStrokes(TEXT, narrow));
    expect(box.left).toBeGreaterThan(narrow.x);
    expect(box.right).toBeLessThan(narrow.x + narrow.width);
  });
});

describe('recipeListStrokes', () => {
  it('draws a box beside the item slots with a line for each recipe', () => {
    const one = recipeListStrokes({ open: true, recipes: [AIRPLANE] }, CAMERA_SEES);
    const two = recipeListStrokes({ open: true, recipes: [AIRPLANE, { defId: 2, name: 'paper boat' }] }, CAMERA_SEES);
    const slot = itemSlotBox(1, CAMERA_SEES);
    expect(one[0]).toMatchObject({ closed: true });
    expect(boundsOf(one).left).toBeGreaterThan(slot.x + slot.width);
    expect(two.length).toBeGreaterThan(one.length);
    expect(heightOf(two)).toBeGreaterThan(heightOf(one));
  });

  it('says so when he knows no recipe, instead of drawing an empty box', () => {
    expect(recipeListStrokes({ open: true, recipes: [] }, CAMERA_SEES).length).toBeGreaterThan(1);
  });
});

// ---- Helpers ----

const CAMERA_SEES = { x: 40, y: -20, width: 1920, height: 1080 };
const TEXT = 'A sheet of paper can fly. Hold yours and fold it into an airplane.';
const AIRPLANE = { defId: 1, name: 'paper airplane' };

function boundsOf(strokes: readonly Stroke[]) {
  const points = strokes.flatMap((stroke) => stroke.points);
  return { left: Math.min(...points.map((point) => point.x)), right: Math.max(...points.map((point) => point.x)), top: Math.min(...points.map((point) => point.y)), bottom: Math.max(...points.map((point) => point.y)) };
}

function heightOf(strokes: readonly Stroke[]): number {
  const { top, bottom } = boundsOf(strokes);
  return bottom - top;
}

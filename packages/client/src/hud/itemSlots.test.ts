import { PAPER_ITEM_ID, type ItemSlot } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import type { Stroke } from '../render/strokes';
import { getItemSlotBox, buildItemSlotStrokes } from './itemSlots';
import { buildLetterSheetStrokes } from './panels';

describe('buildItemSlotStrokes', () => {
  it('draws an empty slot as its box and nothing else: no number that could be read as a count', () => {
    const strokes = buildItemSlotStrokes([EMPTY_SLOT], CAMERA_SEES);
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toMatchObject({ isClosed: true });
    expect(strokes[0]?.points).toHaveLength(4);
    const box = getItemSlotBox(1, CAMERA_SEES);
    expect(Math.max(...getPoints(strokes).map((point) => point.y))).toBe(box.y + box.height);
  });

  it('draws the paper inside the box of the slot that holds it', () => {
    const empty = buildItemSlotStrokes([EMPTY_SLOT], CAMERA_SEES);
    const withPaper = buildItemSlotStrokes([{ ...EMPTY_SLOT, itemDefId: PAPER_ITEM_ID }], CAMERA_SEES);
    const paper = withPaper.slice(empty.length);
    expect(paper.length).toBeGreaterThan(0);
    const box = getItemSlotBox(1, CAMERA_SEES);
    for (const point of getPoints(paper)) {
      expect(point.x).toBeGreaterThan(box.x);
      expect(point.x).toBeLessThan(box.x + box.width);
      expect(point.y).toBeGreaterThan(box.y);
      expect(point.y).toBeLessThan(box.y + box.height);
    }
  });

  it('shows an item it has no drawing for, so a held item never looks like an empty slot', () => {
    expect(buildItemSlotStrokes([{ ...EMPTY_SLOT, itemDefId: 987654 }], CAMERA_SEES).length).toBeGreaterThan(buildItemSlotStrokes([EMPTY_SLOT], CAMERA_SEES).length);
  });

  it('draws a second, heavier box around the selected slot', () => {
    const unselected = buildItemSlotStrokes([EMPTY_SLOT], CAMERA_SEES);
    const selected = buildItemSlotStrokes([{ ...EMPTY_SLOT, isSelected: true }], CAMERA_SEES);
    expect(selected).toHaveLength(unselected.length + 1);
    const outer = selected[selected.length - 1]!;
    const box = getItemSlotBox(1, CAMERA_SEES);
    expect(outer.isClosed).toBe(true);
    expect(outer.thickness).toBeGreaterThan(unselected[0]!.thickness);
    expect(Math.min(...outer.points.map((point) => point.x))).toBeLessThan(box.x);
    expect(Math.max(...outer.points.map((point) => point.x))).toBeGreaterThan(box.x + box.width);
  });

  it('keeps the slots in the top right corner of what the camera sees, wherever that is and however wide, side by side', () => {
    const moved = { ...CAMERA_SEES, x: 500, y: -300 };
    const first = getItemSlotBox(1, moved);
    const second = getItemSlotBox(2, moved);
    const measureFromRight = (box: { x: number; width: number }, seen: typeof CAMERA_SEES): number => seen.x + seen.width - (box.x + box.width);
    expect(measureFromRight(first, moved)).toBe(measureFromRight(getItemSlotBox(1, CAMERA_SEES), CAMERA_SEES));
    expect(first.y - moved.y).toBe(getItemSlotBox(1, CAMERA_SEES).y - CAMERA_SEES.y);
    expect(measureFromRight(first, moved)).toBeGreaterThan(0);
    expect(first.x).toBeGreaterThan(moved.x + moved.width * 0.9);
    expect(first.y).toBeGreaterThan(moved.y);
    // The next slot is to its left, clear of it.
    expect(second.x + second.width).toBeLessThan(first.x);
    expect(second.y).toBe(first.y);
    // On a narrow view it is the same distance from the right side.
    const narrow = { ...CAMERA_SEES, width: 1200 };
    expect(measureFromRight(getItemSlotBox(1, narrow), narrow)).toBe(measureFromRight(first, moved));
  });

  it('is small and clear of the letter the stick man holds up, on the narrowest view the HUD has', () => {
    const narrow = { ...CAMERA_SEES, width: 1200 };
    const box = getItemSlotBox(1, narrow);
    expect(box.width).toBeLessThan(80);
    const sheet = buildLetterSheetStrokes({ text: 'A sheet of paper can fly. Fold it into an airplane and carry it to the edge.', teaches: 'paper airplane' }, narrow);
    const rightOfSheet = Math.max(...sheet.flatMap((stroke) => stroke.points).map((point) => point.x));
    const selected = buildItemSlotStrokes([{ ...EMPTY_SLOT, isSelected: true }], narrow);
    expect(Math.min(...getPoints(selected).map((point) => point.x))).toBeGreaterThan(rightOfSheet);
  });

  it('draws nothing when there are no slots', () => {
    expect(buildItemSlotStrokes([], CAMERA_SEES)).toEqual([]);
  });
});

// ---- Helpers ----

const CAMERA_SEES = { x: 0, y: 0, width: 1920, height: 1080 };
const EMPTY_SLOT: ItemSlot = { slot: 1, itemDefId: null, isSelected: false };

function getPoints(strokes: readonly Stroke[]) {
  return strokes.flatMap((stroke) => stroke.points);
}

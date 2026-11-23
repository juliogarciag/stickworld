import { PAPER_ITEM_ID, type ItemSlot } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import type { Stroke } from '../render/strokes';
import { itemSlotBox, itemSlotStrokes } from './itemSlots';

describe('itemSlotStrokes', () => {
  it('draws an empty slot as its box and its number', () => {
    const strokes = itemSlotStrokes([EMPTY_SLOT], CAMERA_SEES);
    expect(strokes[0]).toMatchObject({ closed: true });
    expect(strokes[0]?.points).toHaveLength(4);
    expect(strokes).toHaveLength(2);
  });

  it('draws the paper inside the box of the slot that holds it', () => {
    const empty = itemSlotStrokes([EMPTY_SLOT], CAMERA_SEES);
    const withPaper = itemSlotStrokes([{ ...EMPTY_SLOT, itemDefId: PAPER_ITEM_ID }], CAMERA_SEES);
    const paper = withPaper.slice(empty.length);
    expect(paper.length).toBeGreaterThan(0);
    const box = itemSlotBox(1, CAMERA_SEES);
    for (const point of pointsOf(paper)) {
      expect(point.x).toBeGreaterThan(box.x);
      expect(point.x).toBeLessThan(box.x + box.width);
      expect(point.y).toBeGreaterThan(box.y);
      expect(point.y).toBeLessThan(box.y + box.height);
    }
  });

  it('shows an item it has no drawing for, so a held item never looks like an empty slot', () => {
    expect(itemSlotStrokes([{ ...EMPTY_SLOT, itemDefId: 987654 }], CAMERA_SEES).length).toBeGreaterThan(itemSlotStrokes([EMPTY_SLOT], CAMERA_SEES).length);
  });

  it('draws a second, heavier box around the selected slot', () => {
    const unselected = itemSlotStrokes([EMPTY_SLOT], CAMERA_SEES);
    const selected = itemSlotStrokes([{ ...EMPTY_SLOT, selected: true }], CAMERA_SEES);
    expect(selected).toHaveLength(unselected.length + 1);
    const outer = selected[selected.length - 1]!;
    const box = itemSlotBox(1, CAMERA_SEES);
    expect(outer.closed).toBe(true);
    expect(outer.thickness).toBeGreaterThan(unselected[0]!.thickness);
    expect(Math.min(...outer.points.map((point) => point.x))).toBeLessThan(box.x);
    expect(Math.max(...outer.points.map((point) => point.x))).toBeGreaterThan(box.x + box.width);
  });

  it('keeps the slots in the top left corner of what the camera sees, wherever that is, side by side', () => {
    const moved = { ...CAMERA_SEES, x: 500, y: -300 };
    const first = itemSlotBox(1, moved);
    const second = itemSlotBox(2, moved);
    expect(first.x - moved.x).toBe(itemSlotBox(1, CAMERA_SEES).x - CAMERA_SEES.x);
    expect(first.y - moved.y).toBe(itemSlotBox(1, CAMERA_SEES).y - CAMERA_SEES.y);
    expect(first.x).toBeGreaterThan(moved.x);
    expect(first.y).toBeGreaterThan(moved.y);
    expect(second.x).toBeGreaterThan(first.x + first.width);
    expect(second.y).toBe(first.y);
  });

  it('draws nothing when there are no slots', () => {
    expect(itemSlotStrokes([], CAMERA_SEES)).toEqual([]);
  });
});

// ---- Helpers ----

const CAMERA_SEES = { x: 0, y: 0, width: 1920, height: 1080 };
const EMPTY_SLOT: ItemSlot = { slot: 1, itemDefId: null, selected: false };

function pointsOf(strokes: readonly Stroke[]) {
  return strokes.flatMap((stroke) => stroke.points);
}

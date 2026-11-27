import type { CheckpointView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { checkpointStrokes } from './checkpoint';
import { toPixels } from './units';

describe('the checkpoint', () => {
  it('is a peg standing where the sim says, with a closed diamond on top of it', () => {
    const [peg, diamond] = checkpointStrokes(NOT_PASSED);
    expect(peg!.points[0]).toEqual({ x: toPixels(NOT_PASSED.at.x), y: toPixels(NOT_PASSED.at.y) });
    expect(peg!.points[1]!.x).toBe(toPixels(NOT_PASSED.at.x));
    expect(peg!.points[1]!.y).toBeLessThan(toPixels(NOT_PASSED.at.y));
    expect(diamond!.closed).toBe(true);
    // The diamond sits on the peg: its lowest corner is the top of the peg.
    expect(Math.max(...diamond!.points.map((point) => point.y))).toBeCloseTo(peg!.points[1]!.y);
    expect(checkpointStrokes(NOT_PASSED)).toHaveLength(2);
  });

  it('gets a tick over it once it is passed, and is otherwise drawn the same', () => {
    const passed = checkpointStrokes({ ...NOT_PASSED, passed: true });
    expect(passed.slice(0, 2)).toEqual(checkpointStrokes(NOT_PASSED));
    expect(passed).toHaveLength(3);
    const tick = passed[2]!;
    const topOfTheDiamond = Math.min(...passed[1]!.points.map((point) => point.y));
    expect(Math.max(...tick.points.map((point) => point.y))).toBeLessThan(topOfTheDiamond);
    expect(tick.closed).toBeFalsy();
  });

  it('is nowhere below the floor it stands on', () => {
    for (const stroke of checkpointStrokes({ ...NOT_PASSED, passed: true })) {
      for (const point of stroke.points) expect(point.y).toBeLessThanOrEqual(toPixels(NOT_PASSED.at.y));
    }
  });
});

// ---- Helpers ----

const NOT_PASSED: CheckpointView = { at: { x: 7, y: 0.5 }, passed: false };

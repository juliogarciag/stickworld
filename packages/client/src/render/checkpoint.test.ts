import type { CheckpointView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildCheckpointStrokes } from './checkpoint';
import { convertToPixels } from './units';

describe('the checkpoint', () => {
  it('is a peg standing where the sim says, with a closed diamond on top of it', () => {
    const [peg, diamond] = buildCheckpointStrokes(NOT_PASSED);
    expect(peg!.points[0]).toEqual({ x: convertToPixels(NOT_PASSED.at.x), y: convertToPixels(NOT_PASSED.at.y) });
    expect(peg!.points[1]!.x).toBe(convertToPixels(NOT_PASSED.at.x));
    expect(peg!.points[1]!.y).toBeLessThan(convertToPixels(NOT_PASSED.at.y));
    expect(diamond!.closed).toBe(true);
    // The diamond sits on the peg: its lowest corner is the top of the peg.
    expect(Math.max(...diamond!.points.map((point) => point.y))).toBeCloseTo(peg!.points[1]!.y);
    expect(buildCheckpointStrokes(NOT_PASSED)).toHaveLength(2);
  });

  it('gets a tick over it once it is passed, and is otherwise drawn the same', () => {
    const passed = buildCheckpointStrokes({ ...NOT_PASSED, passed: true });
    expect(passed.slice(0, 2)).toEqual(buildCheckpointStrokes(NOT_PASSED));
    expect(passed).toHaveLength(3);
    const tick = passed[2]!;
    const topOfTheDiamond = Math.min(...passed[1]!.points.map((point) => point.y));
    expect(Math.max(...tick.points.map((point) => point.y))).toBeLessThan(topOfTheDiamond);
    expect(tick.closed).toBeFalsy();
  });

  it('is nowhere below the floor it stands on', () => {
    for (const stroke of buildCheckpointStrokes({ ...NOT_PASSED, passed: true })) {
      for (const point of stroke.points) expect(point.y).toBeLessThanOrEqual(convertToPixels(NOT_PASSED.at.y));
    }
  });
});

// ---- Helpers ----

const NOT_PASSED: CheckpointView = { at: { x: 7, y: 0.5 }, passed: false };

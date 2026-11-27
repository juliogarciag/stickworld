import type { CheckpointView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildCheckpointStrokes } from './checkpoint';
import { convertToPixels } from './units';

describe('the checkpoint', () => {
  it('is a peg at the position the sim gives, with a closed diamond on top of the peg', () => {
    const [peg, diamond] = buildCheckpointStrokes(NOT_PASSED);
    expect(peg!.points[0]).toEqual({ x: convertToPixels(NOT_PASSED.position.x), y: convertToPixels(NOT_PASSED.position.y) });
    expect(peg!.points[1]!.x).toBe(convertToPixels(NOT_PASSED.position.x));
    expect(peg!.points[1]!.y).toBeLessThan(convertToPixels(NOT_PASSED.position.y));
    expect(diamond!.isClosed).toBe(true);
    // The diamond sits on the peg: its lowest corner is the top of the peg.
    expect(Math.max(...diamond!.points.map((point) => point.y))).toBeCloseTo(peg!.points[1]!.y);
    expect(buildCheckpointStrokes(NOT_PASSED)).toHaveLength(2);
  });

  it('gets a tick above the diamond once passed, and is otherwise drawn the same', () => {
    const passedStrokes = buildCheckpointStrokes({ ...NOT_PASSED, isPassed: true });
    expect(passedStrokes.slice(0, 2)).toEqual(buildCheckpointStrokes(NOT_PASSED));
    expect(passedStrokes).toHaveLength(3);
    const tick = passedStrokes[2]!;
    const topOfDiamond = Math.min(...passedStrokes[1]!.points.map((point) => point.y));
    expect(Math.max(...tick.points.map((point) => point.y))).toBeLessThan(topOfDiamond);
    expect(tick.isClosed).toBeFalsy();
  });

  it('has no stroke below the floor', () => {
    for (const stroke of buildCheckpointStrokes({ ...NOT_PASSED, isPassed: true })) {
      for (const point of stroke.points) expect(point.y).toBeLessThanOrEqual(convertToPixels(NOT_PASSED.position.y));
    }
  });
});

// ---- Helpers ----

const NOT_PASSED: CheckpointView = { position: { x: 7, y: 0.5 }, isPassed: false };

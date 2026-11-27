import { createSim } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, createPageTurn } from './pageTurn';

describe('a page turn', () => {
  it('is not in progress until it is started, and is over after its time', () => {
    const turn = createPageTurn();
    expect(turn.getTurningPage()).toBeUndefined();
    turn.advanceBy(1);
    expect(turn.getTurningPage()).toBeUndefined();
    turn.start(FINISHED);
    expect(turn.getTurningPage()).toEqual({ ...FINISHED, edgeAt: 1 });
    turn.advanceBy(TURN.seconds / 2);
    expect(turn.getTurningPage()).toBeDefined();
    turn.advanceBy(TURN.seconds / 2);
    expect(turn.getTurningPage()).toBeUndefined();
  });

  it('slides the sheet one way only, slowly at first, from covering the view to out of it', () => {
    const edges = Array.from({ length: 55 }, (_, frame) =>
      getEdgeAfter((frame / 54) * TURN.seconds),
    );
    expect(edges[0]).toBe(1);
    expect(edges[edges.length - 1]).toBeLessThan(0);
    for (let frame = 1; frame < edges.length; frame += 1) {
      expect(edges[frame]).toBeLessThan(edges[frame - 1]!);
    }
    // A tenth of the way through the time it has hardly moved.
    expect(getEdgeAfter(TURN.seconds / 10)).toBeGreaterThan(0.95);
  });

  it('starts over when another sheet is finished before it is done', () => {
    const turn = createPageTurn();
    turn.start(FINISHED);
    turn.advanceBy(TURN.seconds * 0.8);
    const next = { ...FINISHED, camera: { scrollX: 5, scrollY: 6, zoom: 0.5 } };
    turn.start(next);
    expect(turn.getTurningPage()).toEqual({ ...next, edgeAt: 1 });
  });
});

// ---- Helpers ----

const { TURN, getEdgeAfter } = __testing__;
const FINISHED = { sim: createSim({ level: 1 }), camera: { scrollX: 1, scrollY: 2, zoom: 1 } };

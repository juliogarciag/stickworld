import { getLevelById, type FloorSegment } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, type Followed } from './levelCamera';

describe('getFramingWanted', () => {
  it('is centred on him and as wide as at rest while he walks along the line, away from any edge', () => {
    expect(getFramingWanted({ stickMan: makeStickManStandingAt(4), floor: LEVEL_3, metresAcrossAtRest: 19.2 })).toEqual({ ahead: 0, metresAcross: 19.2 });
    expect(getFramingWanted({ stickMan: makeStickManStandingAt(4), floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual({ ahead: 0, metresAcross: 12 });
  });

  it('at the edge of level 3, facing the gap, shows the far side however wide the view is at rest', () => {
    for (const [window, metresAcrossAtRest] of WINDOWS) {
      const stickMan = makeStickManStandingAt(GAP.from - 1);
      const { ahead, metresAcross } = getFramingWanted({ stickMan, floor: LEVEL_3, metresAcrossAtRest });
      const right = stickMan.feet.x + ahead + metresAcross / 2;
      const left = stickMan.feet.x + ahead - metresAcross / 2;
      expect(right, window).toBeGreaterThanOrEqual(GAP.to + FRAMING.ofTheNextLine - 1e-9);
      expect(left, window).toBeLessThan(stickMan.feet.x - 1);
      expect(metresAcross, window).toBeGreaterThanOrEqual(metresAcrossAtRest);
      expect(metresAcross, window).toBeLessThanOrEqual(Math.max(metresAcrossAtRest, FRAMING.mostMetresAcross));
    }
  });

  it('is at an edge only on the floor, near the end of his line, facing it, with floor further on', () => {
    const atRest = { ahead: 0, metresAcross: 12 };
    const near = GAP.from - FRAMING.nearAnEdge + 0.1;
    expect(getFramingWanted({ stickMan: makeStickManStandingAt(near), floor: LEVEL_3, metresAcrossAtRest: 12 }).ahead).toBeGreaterThan(0);
    expect(getFramingWanted({ stickMan: makeStickManStandingAt(GAP.from - FRAMING.nearAnEdge - 0.1), floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual(atRest);
    expect(getFramingWanted({ stickMan: { ...makeStickManStandingAt(near), facing: -1 }, floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual(atRest);
    expect(getFramingWanted({ stickMan: { ...makeStickManStandingAt(near), action: 'jumping' }, floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual(atRest);
    // The end of the paper is not an edge to look over: nothing is further on.
    const endOfThePaper = LEVEL_3[LEVEL_3.length - 1]!.to.x;
    expect(getFramingWanted({ stickMan: makeStickManStandingAt(endOfThePaper - 0.5), floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual(atRest);
    expect(getFramingWanted({ stickMan: { ...makeStickManStandingAt(0.5), facing: -1 }, floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual(atRest);
  });

  it('looks back across the gap from the far side, facing it', () => {
    const { ahead, metresAcross } = getFramingWanted({ stickMan: { ...makeStickManStandingAt(GAP.to + 1), facing: -1 }, floor: LEVEL_3, metresAcrossAtRest: 12 });
    expect(ahead).toBeLessThan(0);
    expect(GAP.to + 1 + ahead - metresAcross / 2).toBeLessThanOrEqual(GAP.from - FRAMING.ofTheNextLine + 1e-9);
  });

  it('looks ahead while he carries the airplane and while he is seated in it, wherever he is', () => {
    const carrying = getFramingWanted({ stickMan: { ...makeStickManStandingAt(4), carrying: true }, floor: LEVEL_3, metresAcrossAtRest: 12 });
    expect(carrying.ahead).toBeGreaterThan(0);
    // The far side is too far to show from here: the view is pulled back as far as it goes, and no further.
    expect(carrying.metresAcross).toBe(FRAMING.mostMetresAcross);

    const overTheGap = { ...makeStickManStandingAt(14), feet: { x: 14, y: -2 }, action: 'seated' as const };
    const flying = getFramingWanted({ stickMan: overTheGap, floor: LEVEL_3, metresAcrossAtRest: 12 });
    expect(14 + flying.ahead + flying.metresAcross / 2).toBeGreaterThanOrEqual(GAP.to + FRAMING.ofTheNextLine - 1e-9);

    // Over the far side there is no next line: he is still shown where he is going, at the width the view has at rest.
    const overTheFarSide = { ...overTheGap, feet: { x: GAP.to + 2, y: -1 } };
    expect(getFramingWanted({ stickMan: overTheFarSide, floor: LEVEL_3, metresAcrossAtRest: 12 })).toEqual({ ahead: (0.5 - FRAMING.fromTheSideBehindHim) * 12, metresAcross: 12 });
  });

  it("looks over level 2's gap without pulling back: the far side is in view already", () => {
    const { floor } = getLevelById(2);
    const framing = getFramingWanted({ stickMan: makeStickManStandingAt(floor[0]!.to.x - 1), floor, metresAcrossAtRest: 12 });
    expect(framing.metresAcross).toBe(12);
    expect(framing.ahead).toBeGreaterThan(0);
  });
});

describe('easeTowards', () => {
  it('gets closer every frame, never past where it is wanted, and is most of the way there after the easing time', () => {
    const from = { ahead: 0, metresAcross: 12 };
    const to = { ahead: 4, metresAcross: 18 };
    expect(easeTowards(from, to, 0)).toEqual(from);
    let framing = from;
    for (let frame = 0; frame < 60 * FRAMING.easeSeconds; frame += 1) {
      const next = easeTowards(framing, to, 1 / 60);
      expect(next.ahead).toBeGreaterThan(framing.ahead);
      expect(next.metresAcross).toBeGreaterThan(framing.metresAcross);
      framing = next;
    }
    expect(framing.ahead).toBeGreaterThan(0.6 * to.ahead);
    expect(framing.ahead).toBeLessThan(to.ahead);
    expect(framing.metresAcross).toBeLessThan(to.metresAcross);
    // One long frame gets no further than many short ones.
    expect(easeTowards(from, to, 1000).ahead).toBeCloseTo(to.ahead, 9);
  });
});

describe('keepUpWith', () => {
  it('is where his feet are at anything he does: walking, falling, and the airplane at its fastest', () => {
    for (const metresPerSecond of [2.2, 7.5, 11]) {
      const feetX = 10 + metresPerSecond / 60;
      expect(keepUpWith({ followedX: 10, feetX, seconds: 1 / 60 })).toBe(feetX);
      expect(keepUpWith({ followedX: 10, feetX: 20 - feetX, seconds: 1 / 60 })).toBe(20 - feetX);
    }
  });

  it('takes a hop of his within one tick over a few frames, and ends exactly on him', () => {
    let followedX = 9;
    const frames = [];
    for (let frame = 0; frame < 10 && followedX !== 9.9; frame += 1) {
      followedX = keepUpWith({ followedX, feetX: 9.9, seconds: 1 / 60 });
      frames.push(followedX);
    }
    expect(frames.length).toBeGreaterThan(2);
    expect(frames.length).toBeLessThan(6);
    expect(frames[0]! - 9).toBeCloseTo(FRAMING.fastestFollow / 60, 9);
    expect(followedX).toBe(9.9);
  });
});

// ---- Helpers ----

const { FRAMING, getFramingWanted, easeTowards, keepUpWith } = __testing__;
const LEVEL_3: readonly FloorSegment[] = getLevelById(3).floor;
const GAP = { from: LEVEL_3[0]!.to.x, to: LEVEL_3[1]!.from.x };

/** How much of the level each window of the verification shows across at rest, in metres. */
const WINDOWS: readonly (readonly [string, number])[] = [
  ['a wide window', 19.2],
  ['a narrow window', 12],
  ['a portrait window', 12],
  ['a very wide window', 30],
];

function makeStickManStandingAt(x: number): Followed {
  return { feet: { x, y: 0 }, facing: 1, action: 'standing', carrying: false };
}

import type { AirplaneView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { airplanesEasedOverTime, airplaneStrokes, type ShownAirplane } from './airplane';
import { PIXELS_PER_METRE } from './units';

describe('airplaneStrokes', () => {
  it('draws it within its length and height, standing on its underside, nose the way it faces', () => {
    for (const facing of [1, -1] as const) {
      const points = airplaneStrokes({ ...ON_THE_FLOOR, facing }).flatMap((stroke) => stroke.points);
      const xs = points.map((point) => point.x / PIXELS_PER_METRE);
      const ys = points.map((point) => point.y / PIXELS_PER_METRE);
      expect(Math.min(...xs)).toBeCloseTo(ON_THE_FLOOR.at.x - ON_THE_FLOOR.length / 2, 9);
      expect(Math.max(...xs)).toBeCloseTo(ON_THE_FLOOR.at.x + ON_THE_FLOOR.length / 2, 9);
      expect(Math.max(...ys)).toBeCloseTo(ON_THE_FLOOR.at.y, 9);
      expect(Math.min(...ys)).toBeCloseTo(ON_THE_FLOOR.at.y - ON_THE_FLOOR.height, 9);
      // The tail is the tall end: the highest point is behind the middle.
      const highest = points.reduce((top, point) => (point.y < top.y ? point : top));
      expect((highest.x / PIXELS_PER_METRE - ON_THE_FLOOR.at.x) * facing).toBeLessThan(0);
    }
  });

  it('points its nose down as it falls', () => {
    const noseOf = (shown: ShownAirplane) => airplaneStrokes(shown)[0]!.points[0]!;
    expect(noseOf({ ...ON_THE_FLOOR, noseDown: 0.8 }).y).toBeGreaterThan(noseOf(ON_THE_FLOOR).y);
    expect(noseOf({ ...ON_THE_FLOOR, facing: -1, noseDown: 0.8 }).y).toBeGreaterThan(noseOf({ ...ON_THE_FLOOR, facing: -1 }).y);
  });
});

describe('airplanesEasedOverTime', () => {
  it('shows it where the sim has it the first time it is seen, and nothing when there is none', () => {
    const shownFor = airplanesEasedOverTime();
    expect(shownFor(undefined, FRAME)).toBeUndefined();
    expect(shownFor(RESTING, FRAME)).toEqual({ at: RESTING.at, facing: 1, length: RESTING.length, height: RESTING.height, noseDown: 0 });
  });

  it('takes a moment to get from the floor to over his head, and then is exactly there', () => {
    const shownFor = airplanesEasedOverTime();
    shownFor(RESTING, FRAME);
    const first = shownFor(CARRIED, FRAME)!;
    expect(first.at.y).toBeLessThan(RESTING.at.y);
    expect(first.at.y).toBeGreaterThan(CARRIED.at.y);
    let frames = 1;
    while (shownFor(CARRIED, FRAME)!.at.y !== CARRIED.at.y && frames < 600) frames += 1;
    expect(frames * FRAME).toBeGreaterThan(0.1);
    expect(frames * FRAME).toBeLessThan(0.6);
    expect(shownFor(CARRIED, FRAME)!.at).toEqual(CARRIED.at);
  });

  it('keeps up with him as he walks with it: once over his head it stays there', () => {
    const shownFor = airplanesEasedOverTime();
    shownFor(CARRIED, FRAME);
    for (let frame = 1; frame <= 30; frame += 1) {
      const at = { x: CARRIED.at.x + frame * WALK_SPEED * FRAME, y: CARRIED.at.y };
      expect(shownFor({ ...CARRIED, at }, FRAME)!.at).toEqual(at);
    }
  });

  it('starts afresh after it was gone: a new airplane does not slide in from where the last one was', () => {
    const shownFor = airplanesEasedOverTime();
    shownFor(RESTING, FRAME);
    shownFor(undefined, FRAME);
    const elsewhere = { ...RESTING, at: { x: 40, y: 0 } };
    expect(shownFor(elsewhere, FRAME)!.at).toEqual(elsewhere.at);
  });
});

// ---- Helpers ----

const FRAME = 1 / 60;
const WALK_SPEED = 2.2;
const ON_THE_FLOOR: ShownAirplane = { at: { x: 5, y: 0 }, facing: 1, length: 1.4, height: 0.34, noseDown: 0 };
const RESTING: AirplaneView = { at: { x: 5, y: 0 }, facing: 1, length: 1.4, height: 0.34, state: 'resting', verticalSpeed: 0, onAnEdge: false };
const CARRIED: AirplaneView = { ...RESTING, at: { x: 4.1, y: -1.82 }, state: 'carried' };

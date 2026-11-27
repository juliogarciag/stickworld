import type { AirplaneView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { easeAirplanesOverTime, buildAirplaneStrokes, type ShownAirplane } from './airplane';
import { PIXELS_PER_METRE } from './units';

describe('buildAirplaneStrokes', () => {
  it('draws it within its length and height, standing on its underside, nose the way it faces', () => {
    for (const facing of [1, -1] as const) {
      const points = buildAirplaneStrokes({ ...ON_FLOOR, facing }).flatMap((stroke) => stroke.points);
      const xs = points.map((point) => point.x / PIXELS_PER_METRE);
      const ys = points.map((point) => point.y / PIXELS_PER_METRE);
      expect(Math.min(...xs)).toBeCloseTo(ON_FLOOR.position.x - ON_FLOOR.length / 2, 9);
      expect(Math.max(...xs)).toBeCloseTo(ON_FLOOR.position.x + ON_FLOOR.length / 2, 9);
      expect(Math.max(...ys)).toBeCloseTo(ON_FLOOR.position.y, 9);
      expect(Math.min(...ys)).toBeCloseTo(ON_FLOOR.position.y - ON_FLOOR.height, 9);
      // The tail is the tall end: the highest point is behind the middle.
      const highest = points.reduce((top, point) => (point.y < top.y ? point : top));
      expect((highest.x / PIXELS_PER_METRE - ON_FLOOR.position.x) * facing).toBeLessThan(0);
    }
  });

  it('points its nose down as it falls', () => {
    const getNose = (shown: ShownAirplane) => buildAirplaneStrokes(shown)[0]!.points[0]!;
    expect(getNose({ ...ON_FLOOR, noseDown: 0.8 }).y).toBeGreaterThan(getNose(ON_FLOOR).y);
    expect(getNose({ ...ON_FLOOR, facing: -1, noseDown: 0.8 }).y).toBeGreaterThan(getNose({ ...ON_FLOOR, facing: -1 }).y);
  });
});

describe('easeAirplanesOverTime', () => {
  it('shows it where the sim has it the first time it is seen, and nothing when there is none', () => {
    const shownFor = easeAirplanesOverTime();
    expect(shownFor(undefined, FRAME)).toBeUndefined();
    expect(shownFor(RESTING, FRAME)).toEqual({ position: RESTING.position, facing: 1, length: RESTING.length, height: RESTING.height, noseDown: 0 });
  });

  it('takes a moment to get from the floor to over his head, and then is exactly there', () => {
    const shownFor = easeAirplanesOverTime();
    shownFor(RESTING, FRAME);
    const first = shownFor(CARRIED, FRAME)!;
    expect(first.position.y).toBeLessThan(RESTING.position.y);
    expect(first.position.y).toBeGreaterThan(CARRIED.position.y);
    let frames = 1;
    while (shownFor(CARRIED, FRAME)!.position.y !== CARRIED.position.y && frames < 600) frames += 1;
    expect(frames * FRAME).toBeGreaterThan(0.1);
    expect(frames * FRAME).toBeLessThan(0.6);
    expect(shownFor(CARRIED, FRAME)!.position).toEqual(CARRIED.position);
  });

  it('keeps up with him as he walks with it: once over his head it stays there', () => {
    const shownFor = easeAirplanesOverTime();
    shownFor(CARRIED, FRAME);
    for (let frame = 1; frame <= 30; frame += 1) {
      const position = { x: CARRIED.position.x + frame * WALK_SPEED * FRAME, y: CARRIED.position.y };
      expect(shownFor({ ...CARRIED, position }, FRAME)!.position).toEqual(position);
    }
  });

  it('is exactly where the sim has it while it flies, however fast, with its nose where the sim points it', () => {
    const shownFor = easeAirplanesOverTime();
    shownFor(RESTING, FRAME);
    let flying = FLYING;
    // The first frames turn its nose from level to where the sim points it; from then on it is exact.
    for (let frame = 0; frame < 10; frame += 1) expect(shownFor(flying, FRAME)!.position).toEqual(flying.position);
    for (let frame = 0; frame < 30; frame += 1) {
      flying = { ...flying, position: { x: flying.position.x + 11 * FRAME, y: flying.position.y - 2 * FRAME }, pitch: flying.pitch - 1.7 * FRAME };
      const shown = shownFor(flying, FRAME)!;
      expect(shown.position).toEqual(flying.position);
      expect(shown.noseDown).toBeCloseTo(-flying.pitch, 9);
    }
  });

  it('turns its nose over a moment when the sim turns it at once: a stall does not snap it down', () => {
    const shownFor = easeAirplanesOverTime();
    shownFor(FLYING, FRAME);
    expect(shownFor(FLYING, FRAME)!.noseDown).toBe(-FLYING.pitch);
    const stalled: AirplaneView = { ...FLYING, state: 'falling', pitch: 0, verticalSpeed: 4, speed: 2 };
    const first = shownFor(stalled, FRAME)!.noseDown;
    expect(first).toBeGreaterThan(-FLYING.pitch);
    expect(first).toBeLessThan(0);
    let last = first;
    for (let frame = 0; frame < 60; frame += 1) last = shownFor(stalled, FRAME)!.noseDown;
    expect(last).toBeGreaterThan(0.5);
  });

  it('keeps up with an airplane that falls fast, drifting on sideways', () => {
    const shownFor = easeAirplanesOverTime();
    let falling: AirplaneView = { ...FLYING, state: 'falling', pitch: 0, verticalSpeed: 9, speed: 6 };
    shownFor(falling, FRAME);
    for (let frame = 0; frame < 30; frame += 1) {
      falling = { ...falling, position: { x: falling.position.x + falling.speed * FRAME, y: falling.position.y + falling.verticalSpeed * FRAME } };
      expect(shownFor(falling, FRAME)!.position).toEqual(falling.position);
    }
  });

  it('starts afresh after it was gone: a new airplane does not slide in from where the last one was', () => {
    const shownFor = easeAirplanesOverTime();
    shownFor(RESTING, FRAME);
    shownFor(undefined, FRAME);
    const elsewhere = { ...RESTING, position: { x: 40, y: 0 } };
    expect(shownFor(elsewhere, FRAME)!.position).toEqual(elsewhere.position);
  });
});

// ---- Helpers ----

const FRAME = 1 / 60;
const WALK_SPEED = 2.2;
const ON_FLOOR: ShownAirplane = { position: { x: 5, y: 0 }, facing: 1, length: 1.4, height: 0.34, noseDown: 0 };
const RESTING: AirplaneView = { position: { x: 5, y: 0 }, facing: 1, length: 1.4, height: 0.34, state: 'resting', verticalSpeed: 0, speed: 0, pitch: 0, stallSpeed: 3, isOnEdge: false };
const FLYING: AirplaneView = { ...RESTING, position: { x: 12, y: -1.5 }, state: 'flying', speed: 7, pitch: 0.4 };
const CARRIED: AirplaneView = { ...RESTING, position: { x: 4.1, y: -1.82 }, state: 'carried' };

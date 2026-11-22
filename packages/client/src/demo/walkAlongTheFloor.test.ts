import { levelById } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { walkCycleLength } from '../render/stickMan';
import { walkAlongTheFloor } from './walkAlongTheFloor';

describe('the look test walk', () => {
  it('starts where the level starts, walking right by himself', () => {
    const demo = walkAlongTheFloor(LEVEL);
    expect(demo.pose()).toMatchObject({ feet: LEVEL.start, facing: 1, action: 'walking' });
    expect(demo.walkFor(0.5, 0).feet.x).toBeGreaterThan(LEVEL.start.x);
  });

  it('paces between the ends of the floor without ever leaving it', () => {
    const demo = walkAlongTheFloor(LEVEL);
    const facings = new Set<number>();
    for (let frame = 0; frame < 60 * 30; frame += 1) {
      const pose = demo.walkFor(1 / 60, 0);
      facings.add(pose.facing);
      expect(pose.feet.x).toBeGreaterThan(FLOOR_START);
      expect(pose.feet.x).toBeLessThan(FLOOR_END);
    }
    expect(facings).toEqual(new Set([1, -1]));
  });

  it('advances the walk cycle with the distance walked', () => {
    const demo = walkAlongTheFloor(LEVEL);
    const before = demo.pose();
    const after = demo.walkFor(0.2, 0);
    expect(after.walkCycle).toBeCloseTo((after.feet.x - before.feet.x) / walkCycleLength(), 6);
  });

  it('follows the arrow keys once one is pressed, and stands when none is held', () => {
    const demo = walkAlongTheFloor(LEVEL);
    demo.walkFor(1, 0);
    const turned = demo.walkFor(0.5, -1);
    expect(turned.facing).toBe(-1);
    expect(turned.action).toBe('walking');
    const walkedLeft = demo.walkFor(0.5, -1);
    expect(walkedLeft.feet.x).toBeLessThan(turned.feet.x);
    const stopped = demo.walkFor(0.5, 0);
    expect(stopped).toMatchObject({ action: 'standing', facing: -1, feet: walkedLeft.feet });
    expect(demo.walkFor(5, 0).feet).toEqual(walkedLeft.feet);
    expect(demo.walkFor(0.5, 1)).toMatchObject({ action: 'walking', facing: 1 });
  });

  it('stops at the end of the floor however long a key is held', () => {
    const demo = walkAlongTheFloor(LEVEL);
    expect(demo.walkFor(600, 1).feet.x).toBeLessThan(FLOOR_END);
    expect(demo.walkFor(600, -1).feet.x).toBeGreaterThan(FLOOR_START);
  });

  it('holds still while paused', () => {
    const demo = walkAlongTheFloor(LEVEL);
    demo.setPaused(true);
    expect(demo.walkFor(3, 1)).toEqual(demo.pose());
    expect(demo.pose().feet).toEqual(LEVEL.start);
    demo.setPaused(false);
    expect(demo.walkFor(1, 0).feet.x).toBeGreaterThan(LEVEL.start.x);
  });
});

// ---- Helpers ----

const LEVEL = levelById(1);
const FLOOR_START = LEVEL.floor[0]!.from.x;
const FLOOR_END = LEVEL.floor[LEVEL.floor.length - 1]!.to.x;

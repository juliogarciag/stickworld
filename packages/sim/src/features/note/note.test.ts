import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { level1 } from '../../content/levels/level1';
import { level2 } from '../../content/levels/level2';
import { TICK_RATE } from '../../content/tuning';
import { Sim } from '../../core/sim';
import { features } from '..';
import { findFlagPlacedIn } from '../flag';
import { getFloorHeightAt } from '../player/floor';
import { getStickMan } from '../player/view';
import { getNotes } from './view';

describe('the notes of a level', () => {
  it('are there when the level starts, as its data has them', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    expect(getNotes(sim)).toEqual(level1.notes!.map((note) => ({ ...note, rubbedOutFor: null })));
    expect(getNotes(new Sim({ features, start: { seed: 1, level: 3 } }))).toEqual([]);
  });

  it('about walking is rubbed out once the stick man has walked past where it says, and not by standing, jumping on the spot or walking away from it', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    const getWalkNote = (): ReturnType<typeof getNotes>[number] =>
      getNotes(sim).find((note) => note.topic === 'walking')!;
    for (let tick = 0; tick < TICK_RATE; tick += 1) {
      sim.step(tick === 5 ? [{ type: 'player/jump' }] : []);
    }
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < TICK_RATE / 2; tick += 1) {
      sim.step();
    }
    expect(getWalkNote().rubbedOutFor).toBeNull();

    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 10 * TICK_RATE && getWalkNote().rubbedOutFor === null; tick += 1) {
      sim.step();
    }
    expect(getStickMan(sim).feet.x).toBeGreaterThan(getWalkNote().rubbedOutPast!);
    expect(getStickMan(sim).feet.x).toBeLessThan(getWalkNote().rubbedOutPast! + 0.1);
    // It stays rubbed out when the stick man walks back, and how long ago it was goes on counting.
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < TICK_RATE; tick += 1) {
      sim.step();
    }
    expect(getWalkNote().rubbedOutFor).toBeCloseTo((TICK_RATE + 2) / TICK_RATE, 9);
    // The game's name has nothing to be done: it stays.
    expect(getNotes(sim).find((note) => note.isTitle)!.rubbedOutFor).toBeNull();
  });

  it('about jumping is still there while the stick man is over the gap, is rubbed out when the stick man lands past it, and is there again after a fall into it', () => {
    const getJumpNote = (sim: Sim): ReturnType<typeof getNotes>[number] =>
      getNotes(sim).find((note) => note.topic === 'jumping')!;
    const gap = { start: level2.floor[0]!.end.x, end: level2.floor[1]!.start.x };

    const jumping = new Sim({ features, start: { seed: 1, level: 2 } });
    jumping.step([{ type: 'player/walk', direction: 1 }]);
    let hasSeenPlayerOverGap = false;
    for (
      let tick = 0;
      tick < 10 * TICK_RATE && getJumpNote(jumping).rubbedOutFor === null;
      tick += 1
    ) {
      const { x } = getStickMan(jumping).feet;
      const isJustBeforeGap = x < gap.start && x > gap.start - 0.25;
      jumping.step(isJustBeforeGap ? [{ type: 'player/jump' }] : []);
      const feet = getStickMan(jumping).feet;
      const isOverGap = feet.x > gap.start && feet.x < gap.end;
      if (isOverGap) {
        hasSeenPlayerOverGap = true;
        expect(getJumpNote(jumping).rubbedOutFor).toBeNull();
      }
    }
    expect(hasSeenPlayerOverGap).toBe(true);
    expect(getStickMan(jumping)).toMatchObject({ action: 'walking', feet: { y: 0 } });
    expect(getStickMan(jumping).feet.x).toBeGreaterThan(gap.end);

    // The stick man walks back into the gap: the level starts again, and the note the stick man had
    // done is there again.
    jumping.step([{ type: 'player/walk', direction: -1 }]);
    for (
      let tick = 0;
      tick < 10 * TICK_RATE && getJumpNote(jumping).rubbedOutFor !== null;
      tick += 1
    ) {
      jumping.step();
    }
    expect(getJumpNote(jumping).rubbedOutFor).toBeNull();
    expect(getStickMan(jumping).feet.x).toBeLessThan(gap.start);

    // And one that was never rubbed out stays through a fall.
    const falling = new Sim({ features, start: { seed: 1, level: 2 } });
    falling.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      falling.step();
      expect(getJumpNote(falling).rubbedOutFor).toBeNull();
    }
  });

  it('are in the snapshot: a restored level has the same ones rubbed out', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 3 * TICK_RATE; tick += 1) {
      sim.step();
    }
    expect(getNotes(new Sim({ features, snapshot: sim.takeSnapshot() }))).toEqual(getNotes(sim));
    expect(getNotes(sim).some((note) => note.rubbedOutFor !== null)).toBe(true);
  });
});

describe('every note', () => {
  const notes = levels.flatMap((level) =>
    (level.notes ?? []).map((note) => [`level ${level.id}: ${note.words}`, note, level] as const),
  );

  it.each(notes)('%s says something without naming a key', (_, note) => {
    expect(note.words.trim().length).toBeGreaterThan(0);
    expect(note.words).not.toMatch(/\b(key|press|arrow|space|enter|[b-z])\b|[←→↑↓]/i);
  });

  it.each(notes)(
    "%s is written above the floor, clear of the stick man's head, and what rubs it out can be done before the flag",
    (_, note, level) => {
      expect(getFloorHeightAt(level.floor, note.position.x)).toBeDefined();
      expect(note.position.y).toBeLessThan(-2);
      if (note.rubbedOutPast === undefined) {
        return;
      }
      expect(note.topic).toBeDefined();
      expect(note.rubbedOutPast).toBeGreaterThan(level.start.x);
      expect(note.rubbedOutPast).toBeLessThan(findFlagPlacedIn(level)!.position.x);
      expect(getFloorHeightAt(level.floor, note.rubbedOutPast + 0.01)).toBeDefined();
    },
  );
});

import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { level1 } from '../../content/levels/level1';
import { level2 } from '../../content/levels/level2';
import { TICK_RATE } from '../../content/tuning';
import { Sim } from '../../core/sim';
import { features } from '..';
import { flagPlacedIn } from '../flag';
import { floorHeightAt } from '../player/floor';
import { stickManOf } from '../player/view';
import { notesOf } from './view';

describe('the notes of a level', () => {
  it('are there when the level starts, as its data has them', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    expect(notesOf(sim)).toEqual(level1.notes!.map((note) => ({ ...note, rubbedOutFor: null })));
    expect(notesOf(new Sim({ features, start: { seed: 1, level: 3 } }))).toEqual([]);
  });

  it('about walking is rubbed out once he has walked past where it says, and not by standing, jumping on the spot or walking away from it', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    const walkNote = (): ReturnType<typeof notesOf>[number] => notesOf(sim).find((note) => note.about === 'walking')!;
    for (let tick = 0; tick < TICK_RATE; tick += 1) sim.step(tick === 5 ? [{ type: 'player/jump' }] : []);
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < TICK_RATE / 2; tick += 1) sim.step();
    expect(walkNote().rubbedOutFor).toBeNull();

    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 10 * TICK_RATE && walkNote().rubbedOutFor === null; tick += 1) sim.step();
    expect(stickManOf(sim).feet.x).toBeGreaterThan(walkNote().rubbedOutPast!);
    expect(stickManOf(sim).feet.x).toBeLessThan(walkNote().rubbedOutPast! + 0.1);
    // It stays rubbed out when he walks back, and how long ago it was goes on counting.
    sim.step([{ type: 'player/walk', direction: -1 }]);
    for (let tick = 0; tick < TICK_RATE; tick += 1) sim.step();
    expect(walkNote().rubbedOutFor).toBeCloseTo((TICK_RATE + 2) / TICK_RATE, 9);
    // The game's name has nothing to be done: it stays.
    expect(notesOf(sim).find((note) => note.large)!.rubbedOutFor).toBeNull();
  });

  it('about jumping is still there while he is over the gap, is rubbed out when he lands past it, and is there again after a fall into it', () => {
    const jumpNote = (sim: Sim): ReturnType<typeof notesOf>[number] => notesOf(sim).find((note) => note.about === 'jumping')!;
    const gap = { from: level2.floor[0]!.to.x, to: level2.floor[1]!.from.x };

    const jumping = new Sim({ features, start: { seed: 1, level: 2 } });
    jumping.step([{ type: 'player/walk', direction: 1 }]);
    let sawHimOverTheGap = false;
    for (let tick = 0; tick < 10 * TICK_RATE && jumpNote(jumping).rubbedOutFor === null; tick += 1) {
      const { x } = stickManOf(jumping).feet;
      jumping.step(x < gap.from && x > gap.from - 0.25 ? [{ type: 'player/jump' }] : []);
      const feet = stickManOf(jumping).feet;
      if (feet.x > gap.from && feet.x < gap.to) {
        sawHimOverTheGap = true;
        expect(jumpNote(jumping).rubbedOutFor).toBeNull();
      }
    }
    expect(sawHimOverTheGap).toBe(true);
    expect(stickManOf(jumping)).toMatchObject({ action: 'walking', feet: { y: 0 } });
    expect(stickManOf(jumping).feet.x).toBeGreaterThan(gap.to);

    const falling = new Sim({ features, start: { seed: 1, level: 2 } });
    falling.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 10 * TICK_RATE; tick += 1) {
      falling.step();
      expect(jumpNote(falling).rubbedOutFor).toBeNull();
    }
  });

  it('are in the snapshot: a restored level has the same ones rubbed out', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 3 * TICK_RATE; tick += 1) sim.step();
    expect(notesOf(new Sim({ features, snapshot: sim.snapshot() }))).toEqual(notesOf(sim));
    expect(notesOf(sim).some((note) => note.rubbedOutFor !== null)).toBe(true);
  });
});

describe('every note', () => {
  const notes = levels.flatMap((level) => (level.notes ?? []).map((note) => [`level ${level.id}: ${note.words}`, note, level] as const));

  it.each(notes)('%s says something without naming a key', (_, note) => {
    expect(note.words.trim().length).toBeGreaterThan(0);
    expect(note.words).not.toMatch(/\b(key|press|arrow|space|enter|[a-z])\b|[←→↑↓]/i);
  });

  it.each(notes)('%s is written above the floor, clear of his head, and what rubs it out can be done before the flag', (_, note, level) => {
    expect(floorHeightAt(level.floor, note.at.x)).toBeDefined();
    expect(note.at.y).toBeLessThan(-2);
    if (note.rubbedOutPast === undefined) return;
    expect(note.about).toBeDefined();
    expect(note.rubbedOutPast).toBeGreaterThan(level.start.x);
    expect(note.rubbedOutPast).toBeLessThan(flagPlacedIn(level)!.at.x);
    expect(floorHeightAt(level.floor, note.rubbedOutPast + 0.01)).toBeDefined();
  });
});

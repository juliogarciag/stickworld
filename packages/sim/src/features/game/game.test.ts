import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { TICK_RATE } from '../../content/tuning';
import { Sim } from '../../core/sim';
import { features } from '..';
import { craftingOf } from '../crafting/view';
import { teachRecipe } from '../crafting';
import { PAPER_AIRPLANE_RECIPE_ID } from '../crafting/defs';
import { flagPlacedIn } from '../flag';
import { flagDef, LEVEL_END } from '../flag/defs';
import { flagOf } from '../flag/view';
import { PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { itemSlotsOf } from '../inventory/view';
import { stickManOf } from '../player/view';
import { gameOf } from './view';

describe('the game', () => {
  it('is not over on any level until its last flag is reached', () => {
    for (const level of levels) expect(gameOf(new Sim({ features, start: { seed: 1, level: level.id } }))).toEqual({ over: false, playingAgainOffered: false });
    const finishedTheFirst = atTheFlagOf(levels[0]!.id);
    expect(flagOf(finishedTheFirst)!.reached).toBe(true);
    expect(gameOf(finishedTheFirst)).toEqual({ over: false, playingAgainOffered: false });
  });

  it('is over the moment the last flag is reached, and offers playing again a little later, once the flag is long up', () => {
    const sim = atTheFlagOf(LAST_LEVEL.id);
    expect(gameOf(sim)).toEqual({ over: true, playingAgainOffered: false });
    for (let tick = 0; tick < OFFERED_AFTER_TICKS - 2; tick += 1) sim.step();
    expect(gameOf(sim)).toEqual({ over: true, playingAgainOffered: false });
    sim.step();
    sim.step();
    expect(gameOf(sim)).toEqual({ over: true, playingAgainOffered: true });
    expect(flagOf(sim)).toMatchObject({ raised: 1 });
    expect(flagOf(sim)!.upFor).toBeCloseTo(LEVEL_END.playAgainAfter - flagDef.raiseSeconds, 1);
  });
});

describe("'game/playAgain'", () => {
  it('does nothing while the game is not over, nor in the moment after the last flag', () => {
    const playing = new Sim({ features, start: { seed: 1, level: 2 } });
    const before = playing.snapshot();
    playing.step([{ type: 'game/playAgain' }]);
    expect(playing.snapshot()).toEqual({ ...before, tick: before.tick + 1 });

    const justOver = atTheFlagOf(LAST_LEVEL.id);
    justOver.step([{ type: 'game/playAgain' }]);
    expect(justOver.level).toBe(LAST_LEVEL.id);
    expect(gameOf(justOver).over).toBe(true);
  });

  it('starts the first level with nothing kept once it is offered: no item, nothing learned, the seed and the tick count going on', () => {
    const sim = atTheFlagOf(LAST_LEVEL.id);
    giveItem(sim, PAPER_ITEM_ID);
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    for (let tick = 0; tick < OFFERED_AFTER_TICKS; tick += 1) sim.step();
    const tick = sim.tick;
    sim.step([{ type: 'game/playAgain' }]);
    expect(sim.level).toBe(levels[0]!.id);
    expect(sim.tick).toBe(tick + 1);
    expect(sim.seed).toBe(1);
    expect(stickManOf(sim)).toMatchObject({ feet: levels[0]!.start, action: 'standing' });
    expect(itemSlotsOf(sim)).toEqual([{ slot: 1, itemDefId: null, selected: false }]);
    expect(craftingOf(sim).knownRecipes).toEqual([]);
    expect(gameOf(sim)).toEqual({ over: false, playingAgainOffered: false });
    // A second one right after it is heard by a game that is not over.
    sim.step([{ type: 'game/playAgain' }]);
    expect(sim.level).toBe(levels[0]!.id);
  });

  it('is in the snapshot: a game restored after the end is played again the same way', () => {
    const sim = atTheFlagOf(LAST_LEVEL.id);
    for (let tick = 0; tick < OFFERED_AFTER_TICKS; tick += 1) sim.step();
    const restored = new Sim({ features, snapshot: sim.snapshot() });
    for (const each of [sim, restored]) each.step([{ type: 'game/playAgain' }]);
    expect(restored.snapshot()).toEqual(sim.snapshot());
    expect(restored.level).toBe(levels[0]!.id);
  });
});

// ---- Helpers ----

const LAST_LEVEL = levels[levels.length - 1]!;
const OFFERED_AFTER_TICKS = Math.round(LEVEL_END.playAgainAfter * TICK_RATE);

/** A sim on `level` restored with him standing at its flag, stepped once so the flag is reached. */
function atTheFlagOf(level: number): Sim {
  const fresh = new Sim({ features, start: { seed: 1, level } });
  const flagAt = flagPlacedIn(fresh.levelDef)!.at;
  const snapshot = fresh.snapshot();
  const sim = new Sim({ features, snapshot: { ...snapshot, slices: { ...snapshot.slices, player: { ...(snapshot.slices.player as object), x: flagAt.x, y: flagAt.y } } } });
  sim.step();
  expect(flagOf(sim)!.reached).toBe(true);
  return sim;
}

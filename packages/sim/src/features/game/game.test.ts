import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import { TICK_RATE } from '../../content/tuning';
import { Sim } from '../../core/sim';
import { features } from '..';
import { getCrafting } from '../crafting/view';
import { teachRecipe } from '../crafting';
import { PAPER_AIRPLANE_RECIPE_ID } from '../crafting/defs';
import { findFlagPlacedIn } from '../flag';
import { flagDef } from '../flag/defs';
import { getFlag } from '../flag/view';
import { PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getStickMan } from '../player/view';
import { GAME_END } from './defs';
import { getGame } from './view';

describe('the game', () => {
  it('is not over on any level until its last flag is reached', () => {
    for (const level of levels) {
      expect(getGame(new Sim({ features, start: { seed: 1, level: level.id } }))).toEqual({
        isOver: false,
        isPlayAgainOffered: false,
      });
    }
    const finishedFirst = createSimAtFlagOf(levels[0]!.id);
    expect(getFlag(finishedFirst)!.isReached).toBe(true);
    expect(getGame(finishedFirst)).toEqual({ isOver: false, isPlayAgainOffered: false });
  });

  it('is over the moment the last flag is reached, and offers playing again a little later, once the flag is long up', () => {
    const sim = createSimAtFlagOf(LAST_LEVEL.id);
    expect(getGame(sim)).toEqual({ isOver: true, isPlayAgainOffered: false });
    // The flag was reached on the tick before this one: one tick of the wait has passed.
    for (let tick = 1; tick < OFFERED_AFTER_TICKS - 1; tick += 1) {
      sim.step();
    }
    expect(getGame(sim)).toEqual({ isOver: true, isPlayAgainOffered: false });
    sim.step();
    expect(getGame(sim)).toEqual({ isOver: true, isPlayAgainOffered: true });
    expect(getFlag(sim)).toMatchObject({ raised: 1 });
    expect(getFlag(sim)!.upFor).toBeCloseTo(GAME_END.playAgainAfter - flagDef.raiseSeconds, 1);
  });
});

describe("'game/playAgain'", () => {
  it('does nothing while the game is not over, nor in the moment after the last flag', () => {
    const playing = new Sim({ features, start: { seed: 1, level: 2 } });
    const before = playing.takeSnapshot();
    playing.step([{ type: 'game/playAgain' }]);
    expect(playing.takeSnapshot()).toEqual({ ...before, tick: before.tick + 1 });

    const justOver = createSimAtFlagOf(LAST_LEVEL.id);
    justOver.step([{ type: 'game/playAgain' }]);
    expect(justOver.level).toBe(LAST_LEVEL.id);
    expect(getGame(justOver).isOver).toBe(true);
  });

  it('starts the first level with nothing kept once it is offered: no item, nothing learned, the seed and the tick count going on', () => {
    const sim = createSimAtFlagOf(LAST_LEVEL.id);
    giveItem(sim, PAPER_ITEM_ID);
    teachRecipe(sim, PAPER_AIRPLANE_RECIPE_ID);
    for (let tick = 0; tick < OFFERED_AFTER_TICKS; tick += 1) {
      sim.step();
    }
    const tick = sim.tick;
    sim.step([{ type: 'game/playAgain' }]);
    expect(sim.level).toBe(levels[0]!.id);
    expect(sim.tick).toBe(tick + 1);
    expect(sim.seed).toBe(1);
    expect(getStickMan(sim)).toMatchObject({ feet: levels[0]!.start, action: 'standing' });
    expect(getItemSlots(sim)).toEqual([{ slot: 1, itemDefId: null, isSelected: false }]);
    expect(getCrafting(sim).knownRecipes).toEqual([]);
    expect(sim.takeSnapshot().slices.lettersRead).toEqual([]);
    expect(getGame(sim)).toEqual({ isOver: false, isPlayAgainOffered: false });
    // A second one right after it is heard by a game that is not over.
    sim.step([{ type: 'game/playAgain' }]);
    expect(sim.level).toBe(levels[0]!.id);
  });

  it('is in the snapshot: a game restored after the end is played again the same way', () => {
    const sim = createSimAtFlagOf(LAST_LEVEL.id);
    for (let tick = 0; tick < OFFERED_AFTER_TICKS; tick += 1) {
      sim.step();
    }
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    for (const each of [sim, restored]) {
      each.step([{ type: 'game/playAgain' }]);
    }
    expect(restored.takeSnapshot()).toEqual(sim.takeSnapshot());
    expect(restored.level).toBe(levels[0]!.id);
  });
});

// ---- Helpers ----

const LAST_LEVEL = levels[levels.length - 1]!;
const OFFERED_AFTER_TICKS = Math.round(GAME_END.playAgainAfter * TICK_RATE);

/**
 * A sim on `level` restored with the stick man standing at its flag, stepped once so the flag is
 * reached.
 */
function createSimAtFlagOf(level: number): Sim {
  const fresh = new Sim({ features, start: { seed: 1, level } });
  const flagAt = findFlagPlacedIn(fresh.levelDef)!.position;
  const snapshot = fresh.takeSnapshot();
  const sim = new Sim({
    features,
    snapshot: {
      ...snapshot,
      slices: {
        ...snapshot.slices,
        player: { ...(snapshot.slices.player as object), x: flagAt.x, y: flagAt.y },
      },
    },
  });
  sim.step();
  expect(getFlag(sim)!.isReached).toBe(true);
  return sim;
}

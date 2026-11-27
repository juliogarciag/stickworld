import { describe, expect, it } from 'vitest';
import { levels } from '../../content/levels';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { features } from '..';
import { getAirplane } from '../airplane/view';
import { getFlag } from '../flag/view';
import { AIRPLANE_ITEM_ID, PAPER_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { getItemSlots } from '../inventory/view';
import { getItemUse } from '../item/view';
import { getLetter } from '../letter/view';
import { getStickMan } from '../player/view';
import { getInteraction } from './view';

describe("'world/interact' and 'item/use'", () => {
  it('do one thing a press: next to both the airplane and the letter, a press lifts the airplane and the letter stays unread', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    // In play he cannot have an airplane before he has read the letter, so this one is handed to him.
    giveItem(sim, AIRPLANE_ITEM_ID);
    walkTo(sim, getLetter(sim)!.position.x - 0.4);
    sim.step([SELECT_SLOT_1]);
    sim.step([USE_ITEM]);
    expect(getAirplane(sim)!.state).toBe('resting');
    expect(getInteraction(sim)).toBe('lift');
    sim.step([INTERACT]);
    expect(getAirplane(sim)!.state).toBe('carried');
    expect(getLetter(sim)).toMatchObject({ isBeingRead: false });
    expect(getInteraction(sim)).toBe('putDown');
  });

  it('leave the letter he is reading to the interact key: using an item does nothing until it is put away, and putting it away does nothing more', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 3 } });
    giveItem(sim, PAPER_ITEM_ID);
    walkTo(sim, getLetter(sim)!.position.x);
    sim.step([INTERACT]);
    expect(getInteraction(sim)).toBe('putLetterAway');
    expect(getItemUse(sim)).toBeNull();
    sim.step([USE_ITEM]);
    expect(getLetter(sim)).toMatchObject({ isBeingRead: true });
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
    sim.step([INTERACT]);
    expect(getLetter(sim)).toBeUndefined();
    expect(getItemSlots(sim)[0]?.itemDefId).toBe(PAPER_ITEM_ID);
    expect(getItemUse(sim)).toBe('craft');
  });

  it.each(levels.map((level) => [level.id]))('change nothing on level %i when there is nothing to use or interact with', (level) => {
    const sim = new Sim({ features, start: { seed: 1, level } });
    walkTo(sim, getStickMan(sim).feet.x - 1);
    expect(getInteraction(sim)).toBeNull();
    expect(getItemUse(sim)).toBeNull();
    const untouched = new Sim({ features, snapshot: sim.takeSnapshot() });
    sim.step([INTERACT, USE_ITEM]);
    untouched.step();
    expect(hashSnapshot(sim.takeSnapshot())).toBe(hashSnapshot(untouched.takeSnapshot()));
  });

  it('do nothing once the level is finished', () => {
    const sim = new Sim({ features, start: { seed: 1, level: 1 } });
    giveItem(sim, PAPER_ITEM_ID);
    sim.step([SELECT_SLOT_1]);
    sim.step([{ type: 'player/walk', direction: 1 }]);
    for (let tick = 0; tick < 600 && !getFlag(sim)!.isReached; tick += 1) sim.step();
    expect(getFlag(sim)!.isReached).toBe(true);
    expect(getItemUse(sim)).toBeNull();
    expect(getInteraction(sim)).toBeNull();
  });
});

// ---- Helpers ----

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };
const USE_ITEM: Command = { type: 'item/use' };
const INTERACT: Command = { type: 'world/interact' };

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > getStickMan(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - getStickMan(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}

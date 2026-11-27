import { describe, expect, it } from 'vitest';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { hashSnapshot } from '../../core/snapshot';
import { getDef } from '../../content/defs';
import { ITEM_SLOT_COUNT, PAPER_ITEM_ID } from './defs';
import { giveItem } from './give';
import { features } from '..';
import { getItemSlots } from './view';

describe('inventory', () => {
  it('starts with every slot empty and none selected', () => {
    const sim = createSimOnLevel(1);
    expect(getItemSlots(sim)).toEqual(Array.from({ length: ITEM_SLOT_COUNT }, (_, index) => ({ slot: index + 1, itemDefId: null, selected: false })));
  });

  it('holds the paper in slot 1 once it is given, and the paper is a def', () => {
    const sim = createSimOnLevel(1);
    expect(giveItem(sim, PAPER_ITEM_ID)).toBe(true);
    expect(getItemSlots(sim)[0]).toEqual({ slot: 1, itemDefId: PAPER_ITEM_ID, selected: false });
    expect(getDef(PAPER_ITEM_ID)?.name).toBe('paper');
  });

  it('does not give an item he already holds a second time, nor something that is not an item', () => {
    const sim = createSimOnLevel(1);
    giveItem(sim, PAPER_ITEM_ID);
    const before = hashSnapshot(sim.takeSnapshot());
    expect(giveItem(sim, PAPER_ITEM_ID)).toBe(true);
    expect(giveItem(sim, 0)).toBe(false);
    expect(giveItem(sim, Number.NaN)).toBe(false);
    expect(hashSnapshot(sim.takeSnapshot())).toBe(before);
  });

  it("selects slot 1 on 'inventory/select', and unselects it on the next one", () => {
    const sim = createSimOnLevel(1);
    giveItem(sim, PAPER_ITEM_ID);
    sim.step([SELECT_SLOT_1]);
    expect(getItemSlots(sim)[0]).toEqual({ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true });
    sim.step();
    expect(getItemSlots(sim)[0]?.selected).toBe(true);
    sim.step([SELECT_SLOT_1]);
    expect(getItemSlots(sim)[0]?.selected).toBe(false);
  });

  it('selects a slot that holds nothing: the key answers whether or not he has an item yet', () => {
    const sim = createSimOnLevel(1);
    sim.step([SELECT_SLOT_1]);
    expect(getItemSlots(sim)[0]).toEqual({ slot: 1, itemDefId: null, selected: true });
  });

  it.each([0, -1, 1.5, ITEM_SLOT_COUNT + 1, Number.NaN, Infinity, '1', null, undefined, {}, [1]])('ignores a select for slot %j', (slot) => {
    const sim = createSimOnLevel(1);
    const before = sim.takeSnapshot().slices;
    sim.step([{ type: 'inventory/select', slot } as unknown as Command]);
    expect(sim.takeSnapshot().slices).toEqual(before);
  });

  it('keeps what he holds and what is selected when a level restarts and when the next one starts', () => {
    const sim = createSimOnLevel(1);
    giveItem(sim, PAPER_ITEM_ID);
    sim.step([SELECT_SLOT_1]);
    sim.startLevel(sim.level);
    expect(getItemSlots(sim)[0]).toEqual({ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true });
    sim.startLevel(2);
    expect(getItemSlots(sim)[0]).toEqual({ slot: 1, itemDefId: PAPER_ITEM_ID, selected: true });
  });

  it('is in the snapshot: a restored sim holds the same', () => {
    const sim = createSimOnLevel(1);
    giveItem(sim, PAPER_ITEM_ID);
    sim.step([SELECT_SLOT_1]);
    const restored = new Sim({ features, snapshot: sim.takeSnapshot() });
    expect(getItemSlots(restored)).toEqual(getItemSlots(sim));
  });
});

// ---- Helpers ----

const SELECT_SLOT_1: Command = { type: 'inventory/select', slot: 1 };

function createSimOnLevel(level: number): Sim {
  return new Sim({ features, start: { seed: 1, level } });
}

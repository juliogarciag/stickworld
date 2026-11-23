import { describe, expect, it, vi } from 'vitest';
import { level3 } from '../../content/levels/level3';
import type { Command } from '../../core/commands';
import { Sim } from '../../core/sim';
import { features } from '..';
import { AIRPLANE_ITEM_ID } from '../inventory/defs';
import { giveItem } from '../inventory/give';
import { stickManOf } from '../player/view';
import { interactionOf } from '../world/view';
import { AIRPLANE } from './defs';
import { airplaneOf } from './view';

// The other key scheme (ADR 0003): the same sim with `BOARDING.needsAHeldPress` switched on.
vi.mock('./defs', async (original) => {
  const defs = await original<typeof import('./defs')>();
  return { ...defs, BOARDING: { ...defs.BOARDING, needsAHeldPress: true } };
});

describe('boarding by a held press', () => {
  it('lifts the airplane off an edge on a short press, which the one-press scheme cannot', () => {
    const sim = airplaneOnTheEdge();
    expect(interactionOf(sim)).toBe('lift');
    sim.step([{ type: 'world/interact' }]);
    expect(airplaneOf(sim)!.state).toBe('carried');
  });

  it('boards it on a held press: the press is taken and, until boarding exists, does nothing', () => {
    const sim = airplaneOnTheEdge();
    const before = sim.snapshot().slices;
    sim.step([{ type: 'world/interact', held: true }]);
    expect(sim.snapshot().slices).toEqual(before);
  });

  it('lifts it on a held press anywhere but on an edge, and puts it down on one', () => {
    const sim = airplaneOnTheEdge();
    sim.step([{ type: 'world/interact' }]);
    walkTo(sim, EDGE - 4);
    sim.step([{ type: 'world/interact', held: true }]);
    expect(airplaneOf(sim)).toMatchObject({ state: 'resting', onAnEdge: false });
    sim.step([{ type: 'world/interact', held: true }]);
    expect(airplaneOf(sim)!.state).toBe('carried');
  });
});

// ---- Helpers ----

const EDGE = level3.floor[0]!.to.x;
const USE_ITEM: Command = { type: 'item/use' };

/** On level 3, standing next to an airplane he has set down with its nose out over the gap. */
function airplaneOnTheEdge(): Sim {
  const sim = new Sim({ features, start: { seed: 1, level: 3 } });
  giveItem(sim, AIRPLANE_ITEM_ID);
  sim.step([{ type: 'inventory/select', slot: 1 }]);
  walkTo(sim, EDGE - AIRPLANE.putDownAhead - 0.2);
  sim.step([USE_ITEM]);
  expect(airplaneOf(sim)).toMatchObject({ state: 'resting', onAnEdge: true });
  return sim;
}

/** Walks him to `x` and stops him there, within one tick's walk. */
function walkTo(sim: Sim, x: number): void {
  const direction = x > stickManOf(sim).feet.x ? 1 : -1;
  sim.step([{ type: 'player/walk', direction }]);
  for (let tick = 0; tick < 3000 && (x - stickManOf(sim).feet.x) * direction > 0; tick += 1) sim.step();
  sim.step([{ type: 'player/walk', direction: 0 }]);
}

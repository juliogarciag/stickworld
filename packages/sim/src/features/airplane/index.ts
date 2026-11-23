import type { FloorSegment } from '../../content/levels/types';
import { STICK_MAN_HEIGHT } from '../../content/tuning';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { AIRPLANE_ITEM_ID } from '../inventory/defs';
import { holdsItem, replaceSelectedItem, selectedItemOf } from '../inventory/held';
import { PLAYER } from '../player/defs';
import { floorHeightAt, lowestFloorHeight } from '../player/floor';
import { playerSlice } from '../player/state';
import { AIRPLANE } from './defs';
import { airplaneSlice, type AirplaneState } from './state';

/**
 * The paper airplane in the world. Using the airplane item puts it on the
 * floor in front of him; interacting next to it lifts it over his head, and
 * interacting again puts it down in front of him. It rests wherever its
 * middle has floor under it, so near the end of a line it sits on the edge
 * with its nose out. Put down too far past the edge, or still over his head
 * when he drops off one, it falls and is lost. Moved by lifting and carrying
 * only: plain arithmetic on the level's floor segments, no physics.
 */
export const airplaneFeature: Feature = {
  name: 'airplane',
  slices: [airplaneSlice],

  update(sim) {
    const airplane = sim.stateOf(airplaneSlice);
    if (!airplane.inWorld) return;
    const player = sim.stateOf(playerSlice);
    const floorLevel = lowestFloorHeight(sim.levelDef.floor);
    if (airplane.carried) {
      // In the air below the floor he is on his way down a gap or off the paper: he lets go of it.
      if (!player.onFloor && player.y > floorLevel) {
        letFall(airplane);
        player.carrying = false;
      } else {
        carryOverHisHead(sim);
      }
    }
    if (!airplane.falling) return;
    airplane.y += airplane.verticalSpeed * sim.dt + (AIRPLANE.gravity * sim.dt * sim.dt) / 2;
    airplane.verticalSpeed += AIRPLANE.gravity * sim.dt;
    if (airplane.y > floorLevel + PLAYER.fallBelowFloor) sim.setStateOf(airplaneSlice, airplaneSlice.initialFor(sim.levelDef));
  },
};

/** True while he has an airplane, as an item in a slot or in the world. False once it is lost, and before he has made one. */
export function hasAirplane(sim: Sim): boolean {
  return holdsItem(sim, AIRPLANE_ITEM_ID) || sim.stateOf(airplaneSlice).inWorld;
}

/**
 * True while the airplane rests on the floor with its nose out over a gap: where it is boarded from. An airplane whose
 * nose sticks out past the end of the paper, with no floor further on to fly to, does not count: it is only lifted.
 */
export function sitsOnAnEdge(sim: Sim): boolean {
  const airplane = sim.stateOf(airplaneSlice);
  if (!airplane.inWorld || airplane.carried || airplane.falling) return false;
  const { floor } = sim.levelDef;
  const nose = airplane.x + (airplane.facing * AIRPLANE.length) / 2;
  const floorFurtherOn = floor.some(({ from, to }) => (airplane.facing === 1 ? from.x > nose : to.x < nose));
  return floorHeightAt(floor, nose) === undefined && floorFurtherOn;
}

/** What using the held item does when it is the airplane, for `features/item`: it is put on the floor in front of him. */
export function airplaneItemUse(sim: Sim) {
  const canPlace = selectedItemOf(sim) === AIRPLANE_ITEM_ID && sim.stateOf(playerSlice).onFloor && !sim.stateOf(airplaneSlice).inWorld;
  if (!canPlace) return undefined;
  return {
    means: 'place' as const,
    perform: () => {
      replaceSelectedItem(sim, null);
      putDownInFrontOfHim(sim);
    },
  };
}

/**
 * What interacting does with the airplane, for `features/world`: put it down while he carries it, board it where it
 * sits on an edge, or lift it anywhere else he stands next to it (ADR 0003).
 */
export function airplaneInteraction(sim: Sim) {
  const airplane = sim.stateOf(airplaneSlice);
  const player = sim.stateOf(playerSlice);
  if (!airplane.inWorld || airplane.falling || !player.onFloor) return undefined;
  if (airplane.carried) return { means: 'putDown' as const, perform: () => putDownInFrontOfHim(sim) };
  if (Math.abs(player.x - airplane.x) > AIRPLANE.reach) return undefined;
  // Boarding is issue #5. Until then the press is taken and nothing happens: it must not lift the airplane instead.
  if (sitsOnAnEdge(sim)) return { means: 'board' as const, perform: () => undefined };
  return {
    means: 'lift' as const,
    perform: () => {
      airplane.carried = true;
      player.carrying = true;
      carryOverHisHead(sim);
    },
  };
}

// ---- Helpers ----

/** The airplane leaves his hands or his slot for the floor in front of him, or for the air past the end of it. */
function putDownInFrontOfHim(sim: Sim): void {
  const airplane = sim.stateOf(airplaneSlice);
  const player = sim.stateOf(playerSlice);
  const { floor } = sim.levelDef;
  const middle = player.x + player.facing * AIRPLANE.putDownAhead;
  const resting = whereItRests(floor, { middle, facing: player.facing });
  player.carrying = false;
  airplane.inWorld = true;
  airplane.carried = false;
  airplane.facing = player.facing;
  airplane.verticalSpeed = 0;
  airplane.x = resting ?? middle;
  airplane.y = floorHeightAt(floor, airplane.x) ?? player.y;
  airplane.falling = resting === undefined;
}

function carryOverHisHead(sim: Sim): void {
  const airplane = sim.stateOf(airplaneSlice);
  const player = sim.stateOf(playerSlice);
  airplane.x = player.x;
  airplane.y = player.y - STICK_MAN_HEIGHT - AIRPLANE.carriedAbove;
  airplane.facing = player.facing;
}

function letFall(airplane: AirplaneState): void {
  airplane.carried = false;
  airplane.falling = true;
  airplane.verticalSpeed = 0;
}

/**
 * Where the middle of an airplane put down at `middle`, nose towards `facing`, comes to rest, or undefined when it
 * falls. It rests where it is put when there is floor under its middle. A little past the end of the line he put it
 * down from, it is pulled back to sit on that edge; it is never pulled on to the far side of a gap.
 */
function whereItRests(floor: readonly FloorSegment[], { middle, facing }: { middle: number; facing: 1 | -1 }): number | undefined {
  if (floorHeightAt(floor, middle) !== undefined) return middle;
  for (const { from, to } of floor) {
    const end = facing === 1 ? to.x : from.x;
    const past = (middle - end) * facing;
    if (past > 0 && past <= AIRPLANE.savedPastTheEdge) return end - facing * AIRPLANE.sitsBackFromTheEdge;
  }
  return undefined;
}

export const __testing__ = { whereItRests };

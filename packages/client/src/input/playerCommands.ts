import { stickManOf, type Command, type SimHandle, type WalkDirection } from '@stickworld/sim';

/** What the keys say this frame, whichever keys they are. */
export interface KeysNow {
  readonly leftHeld: boolean;
  readonly rightHeld: boolean;
  /** True on the one frame the jump key went down. */
  readonly jumpPressed: boolean;
}

/**
 * Returns a function that turns what the keys say into the commands the sim
 * has not heard yet. Walking is compared with what the sim believes, not with
 * what was sent last, so a key still held when a level starts again walks him
 * again. A walk command still waiting for the sim's next tick counts as
 * heard: it is not sent twice, and a change of mind before that tick is sent
 * after it.
 */
export function keysToCommands(): (now: { keys: KeysNow; sim: SimHandle }) => Command[] {
  let lastWalkAsked: { direction: WalkDirection; sim: SimHandle; tick: number } | undefined;
  return ({ keys, sim }) => {
    const commands: Command[] = [];
    const directionHeld = walkDirectionHeld(keys);
    // The last walk command may still be waiting for the sim's next tick. Until then the sim has not heard it,
    // but it has been asked, and asking again would be a duplicate.
    const lastWalkIsStillWaiting = lastWalkAsked !== undefined && lastWalkAsked.sim === sim && lastWalkAsked.tick === sim.tick;
    const directionAlreadyAsked = lastWalkIsStillWaiting && lastWalkAsked ? lastWalkAsked.direction : stickManOf(sim).walkDirectionAsked;
    if (directionHeld !== directionAlreadyAsked) {
      commands.push({ type: 'player/walk', direction: directionHeld });
      lastWalkAsked = { direction: directionHeld, sim, tick: sim.tick };
    }
    if (keys.jumpPressed) commands.push({ type: 'player/jump' });
    return commands;
  };
}

/** Which way the keys say to walk: neither when both or none are held. */
export function walkDirectionHeld({ leftHeld, rightHeld }: KeysNow): WalkDirection {
  if (leftHeld === rightHeld) return 0;
  return leftHeld ? -1 : 1;
}

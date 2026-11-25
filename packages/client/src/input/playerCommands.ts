import { steeringAskedOf, stickManOf, type Command, type SimHandle, type SteerDirection, type WalkDirection } from '@stickworld/sim';

/** What the keys say this frame, whichever keys they are. */
export interface KeysNow {
  readonly leftHeld: boolean;
  readonly rightHeld: boolean;
  readonly upHeld: boolean;
  readonly downHeld: boolean;
  /** True while a key that only ever jumps is down. */
  readonly jumpHeld: boolean;
  /** True on the one frame a key that only ever jumps went down. */
  readonly jumpPressed: boolean;
  /** True on the one frame an up key went down: on his feet that is a jump too; seated, up steers and is not one. */
  readonly upPressed: boolean;
}

/**
 * Returns a function that turns what the keys say into the commands the sim
 * has not heard yet. Walking and steering are compared with what the sim
 * believes, not with what was sent last, so a key still held when a level
 * starts again walks him again. A command still waiting for the sim's next
 * tick counts as heard: it is not sent twice, and a change of mind before
 * that tick is sent after it.
 *
 * The up keys are the one place a key means two things: a jump while he is on
 * his feet, the airplane's nose up while he is seated in it, where only the
 * jump key itself jumps him out. Which of the two he is doing is the sim's
 * (`stickManOf`); what the sim does with either command is its own business.
 * What is read here is one tick old while a command waits: an up key pressed
 * in the moment he boards is still sent as a jump, and the sim drops a jump
 * that arrives on the tick he sits down.
 *
 * Letting go of the jump is a command too: the sim cuts a rising jump short
 * by how much its tuning says, which in the game as it is ends the rise. It is
 * sent when the keys that were jumping are all up, and on the frame of a tap
 * that went down and up between two frames. An up key held since he was
 * seated steered the airplane and holds no jump after he jumps out of it.
 */
export function keysToCommands(): (now: { keys: KeysNow; sim: SimHandle }) => Command[] {
  const walkIsNews = newsToTheSim<WalkDirection>();
  const steeringIsNews = newsToTheSim<SteerDirection>();
  let jumpWasHeld = false;
  // An up key held to steer the airplane is not a jump held once he jumps out: it steered, and counts again only once let go of.
  let upHeldSinceSeated = false;
  return ({ keys, sim }) => {
    const commands: Command[] = [];
    const seated = stickManOf(sim).action === 'seated';
    const walkDirection = walkDirectionHeld(keys);
    if (walkIsNews({ wanted: walkDirection, believed: stickManOf(sim).walkDirectionAsked, sim })) commands.push({ type: 'player/walk', direction: walkDirection });
    const steerDirection = seated ? steerDirectionHeld(keys) : 0;
    if (steeringIsNews({ wanted: steerDirection, believed: steeringAskedOf(sim), sim })) commands.push({ type: 'airplane/steer', direction: steerDirection });
    const jumpAsked = keys.jumpPressed || (keys.upPressed && !seated);
    if (jumpAsked) commands.push({ type: 'player/jump' });
    upHeldSinceSeated = keys.upHeld && (seated || upHeldSinceSeated);
    const jumpHeld = keys.jumpHeld || (keys.upHeld && !upHeldSinceSeated);
    if (!jumpHeld && (jumpWasHeld || jumpAsked)) commands.push({ type: 'player/letGoOfJump' });
    jumpWasHeld = jumpHeld;
    return commands;
  };
}

/** Which way the keys say to walk: neither when both or none are held. */
export function walkDirectionHeld({ leftHeld, rightHeld }: KeysNow): WalkDirection {
  if (leftHeld === rightHeld) return 0;
  return leftHeld ? -1 : 1;
}

/** Which way the keys say to steer the airplane's nose: 1 up, -1 down, neither when both or none are held. */
export function steerDirectionHeld({ upHeld, downHeld }: KeysNow): SteerDirection {
  if (upHeld === downHeld) return 0;
  return upHeld ? 1 : -1;
}

// ---- Helpers ----

/**
 * Returns a function that says whether what the keys want is something the sim has not been told: it differs from what
 * the sim believes, or from what was asked last when that command is still waiting for the sim's next tick.
 */
function newsToTheSim<Wanted>(): (now: { wanted: Wanted; believed: Wanted; sim: SimHandle }) => boolean {
  let lastAsked: { wanted: Wanted; sim: SimHandle; tick: number } | undefined;
  return ({ wanted, believed, sim }) => {
    // The last command may still be waiting for the sim's next tick. Until then the sim has not heard it,
    // but it has been asked, and asking again would be a duplicate.
    const lastIsStillWaiting = lastAsked !== undefined && lastAsked.sim === sim && lastAsked.tick === sim.tick;
    const alreadyAsked = lastIsStillWaiting && lastAsked ? lastAsked.wanted : believed;
    if (wanted === alreadyAsked) return false;
    lastAsked = { wanted, sim, tick: sim.tick };
    return true;
  };
}

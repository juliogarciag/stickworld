import {
  getSteeringAsked,
  getStickMan,
  type Command,
  type SimHandle,
  type SteerDirection,
  type WalkDirection,
} from '@stickworld/sim';

/** What the keys say this frame, whichever keys they are. */
export interface HeldKeys {
  readonly isLeftHeld: boolean;
  readonly isRightHeld: boolean;
  readonly isUpHeld: boolean;
  readonly isDownHeld: boolean;
  /** True while a key that only ever jumps is down. */
  readonly isJumpHeld: boolean;
  /** True on the one frame a key that only ever jumps went down. */
  readonly isJumpPressed: boolean;
  /**
   * True on the one frame an up key went down: on the stick man's feet that is a jump too; seated,
   * up steers and is not one.
   */
  readonly isUpPressed: boolean;
}

/**
 * Returns a function that turns what the keys say into the commands the sim
 * has not heard yet. Walking and steering are compared with what the sim
 * believes, not with what was sent last, so a key still held when a level
 * starts again walks the stick man again. A command still waiting for the sim's next
 * tick counts as heard: it is not sent twice, and a change of mind before
 * that tick is sent after it.
 *
 * The up keys are the one place a key means two things: a jump while the stick man is on
 * the stick man's feet, the airplane's nose up while the stick man is seated in it, where only the
 * jump key itself jumps the stick man out. Which of the two the stick man is doing is the sim's
 * (`getStickMan`); what the sim does with either command is its own business.
 * What is read here is one tick old while a command waits: an up key pressed
 * in the moment the stick man boards is still sent as a jump, and the sim drops a jump
 * that arrives on the tick it sits down.
 *
 * Letting go of the jump is a command too: the sim cuts a rising jump short
 * by how much its tuning says, which in the game as it is ends the rise. It is
 * sent when the keys that were jumping are all up, and on the frame of a tap
 * that went down and up between two frames. An up key held since the stick man was
 * seated steered the airplane and holds no jump after the stick man jumps out of it.
 */
export function createKeysToCommands(): (now: { keys: HeldKeys; sim: SimHandle }) => Command[] {
  const hasWalkChanged = createChangeDetector<WalkDirection>();
  const hasSteeringChanged = createChangeDetector<SteerDirection>();
  let wasJumpHeld = false;
  // An up key held to steer the airplane is not a jump held once the stick man jumps out: it
  // steered, and counts again only once let go of.
  let wasUpHeldSinceSeated = false;
  return (input) => {
    const commands: Command[] = [];
    const isSeated = getStickMan(input.sim).action === 'seated';
    const walkDirection = getWalkDirectionHeld(input.keys);
    if (
      hasWalkChanged({
        wanted: walkDirection,
        believed: getStickMan(input.sim).walkDirectionAsked,
        sim: input.sim,
      })
    ) {
      commands.push({ type: 'player/walk', direction: walkDirection });
    }
    const steerDirection = isSeated ? getSteerDirectionHeld(input.keys) : 0;
    if (
      hasSteeringChanged({
        wanted: steerDirection,
        believed: getSteeringAsked(input.sim),
        sim: input.sim,
      })
    ) {
      commands.push({ type: 'airplane/steer', direction: steerDirection });
    }
    const isJumpRequested = input.keys.isJumpPressed || (input.keys.isUpPressed && !isSeated);
    if (isJumpRequested) {
      commands.push({ type: 'player/jump' });
    }
    wasUpHeldSinceSeated = input.keys.isUpHeld && (isSeated || wasUpHeldSinceSeated);
    const isJumpHeld = input.keys.isJumpHeld || (input.keys.isUpHeld && !wasUpHeldSinceSeated);
    const hasLetGoOfJump = !isJumpHeld && (wasJumpHeld || isJumpRequested);
    if (hasLetGoOfJump) {
      commands.push({ type: 'player/letGoOfJump' });
    }
    wasJumpHeld = isJumpHeld;
    return commands;
  };
}

/** Which way the keys say to walk: neither when both or none are held. */
export function getWalkDirectionHeld(keys: HeldKeys): WalkDirection {
  if (keys.isLeftHeld === keys.isRightHeld) {
    return 0;
  }
  return keys.isLeftHeld ? -1 : 1;
}

/**
 * Which way the keys say to steer the airplane's nose: 1 up, -1 down, neither when both or none are
 * held.
 */
export function getSteerDirectionHeld(keys: HeldKeys): SteerDirection {
  if (keys.isUpHeld === keys.isDownHeld) {
    return 0;
  }
  return keys.isUpHeld ? 1 : -1;
}

// ---- Helpers ----

/**
 * Returns a function that says whether what the keys want is something the sim has not been told:
 * it differs from what the sim believes, or from what was asked last when that command is still
 * waiting for the sim's next tick.
 */
function createChangeDetector<Wanted>(): (now: {
  wanted: Wanted;
  believed: Wanted;
  sim: SimHandle;
}) => boolean {
  let lastAsked: { wanted: Wanted; sim: SimHandle; tick: number } | undefined;
  return (input) => {
    // The last command may still be waiting for the sim's next tick. Until then the sim has not
    // heard it, but it has been asked, and asking again would be a duplicate.
    const isLastRequestPending =
      lastAsked !== undefined && lastAsked.sim === input.sim && lastAsked.tick === input.sim.tick;
    const pendingRequest = isLastRequestPending ? lastAsked : undefined;
    const alreadyAsked = pendingRequest ? pendingRequest.wanted : input.believed;
    if (input.wanted === alreadyAsked) {
      return false;
    }
    lastAsked = { wanted: input.wanted, sim: input.sim, tick: input.sim.tick };
    return true;
  };
}

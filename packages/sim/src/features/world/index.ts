import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { getAirplaneInteraction } from '../airplane';
import { getFallenItemInteraction, getLetterBeingRead, getLetterInteraction } from '../letter';
import { isFlagReached } from '../flag';
import { isPlayerStruck } from '../player/body';

/**
 * Interacting with the world: one command, `'world/interact'`, whose meaning
 * depends on what is next to the stick man. This feature owns the command and knows
 * nothing about the things themselves: it asks each feature that has
 * something to interact with, in order, and the first that answers is what
 * the command does (ADR 0003). One press never does two things. A feature
 * with a new thing in the world exports an answer and adds it to `ANSWERS`.
 */
export const worldFeature: Feature = {
  name: 'world',

  handleCommand(sim, command) {
    if (command.type !== 'world/interact') {
      return;
    }
    getInteractionNow(sim)?.perform();
  },
};

/**
 * What `'world/interact'` would do right now, with the function that does it, or undefined when
 * there is nothing to interact with.
 */
export function getInteractionNow(sim: Sim): Interaction | undefined {
  // Under a flag it has reached the stick man only cheers, and struck down it does nothing at all.
  const canInteract = !isFlagReached(sim) && !isPlayerStruck(sim);
  if (!canInteract) {
    return undefined;
  }
  for (const answer of ANSWERS) {
    const interaction = answer(sim);
    if (interaction) {
      return interaction;
    }
  }
  return undefined;
}

/**
 * Every interaction there is, most pressing first: the letter the stick man reads is put away, then
 * what it has in its hands comes before what lies next to it.
 */
const ANSWERS = [
  getLetterBeingRead,
  getAirplaneInteraction,
  getLetterInteraction,
  getFallenItemInteraction,
] as const;

export type Interaction = NonNullable<ReturnType<(typeof ANSWERS)[number]>>;

/**
 * What interacting means: read a letter, put away the one being read, lift the airplane, put it
 * down, board it, or pick up the item that fell from the sky.
 */
export type InteractionMeaning = Interaction['means'];

import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { airplaneInteraction } from '../airplane';
import { recipeListInteraction } from '../crafting';
import { letterBeingRead, letterInteraction } from '../letter';
import { hasFinishedLevel } from '../player';

/**
 * Interacting with the world: one command, `'world/interact'`, whose meaning
 * depends on what is next to him. This feature owns the command and knows
 * nothing about the things themselves: it asks each feature that has
 * something to interact with, in order, and the first that answers is what
 * the command does (ADR 0003). One press never does two things. A feature
 * with a new thing in the world exports an answer and adds it to `ANSWERS`.
 */
export const worldFeature: Feature = {
  name: 'world',

  handleCommand(sim, command) {
    if (command.type !== 'world/interact') return;
    const { held } = command as { held?: unknown };
    if (held !== undefined && typeof held !== 'boolean') return;
    interactionNow(sim, { held: held === true })?.perform();
  },
};

/** How the player pressed: a short press, or one he held down. */
export interface Press {
  readonly held: boolean;
}

/** What `'world/interact'` would do right now, with the function that does it, or undefined when there is nothing to interact with. */
export function interactionNow(sim: Sim, press: Press): Interaction | undefined {
  if (hasFinishedLevel(sim)) return undefined;
  for (const answer of ANSWERS) {
    const interaction = answer(sim, press);
    if (interaction) return interaction;
  }
  return undefined;
}

/** Every interaction there is, most pressing first: what he holds up to look at is put away, then what he has in his hands comes before what lies next to him. */
const ANSWERS = [letterBeingRead, recipeListInteraction, airplaneInteraction, letterInteraction] as const;

export type Interaction = NonNullable<ReturnType<(typeof ANSWERS)[number]>>;

/** What interacting means: read a letter, put away the one being read or the recipe list, lift the airplane, put it down, or board it. */
export type InteractionMeaning = Interaction['means'];

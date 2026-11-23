import type { Level, Placement } from '../../content/levels/types';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { hasAirplane } from '../airplane';
import { teachRecipe } from '../crafting';
import { recipeDef } from '../crafting/defs';
import { giveItem } from '../inventory/give';
import { holdsItem, selectItem } from '../inventory/held';
import { playerSlice } from '../player/state';
import { LETTER, letterDef, type LetterDef } from './defs';
import { letterSlice, lettersReadSlice } from './state';

/**
 * The letter a level leaves on the floor. Interacting next to it reads it,
 * which teaches its recipe and puts the item the recipe is made from in his
 * hand; interacting again or walking away puts it away, and then it is gone. Whenever he has lost everything the
 * letter was for (its item, and what its recipe makes of it), a new letter
 * falls from the sky to where the old one was, and reading that one gives
 * him the item again. So he can never be left without a way on.
 */
export const letterFeature: Feature = {
  name: 'letter',
  slices: [letterSlice, lettersReadSlice],

  init(sim) {
    const placed = letterPlacedIn(sim.levelDef);
    // A letter he has read before does not lie there again when the level starts again: a new one falls if he needs it.
    sim.stateOf(letterSlice).inLevel = placed !== undefined && !sim.stateOf(lettersReadSlice).includes(placed.defId);
  },

  update(sim) {
    const placed = letterPlacedIn(sim.levelDef);
    const def = placed && letterDef(placed.defId);
    if (!placed || !def) return;
    const letter = sim.stateOf(letterSlice);
    if (letter.beingRead && !canRead(sim, placed)) putAway(sim);
    if (letter.inLevel) {
      letter.height = Math.max(0, letter.height - LETTER.fallSpeed * sim.dt);
      return;
    }
    if (hasWhatItIsFor(sim, def)) {
      letter.ticksUntilNewOneFalls = null;
    } else if (letter.ticksUntilNewOneFalls === null) {
      letter.ticksUntilNewOneFalls = Math.round(LETTER.fallsAfter / sim.dt);
    } else if (letter.ticksUntilNewOneFalls > 0) {
      letter.ticksUntilNewOneFalls -= 1;
    } else {
      letter.ticksUntilNewOneFalls = null;
      letter.inLevel = true;
      letter.height = LETTER.fallsFromHeight;
    }
  },
};

/** Where the level's letter lies, or undefined for a level without one. */
export function letterPlacedIn(level: Level): Placement | undefined {
  return level.placements.find((placement) => letterDef(placement.defId) !== undefined);
}

/** True while he reads a letter. */
export function isReadingALetter(sim: Sim): boolean {
  return sim.stateOf(letterSlice).beingRead;
}

/** What interacting does while he reads a letter, for `features/world`: he puts it away, and the press does nothing else. */
export function letterBeingRead(sim: Sim) {
  if (!sim.stateOf(letterSlice).beingRead) return undefined;
  return { means: 'putLetterAway' as const, perform: () => putAway(sim) };
}

/** What interacting does next to a letter that lies on the floor, for `features/world`: he reads it. */
export function letterInteraction(sim: Sim) {
  const placed = letterPlacedIn(sim.levelDef);
  const def = placed && letterDef(placed.defId);
  const letter = sim.stateOf(letterSlice);
  if (!placed || !def || !letter.inLevel || letter.height > 0 || letter.beingRead || !canRead(sim, placed)) return undefined;
  return {
    means: 'read' as const,
    perform: () => {
      letter.beingRead = true;
      const lettersRead = sim.stateOf(lettersReadSlice);
      if (!lettersRead.includes(def.id)) lettersRead.push(def.id);
      teachRecipe(sim, def.teachesRecipe);
      if (!hasWhatItIsFor(sim, def)) giveItem(sim, def.gives);
      // What the letter is about is in his hand when he looks up from it, so the key that uses it has a use at once.
      selectItem(sim, def.gives);
    },
  };
}

// ---- Helpers ----

/** He stops reading, and the letter he was reading is gone. Nothing changes when he is not reading. */
function putAway(sim: Sim): void {
  const letter = sim.stateOf(letterSlice);
  if (!letter.beingRead) return;
  letter.beingRead = false;
  letter.inLevel = false;
}

/** True while he stands on the floor within reach of where the letter lies. */
function canRead(sim: Sim, placed: Placement): boolean {
  const player = sim.stateOf(playerSlice);
  return player.onFloor && Math.abs(player.x - placed.at.x) <= LETTER.reach;
}

/**
 * True while he still has the item the letter gives, or what its recipe makes of that item. The only thing a recipe
 * makes that leaves his slots for the world is the airplane, so that is the one asked about here.
 */
function hasWhatItIsFor(sim: Sim, def: LetterDef): boolean {
  const made = recipeDef(def.teachesRecipe)?.makes;
  return holdsItem(sim, def.gives) || (made !== undefined && holdsItem(sim, made)) || hasAirplane(sim);
}

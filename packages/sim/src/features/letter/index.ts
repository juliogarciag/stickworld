import type { Level, Placement } from '../../content/levels/types';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { hasAirplane } from '../airplane';
import { teachRecipe } from '../crafting';
import { recipeDef } from '../crafting/defs';
import { giveItem } from '../inventory/give';
import { holdsItem, selectItem } from '../inventory/held';
import { hasFinishedLevel } from '../player';
import { playerSlice } from '../player/state';
import { LETTER, letterDef, type LetterDef } from './defs';
import { letterSlice, lettersReadSlice } from './state';

/**
 * The letter a level leaves on the floor. Interacting next to it reads it,
 * which teaches its recipe and puts the item the recipe is made from in his
 * hand; interacting again or walking away puts it back where it lay, opened,
 * and it can be read again. He never has to read it twice to go on: a level
 * that starts again for him who has read its letter and has nothing left of
 * what it was for gives him what its recipe makes at once. And whenever he
 * loses everything it was for without dying, a new letter falls from the sky
 * on to the old one, and reading that gives him the item again. So he can
 * never be left without a way on.
 */
export const letterFeature: Feature = {
  name: 'letter',
  slices: [letterSlice, lettersReadSlice],

  init(sim) {
    const placed = letterPlacedIn(sim.levelDef);
    const def = placed && letterDef(placed.defId);
    if (!def) return;
    const hasReadIt = sim.stateOf(lettersReadSlice).includes(def.id);
    sim.stateOf(letterSlice).opened = hasReadIt;
    if (!hasReadIt || hasWhatItIsFor(sim, def)) return;
    // He has learned what it teaches and lost what he made of it with the level: he starts again with that in his hand.
    const made = recipeDef(def.teachesRecipe)?.makes ?? def.gives;
    if (giveItem(sim, made)) selectItem(sim, made);
  },

  update(sim) {
    const placed = letterPlacedIn(sim.levelDef);
    const def = placed && letterDef(placed.defId);
    if (!placed || !def) return;
    const letter = sim.stateOf(letterSlice);
    if (letter.beingRead && !canRead(sim, placed)) putAway(sim);
    if (letter.height > 0) {
      letter.height = Math.max(0, letter.height - LETTER.fallSpeed * sim.dt);
      return;
    }
    // A letter nobody has opened yet is all he needs, and so is the one in his hands. Once the flag is reached he needs none.
    if (hasWhatItIsFor(sim, def) || !letter.opened || letter.beingRead || hasFinishedLevel(sim)) {
      letter.ticksUntilNewOneFalls = null;
    } else if (letter.ticksUntilNewOneFalls === null) {
      letter.ticksUntilNewOneFalls = Math.round(LETTER.fallsAfter / sim.dt);
    } else if (letter.ticksUntilNewOneFalls > 0) {
      letter.ticksUntilNewOneFalls -= 1;
    } else {
      letter.ticksUntilNewOneFalls = null;
      letter.opened = false;
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

/** What interacting does next to a letter that lies on the floor, for `features/world`: he reads it, for the first time or again. */
export function letterInteraction(sim: Sim) {
  const placed = letterPlacedIn(sim.levelDef);
  const def = placed && letterDef(placed.defId);
  const letter = sim.stateOf(letterSlice);
  if (!placed || !def || letter.height > 0 || letter.beingRead || !canRead(sim, placed)) return undefined;
  return {
    means: 'read' as const,
    perform: () => {
      letter.beingRead = true;
      letter.opened = true;
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

/** He stops reading: the letter is back where it lay, opened. */
function putAway(sim: Sim): void {
  sim.stateOf(letterSlice).beingRead = false;
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

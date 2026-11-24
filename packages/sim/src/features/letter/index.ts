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
import { fallenItemSlice, letterSlice, lettersReadSlice } from './state';

/**
 * The letter a level leaves on the floor. Interacting next to it reads it,
 * which teaches its recipe and puts the item the recipe is made from in his
 * hand; interacting again or walking away puts it away, and then it is gone:
 * what it taught he knows for good. What he can lose is the item. A level
 * that starts again for him who has read its letter and has nothing left of
 * what it was for gives him what its recipe makes at once. And whenever he
 * loses everything it was for without dying, the item itself falls from the
 * sky to where he stands, and interacting next to it picks it up. So he can
 * never be left without a way on.
 */
export const letterFeature: Feature = {
  name: 'letter',
  slices: [letterSlice, lettersReadSlice, fallenItemSlice],

  init(sim) {
    const placed = letterPlacedIn(sim.levelDef);
    const def = placed && letterDef(placed.defId);
    if (!def) return;
    const hasReadIt = sim.stateOf(lettersReadSlice).includes(def.id);
    // A letter he has read before does not lie there again when the level starts again.
    sim.stateOf(letterSlice).inLevel = !hasReadIt;
    if (!hasReadIt || hasWhatItIsFor(sim, def)) return;
    // He has learned what it teaches and lost what he made of it with the level: he starts again with that in his hand.
    const made = recipeDef(def.teachesRecipe)?.makes ?? def.gives;
    if (giveItem(sim, made)) selectItem(sim, made);
  },

  update(sim) {
    const placed = letterPlacedIn(sim.levelDef);
    const def = placed && letterDef(placed.defId);
    if (!placed || !def) return;
    if (sim.stateOf(letterSlice).beingRead && !isWithinReach(sim, placed.at)) putAway(sim);
    const fallen = sim.stateOf(fallenItemSlice);
    if (fallen.inLevel) {
      fallen.height = Math.max(0, fallen.height - LETTER.fallSpeed * sim.dt);
      return;
    }
    // The letter that still lies there gives it; with the flag reached he needs none.
    if (hasWhatItIsFor(sim, def) || sim.stateOf(letterSlice).inLevel || hasFinishedLevel(sim)) {
      fallen.ticksUntilItFalls = null;
    } else if (fallen.ticksUntilItFalls === null) {
      fallen.ticksUntilItFalls = Math.round(LETTER.fallsAfter / sim.dt);
    } else if (fallen.ticksUntilItFalls > 0) {
      fallen.ticksUntilItFalls -= 1;
    } else if (sim.stateOf(playerSlice).onFloor) {
      // It comes down where he stands, so he sees it and has it at his feet. In the air he has no place for it yet: it waits for him to land.
      const { x, y } = sim.stateOf(playerSlice);
      fallen.ticksUntilItFalls = null;
      fallen.inLevel = true;
      fallen.x = x;
      fallen.y = y;
      fallen.height = LETTER.fallsFromHeight;
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
  if (!placed || !def || !letter.inLevel || letter.beingRead || !isWithinReach(sim, placed.at)) return undefined;
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

/** What interacting does next to the item that fell from the sky, once it lies on the floor, for `features/world`: he picks it up, into his hand. */
export function fallenItemInteraction(sim: Sim) {
  const placed = letterPlacedIn(sim.levelDef);
  const def = placed && letterDef(placed.defId);
  const fallen = sim.stateOf(fallenItemSlice);
  if (!def || !fallen.inLevel || fallen.height > 0 || !isWithinReach(sim, fallen)) return undefined;
  return {
    means: 'pickUp' as const,
    perform: () => {
      if (!giveItem(sim, def.gives)) return;
      selectItem(sim, def.gives);
      fallen.inLevel = false;
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

/** True while he stands on the floor within reach of something that lies at `at`: the letter, or the item that fell. */
function isWithinReach(sim: Sim, at: { readonly x: number }): boolean {
  const player = sim.stateOf(playerSlice);
  return player.onFloor && Math.abs(player.x - at.x) <= LETTER.reach;
}

/**
 * True while he still has the item the letter gives, or what its recipe makes of that item. The only thing a recipe
 * makes that leaves his slots for the world is the airplane, so that is the one asked about here.
 */
function hasWhatItIsFor(sim: Sim, def: LetterDef): boolean {
  const made = recipeDef(def.teachesRecipe)?.makes;
  return holdsItem(sim, def.gives) || (made !== undefined && holdsItem(sim, made)) || hasAirplane(sim);
}

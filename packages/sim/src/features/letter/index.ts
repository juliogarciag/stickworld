import type { Level, Placement } from '../../content/levels/types';
import type { Feature } from '../../core/feature';
import type { Sim } from '../../core/sim';
import { hasAirplane } from '../airplane';
import { teachRecipe } from '../crafting';
import { getRecipeDef } from '../crafting/defs';
import { giveItem } from '../inventory/give';
import { isHoldingItem, selectItem } from '../inventory/held';
import { isFlagReached } from '../flag';
import { getPlayerBody } from '../player/body';
import { LETTER, getLetterDef, type LetterDef } from './defs';
import { fallenItemSlice, letterSlice, lettersReadSlice } from './state';

/**
 * The letter a level leaves on the floor. Interacting next to it reads it,
 * which teaches its recipe and puts the item the recipe is made from in the stick man's
 * hand; interacting again or walking away puts it away, and then it is gone:
 * what it taught the stick man knows for good. What the stick man can lose is the item. A level
 * that starts again for the stick man who has read its letter and has nothing left of
 * what it was for gives the stick man what its recipe makes at once. And whenever the stick man
 * loses everything it was for without dying, the item itself falls from the
 * sky to where the stick man stands, and interacting next to it picks it up. So the stick man can
 * never be left without a way on.
 */
export const letterFeature: Feature = {
  name: 'letter',
  slices: [letterSlice, lettersReadSlice, fallenItemSlice],

  init(sim) {
    const placed = findLetterPlacedIn(sim.levelDef);
    const def = placed && getLetterDef(placed.defId);
    if (!def) {
      return;
    }
    const hasReadLetter = sim.getStateOf(lettersReadSlice).includes(def.id);
    // A letter the stick man has read before does not lie there again when the level starts again.
    sim.getStateOf(letterSlice).isInLevel = !hasReadLetter;
    const hasLostRecipeResult = hasReadLetter && !hasRecipeResult(sim, def);
    if (!hasLostRecipeResult) {
      return;
    }
    // The stick man has learned what it teaches and lost what the stick man made of it with the
    // level: the stick man starts again with that in the stick man's hand.
    const made = getRecipeDef(def.teachesRecipe)?.makes ?? def.gives;
    if (giveItem(sim, made)) {
      selectItem(sim, made);
    }
  },

  update(sim) {
    const placed = findLetterPlacedIn(sim.levelDef);
    if (!placed) {
      return;
    }
    const def = getLetterDef(placed.defId);
    if (!def) {
      return;
    }
    const hasWalkedAwayReading =
      sim.getStateOf(letterSlice).isBeingRead && !isWithinReach(sim, placed.position);
    if (hasWalkedAwayReading) {
      putAway(sim);
    }
    const fallen = sim.getStateOf(fallenItemSlice);
    if (fallen.isInLevel) {
      fallen.height = Math.max(0, fallen.height - LETTER.fallSpeed * sim.dt);
      return;
    }
    // The letter that still lies there gives it; with the flag reached the stick man needs none.
    const isItemNeeded =
      !hasRecipeResult(sim, def) && !sim.getStateOf(letterSlice).isInLevel && !isFlagReached(sim);
    if (!isItemNeeded) {
      fallen.ticksUntilFall = null;
    } else if (fallen.ticksUntilFall === null) {
      fallen.ticksUntilFall = Math.round(LETTER.fallsAfter / sim.dt);
    } else if (fallen.ticksUntilFall > 0) {
      fallen.ticksUntilFall -= 1;
    } else if (getPlayerBody(sim).isOnFloor) {
      // It comes down where the stick man stands, so the stick man sees it and has it at the stick
      // man's feet. In the air the stick man has no place for it yet: it waits for the stick man to
      // land.
      const { x, y } = getPlayerBody(sim);
      fallen.ticksUntilFall = null;
      fallen.isInLevel = true;
      fallen.x = x;
      fallen.y = y;
      fallen.height = LETTER.fallsFromHeight;
    }
  },
};

/** Where the level's letter lies, or undefined for a level without one. */
export function findLetterPlacedIn(level: Level): Placement | undefined {
  return level.placements.find((placement) => getLetterDef(placement.defId) !== undefined);
}

/** True while the stick man reads a letter. */
export function isReadingLetter(sim: Sim): boolean {
  return sim.getStateOf(letterSlice).isBeingRead;
}

/**
 * What interacting does while the stick man reads a letter, for `features/world`: the stick man
 * puts it away, and the press does nothing else.
 */
export function getLetterBeingRead(sim: Sim) {
  if (!sim.getStateOf(letterSlice).isBeingRead) {
    return undefined;
  }
  return { means: 'putLetterAway' as const, perform: () => putAway(sim) };
}

/**
 * What interacting does next to a letter that lies on the floor, for `features/world`: the stick
 * man reads it.
 */
export function getLetterInteraction(sim: Sim) {
  const placed = findLetterPlacedIn(sim.levelDef);
  const def = placed && getLetterDef(placed.defId);
  const letter = sim.getStateOf(letterSlice);
  const canRead =
    placed !== undefined &&
    def !== undefined &&
    letter.isInLevel &&
    !letter.isBeingRead &&
    isWithinReach(sim, placed.position);
  if (!canRead) {
    return undefined;
  }
  return {
    means: 'read' as const,
    perform: () => {
      letter.isBeingRead = true;
      const lettersRead = sim.getStateOf(lettersReadSlice);
      if (!lettersRead.includes(def.id)) {
        lettersRead.push(def.id);
      }
      teachRecipe(sim, def.teachesRecipe);
      if (!hasRecipeResult(sim, def)) {
        giveItem(sim, def.gives);
      }
      // What the letter is about is in the stick man's hand when the stick man looks up from it, so
      // the key that uses it has a use at once.
      selectItem(sim, def.gives);
    },
  };
}

/**
 * What interacting does next to the item that fell from the sky, once it lies on the floor, for
 * `features/world`: the stick man picks it up, into the stick man's hand.
 */
export function getFallenItemInteraction(sim: Sim) {
  const placed = findLetterPlacedIn(sim.levelDef);
  const def = placed && getLetterDef(placed.defId);
  const fallen = sim.getStateOf(fallenItemSlice);
  const canPickUp =
    def !== undefined && fallen.isInLevel && fallen.height <= 0 && isWithinReach(sim, fallen);
  if (!canPickUp) {
    return undefined;
  }
  return {
    means: 'pickUp' as const,
    perform: () => {
      if (!giveItem(sim, def.gives)) {
        return;
      }
      selectItem(sim, def.gives);
      fallen.isInLevel = false;
    },
  };
}

// ---- Helpers ----

/**
 * The stick man stops reading, and the letter it was reading is gone. Nothing changes when the
 * stick man is not reading.
 */
function putAway(sim: Sim): void {
  const letter = sim.getStateOf(letterSlice);
  if (!letter.isBeingRead) {
    return;
  }
  letter.isBeingRead = false;
  letter.isInLevel = false;
}

/**
 * True while the stick man stands on the floor within reach of something that lies at `position`:
 * the letter, or the item that fell.
 */
function isWithinReach(sim: Sim, position: { readonly x: number }): boolean {
  const player = getPlayerBody(sim);
  return player.isOnFloor && Math.abs(player.x - position.x) <= LETTER.reach;
}

/**
 * True while the stick man still has the item the letter gives, or what its recipe makes of that
 * item. The only thing a recipe makes that leaves the stick man's slots for the world is the
 * airplane, so that is the one asked about here.
 */
function hasRecipeResult(sim: Sim, def: LetterDef): boolean {
  const made = getRecipeDef(def.teachesRecipe)?.makes;
  return (
    isHoldingItem(sim, def.gives) ||
    (made !== undefined && isHoldingItem(sim, made)) ||
    hasAirplane(sim)
  );
}

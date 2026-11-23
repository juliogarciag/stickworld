import { flagOf, interactionOf, itemSlotsOf, itemUseOf, letterOf, recipeListOf, stickManOf } from '@stickworld/sim';
import Phaser from 'phaser';
import { itemSlotStrokes } from '../hud/itemSlots';
import { letterSheetStrokes, recipeListStrokes } from '../hud/panels';
import { promptsFor, promptStrokes } from '../hud/prompts';
import { gameIsOver, theEndStrokes } from '../hud/theEnd';
import { keptWhileUnchanged } from '../hud/unchanged';
import { ACTION_KEY_NAMES } from '../input/actionKeys';
import { FLIGHT_KEY_NAMES } from '../input/playerKeys';
import type { GameLoop } from '../loop/GameLoop';
import { worldSeenBy } from '../render/cameraView';
import { levelZoom } from '../render/levelCamera';
import { createStrokeLayer, type Stroke, type StrokeLayer } from '../render/strokes';

/**
 * What is shown over the sheet of paper and does not move with it: the item
 * slots, the letter he reads or the list of recipes he looks at, what the
 * keys would do right now, and the words that end the game. It runs beside the level scene, after it, so it is drawn above the
 * paper's tooth and reads the sim the level scene has just advanced. Its
 * camera never scrolls and keeps the level's zoom, so a HUD line is as heavy
 * as a line of the level.
 */
export class HudScene extends Phaser.Scene {
  private itemSlots!: StrokeLayer;
  private heldUp!: StrokeLayer;
  private prompts!: StrokeLayer;
  private theEnd!: StrokeLayer;
  private readonly strokesOfWhatIsHeldUp = keptWhileUnchanged<Stroke[]>();
  private readonly strokesOfPrompts = keptWhileUnchanged<Stroke[]>();
  private readonly strokesOfTheEnd = keptWhileUnchanged<Stroke[]>();

  constructor(private readonly loop: GameLoop) {
    super({ key: HUD_SCENE, active: true });
  }

  create(): void {
    this.itemSlots = createStrokeLayer(this);
    this.heldUp = createStrokeLayer(this);
    this.prompts = createStrokeLayer(this);
    this.theEnd = createStrokeLayer(this);
  }

  override update(): void {
    const camera = this.cameras.main;
    camera.setZoom(levelZoom(camera));
    const { sim } = this.loop;
    const seen = worldSeenBy(camera);
    this.itemSlots.show(itemSlotStrokes(itemSlotsOf(sim), seen));

    const letter = letterOf(sim);
    const recipeList = recipeListOf(sim);
    const reading = letter?.beingRead ? letter.text : null;
    this.heldUp.show(
      this.strokesOfWhatIsHeldUp(JSON.stringify([reading, recipeList, seen]), () => {
        if (reading !== null) return letterSheetStrokes(reading, seen);
        return recipeList.open ? recipeListStrokes(recipeList, seen) : [];
      }),
    );

    const prompts = promptsFor({
      itemUse: itemUseOf(sim),
      useItemKey: ACTION_KEY_NAMES.useItem,
      interaction: interactionOf(sim),
      interactKey: ACTION_KEY_NAMES.interact,
      flying: stickManOf(sim).action === 'seated',
      flightKeys: FLIGHT_KEY_NAMES,
    });
    this.prompts.show(this.strokesOfPrompts(JSON.stringify([prompts, seen]), () => promptStrokes(prompts, seen)));

    const over = gameIsOver(flagOf(sim));
    this.theEnd.show(this.strokesOfTheEnd(JSON.stringify([over, seen]), () => (over ? theEndStrokes(seen) : [])));
  }
}

export const HUD_SCENE = 'hud';

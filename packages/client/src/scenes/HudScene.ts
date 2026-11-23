import { interactionOf, itemSlotsOf, itemUseOf, letterOf, recipeListOf } from '@stickworld/sim';
import Phaser from 'phaser';
import { itemSlotStrokes } from '../hud/itemSlots';
import { letterSheetStrokes, recipeListStrokes } from '../hud/panels';
import { promptsFor, promptStrokes } from '../hud/prompts';
import { keptWhileUnchanged } from '../hud/unchanged';
import { ACTION_KEY_NAMES } from '../input/actionKeys';
import type { GameLoop } from '../loop/GameLoop';
import { worldSeenBy } from '../render/cameraView';
import { levelZoom } from '../render/levelCamera';
import { createStrokeLayer, type Stroke, type StrokeLayer } from '../render/strokes';

/**
 * What is shown over the sheet of paper and does not move with it: the item
 * slots, the letter he reads or the list of recipes he looks at, and what the
 * two action keys would do right now. It runs beside the level scene, after it, so it is drawn above the
 * paper's tooth and reads the sim the level scene has just advanced. Its
 * camera never scrolls and keeps the level's zoom, so a HUD line is as heavy
 * as a line of the level.
 */
export class HudScene extends Phaser.Scene {
  private itemSlots!: StrokeLayer;
  private heldUp!: StrokeLayer;
  private prompts!: StrokeLayer;
  private readonly heldUpStrokes = keptWhileUnchanged<Stroke[]>();
  private readonly promptsStrokes = keptWhileUnchanged<Stroke[]>();

  constructor(private readonly loop: GameLoop) {
    super({ key: HUD_SCENE, active: true });
  }

  create(): void {
    this.itemSlots = createStrokeLayer(this);
    this.heldUp = createStrokeLayer(this);
    this.prompts = createStrokeLayer(this);
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
      this.heldUpStrokes(JSON.stringify([reading, recipeList, seen]), () => {
        if (reading !== null) return letterSheetStrokes(reading, seen);
        return recipeList.open ? recipeListStrokes(recipeList, seen) : [];
      }),
    );

    const prompts = promptsFor({ itemUse: itemUseOf(sim), useItemKey: ACTION_KEY_NAMES.useItem, interaction: interactionOf(sim), interactKey: ACTION_KEY_NAMES.interact });
    this.prompts.show(this.promptsStrokes(JSON.stringify([prompts, seen]), () => promptStrokes(prompts, seen)));
  }
}

export const HUD_SCENE = 'hud';

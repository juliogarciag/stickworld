import { craftingOf, flagOf, gameOf, interactionOf, itemSlotsOf, itemUseOf, letterOf, stickManOf } from '@stickworld/sim';
import Phaser from 'phaser';
import { itemSlotStrokes } from '../hud/itemSlots';
import { pageEdgeStrokes } from '../hud/pageEdge';
import { letterSheetStrokes } from '../hud/panels';
import { promptsFor, promptStrokes } from '../hud/prompts';
import { shareOfTheEndWritten, theEndIsShown, theEndStrokes } from '../hud/theEnd';
import { keptWhileUnchanged } from '../hud/unchanged';
import { ACTION_KEY_NAMES } from '../input/actionKeys';
import { GAME_KEY_NAMES } from '../input/gameKeys';
import { FLIGHT_KEY_NAMES } from '../input/playerKeys';
import type { GameLoop } from '../loop/GameLoop';
import { worldSeenBy } from '../render/cameraView';
import { zoomAtRest } from '../render/levelCamera';
import type { PageTurn } from '../render/pageTurn';
import { createStrokeLayer, type Stroke, type StrokeLayer } from '../render/strokes';
import { everyFrameAfterTheLevel } from './afterTheLevel';

/**
 * What is shown over the sheet of paper and does not move with it: the item
 * slots, the letter he reads, what the keys would do right now, the words
 * that end the game with the key that plays it again, and the edge of a
 * sheet that is being turned away. It runs beside the level scene and is
 * drawn after it, above the paper's tooth, from the sim the level scene has
 * just advanced (`everyFrameAfterTheLevel`). Its camera never scrolls and keeps the zoom the
 * level has at rest, so a HUD line is as heavy as a line of the level and
 * the HUD stays the size it is when the level's camera pulls back.
 */
export class HudScene extends Phaser.Scene {
  private itemSlots!: StrokeLayer;
  private heldUp!: StrokeLayer;
  private prompts!: StrokeLayer;
  private theEnd!: StrokeLayer;
  private pageEdge!: StrokeLayer;
  private readonly strokesOfWhatIsHeldUp = keptWhileUnchanged<Stroke[]>();
  private readonly strokesOfPrompts = keptWhileUnchanged<Stroke[]>();
  private readonly strokesOfTheEnd = keptWhileUnchanged<Stroke[]>();
  private readonly strokesOfThePageEdge = keptWhileUnchanged<Stroke[]>();

  constructor(
    private readonly loop: GameLoop,
    private readonly pageTurn: PageTurn,
  ) {
    super({ key: HUD_SCENE, active: true });
  }

  create(): void {
    this.itemSlots = createStrokeLayer(this);
    this.heldUp = createStrokeLayer(this);
    this.prompts = createStrokeLayer(this);
    this.theEnd = createStrokeLayer(this);
    this.pageEdge = createStrokeLayer(this);
    everyFrameAfterTheLevel(this, () => this.draw());
  }

  private draw(): void {
    const camera = this.cameras.main;
    camera.setZoom(zoomAtRest(camera));
    const { sim } = this.loop;
    const seen = worldSeenBy(camera);
    this.itemSlots.show(itemSlotStrokes(itemSlotsOf(sim), seen));

    const letter = letterOf(sim);
    const reading = letter?.beingRead ? { text: letter.text, teaches: letter.teaches } : null;
    this.heldUp.show(this.strokesOfWhatIsHeldUp(JSON.stringify([reading, seen]), () => (reading === null ? [] : letterSheetStrokes(reading, seen))));

    const prompts = promptsFor({
      itemUse: itemUseOf(sim),
      wouldMake: craftingOf(sim).canMake?.name ?? null,
      useItemKey: ACTION_KEY_NAMES.useItem,
      interaction: interactionOf(sim),
      interactKey: ACTION_KEY_NAMES.interact,
      seated: stickManOf(sim).action === 'seated',
      flightKeys: FLIGHT_KEY_NAMES,
    });
    this.prompts.show(this.strokesOfPrompts(JSON.stringify([prompts, seen]), () => promptStrokes(prompts, seen)));

    const flag = flagOf(sim);
    const theEnd = theEndIsShown(flag) && flag ? { shareWritten: shareOfTheEndWritten(flag.upFor), playAgainKey: gameOf(sim).playingAgainOffered ? GAME_KEY_NAMES.playAgain : null } : null;
    this.theEnd.show(this.strokesOfTheEnd(JSON.stringify([theEnd, seen]), () => (theEnd ? theEndStrokes(theEnd, seen) : [])));

    const edgeAt = this.pageTurn.now()?.edgeAt ?? null;
    this.pageEdge.show(this.strokesOfThePageEdge(JSON.stringify([edgeAt, seen]), () => (edgeAt === null ? [] : pageEdgeStrokes(edgeAt, seen))));
  }
}

export const HUD_SCENE = 'hud';

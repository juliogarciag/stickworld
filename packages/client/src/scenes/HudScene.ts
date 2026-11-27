import { getCrafting, getFlag, getFlyingHint, getGame, getInteraction, getItemSlots, getItemUse, getLetter, getStickMan } from '@stickworld/sim';
import Phaser from 'phaser';
import { buildItemSlotStrokes } from '../hud/itemSlots';
import { buildPageEdgeStrokes } from '../hud/pageEdge';
import { buildLetterSheetStrokes } from '../hud/panels';
import { getPromptsFor, buildPromptStrokes } from '../hud/prompts';
import { getShareOfTheEndWritten, isTheEndShown, buildTheEndStrokes } from '../hud/theEnd';
import { keepWhileUnchanged } from '../hud/unchanged';
import { ACTION_KEY_NAMES } from '../input/actionKeys';
import { GAME_KEY_NAMES } from '../input/gameKeys';
import { FLIGHT_KEY_NAMES } from '../input/playerKeys';
import type { GameLoop } from '../loop/GameLoop';
import { getWorldSeenBy } from '../render/cameraView';
import { getZoomAtRest } from '../render/levelCamera';
import type { PageTurn } from '../render/pageTurn';
import { createStrokeLayer, type Stroke, type StrokeLayer } from '../render/strokes';
import { runEveryFrameAfterTheLevel } from './afterTheLevel';

/**
 * What is shown over the sheet of paper and does not move with it: the item
 * slots, the letter he reads, what the keys would do right now, the words
 * that end the game with the key that plays it again, and the edge of a
 * sheet that is being turned away. It runs beside the level scene and is
 * drawn after it, above the paper's tooth, from the sim the level scene has
 * just advanced (`runEveryFrameAfterTheLevel`). Its camera never scrolls and keeps the zoom the
 * level has at rest, so a HUD line is as heavy as a line of the level and
 * the HUD stays the size it is when the level's camera pulls back.
 */
export class HudScene extends Phaser.Scene {
  private itemSlots!: StrokeLayer;
  private heldUp!: StrokeLayer;
  private prompts!: StrokeLayer;
  private theEnd!: StrokeLayer;
  private pageEdge!: StrokeLayer;
  private readonly strokesOfWhatIsHeldUp = keepWhileUnchanged<Stroke[]>();
  private readonly strokesOfPrompts = keepWhileUnchanged<Stroke[]>();
  private readonly strokesOfTheEnd = keepWhileUnchanged<Stroke[]>();
  private readonly strokesOfThePageEdge = keepWhileUnchanged<Stroke[]>();

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
    runEveryFrameAfterTheLevel(this, () => this.draw());
  }

  private draw(): void {
    const camera = this.cameras.main;
    camera.setZoom(getZoomAtRest(camera));
    const { sim } = this.loop;
    const seen = getWorldSeenBy(camera);
    this.itemSlots.show(buildItemSlotStrokes(getItemSlots(sim), seen));

    const letter = getLetter(sim);
    const reading = letter?.beingRead ? { text: letter.text, teaches: letter.teaches } : null;
    this.heldUp.show(this.strokesOfWhatIsHeldUp(JSON.stringify([reading, seen]), () => (reading === null ? [] : buildLetterSheetStrokes(reading, seen))));

    const prompts = getPromptsFor({
      itemUse: getItemUse(sim),
      wouldMake: getCrafting(sim).canMake?.name ?? null,
      useItemKey: ACTION_KEY_NAMES.useItem,
      interaction: getInteraction(sim),
      interactKey: ACTION_KEY_NAMES.interact,
      seated: getStickMan(sim).action === 'seated',
      flightKeys: FLIGHT_KEY_NAMES,
      flyingHint: getFlyingHint(sim),
    });
    this.prompts.show(this.strokesOfPrompts(JSON.stringify([prompts, seen]), () => buildPromptStrokes(prompts, seen)));

    const flag = getFlag(sim);
    const theEnd = isTheEndShown(flag) && flag ? { shareWritten: getShareOfTheEndWritten(flag.upFor), playAgainKey: getGame(sim).playingAgainOffered ? GAME_KEY_NAMES.playAgain : null } : null;
    this.theEnd.show(this.strokesOfTheEnd(JSON.stringify([theEnd, seen]), () => (theEnd ? buildTheEndStrokes(theEnd, seen) : [])));

    const edgeAt = this.pageTurn.getTurningPage()?.edgeAt ?? null;
    this.pageEdge.show(this.strokesOfThePageEdge(JSON.stringify([edgeAt, seen]), () => (edgeAt === null ? [] : buildPageEdgeStrokes(edgeAt, seen))));
  }
}

export const HUD_SCENE = 'hud';

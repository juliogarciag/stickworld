import {
  getAirplane,
  getEnemies,
  getFallenItem,
  getFlag,
  getItemSlots,
  getLetter,
  getLevel,
  getNotes,
  getSpear,
  getStickMan,
  type SimHandle,
} from '@stickworld/sim';
import type Phaser from 'phaser';
import { keepUntilChanged } from '../hud/unchanged';
import { MOVE_KEY_NAMES } from '../input/playerKeys';
import { easeAirplanesOverTime, buildAirplaneStrokes, getPivotHeight } from '../render/airplane';
import { getWorldSeenBy } from '../render/cameraView';
import { buildClubEnemyStrokes } from '../render/clubEnemy';
import { buildFlagStrokes } from '../render/flag';
import { buildFloorStrokes } from '../render/floor';
import { buildHeldItemStrokes, getHeldItem } from '../render/heldItem';
import { buildFallenPaperStrokes, buildLetterStrokes } from '../render/letter';
import { getZoomAtRest } from '../render/levelCamera';
import { areNotesStill, buildNoteStrokes } from '../render/notes';
import { layPaper, type Paper } from '../render/paper';
import {
  getLevelNameState,
  buildLevelNameStrokes,
  buildPageNumberStrokes,
} from '../render/sheetWords';
import { easePosesOverTime, seatIn, buildStickManStrokes } from '../render/stickMan';
import { createStrokeLayer, type Stroke, type StrokeLayer } from '../render/strokes';
import { getRubbedOutSoFar } from '../render/strokes/partly';

/** The one empty list: a layer shown it again does not draw anew. */
const NOTHING: readonly Stroke[] = [];

/** What a sheet is shown to draw itself. */
export interface SheetFrame {
  /** The sim whose level this sheet is. */
  readonly sim: SimHandle;
  /** How long ago the last frame was. */
  readonly seconds: number;
  /**
   * How long this sheet has been the one on top: what was written as it arrived is rubbed out a few
   * seconds later.
   */
  readonly secondsOnSheet: number;
}

/**
 * One sheet of paper with a level drawn on it, in a scene of its own camera:
 * the paper, what is written on it (the level's name, its notes, the page
 * number), the floor line, the flag, the letter or the sheet of paper that
 * fell in its place, the airplane, the enemies, what the stick man holds in its hand and the
 * stick man, each as the sim it is shown says it is. The level being played is one
 * of these, and so is the sheet that is turned away when a level is finished.
 */
export class Sheet {
  private readonly paper: Paper;
  private readonly written: StrokeLayer;
  private readonly pageNumber: StrokeLayer;
  private readonly floor: StrokeLayer;
  private readonly flag: StrokeLayer;
  private readonly letter: StrokeLayer;
  private readonly airplane: StrokeLayer;
  private readonly enemies: StrokeLayer;
  private readonly heldItem: StrokeLayer;
  private readonly stickMan: StrokeLayer;
  private readonly poseFor = easePosesOverTime();
  private readonly airplaneShownFor = easeAirplanesOverTime();
  private readonly getWrittenStrokes = keepUntilChanged<readonly Stroke[]>();
  private readonly getPageNumberStrokes = keepUntilChanged<Stroke[]>();

  constructor(private readonly scene: Phaser.Scene) {
    this.paper = layPaper(scene);
    this.written = createStrokeLayer(scene);
    this.pageNumber = createStrokeLayer(scene);
    this.floor = createStrokeLayer(scene);
    this.flag = createStrokeLayer(scene);
    this.letter = createStrokeLayer(scene);
    this.airplane = createStrokeLayer(scene);
    this.enemies = createStrokeLayer(scene);
    this.heldItem = createStrokeLayer(scene);
    this.stickMan = createStrokeLayer(scene);
  }

  /**
   * Takes everything off the sheet: its layers have nothing to draw, or to redraw as they boil,
   * until it is drawn again.
   */
  clear(): void {
    for (const layer of [
      this.written,
      this.pageNumber,
      this.floor,
      this.flag,
      this.letter,
      this.airplane,
      this.enemies,
      this.heldItem,
      this.stickMan,
    ]) {
      layer.show(NOTHING);
    }
  }

  /**
   * Draws the sheet as the scene's camera sees it right now. Call after moving the camera, every
   * frame.
   */
  draw(frame: SheetFrame): void {
    const camera = this.scene.cameras.main;
    const level = getLevel(frame.sim);
    const stickMan = getStickMan(frame.sim);
    const flag = getFlag(frame.sim);
    const letter = getLetter(frame.sim);
    const notes = getNotes(frame.sim);
    const airplane = this.airplaneShownFor(getAirplane(frame.sim), frame.seconds);

    this.paper.cover(camera);
    // Writing that does not change is the same list every frame, which a layer does not draw anew;
    // while some of it is being written or rubbed out it is made again each frame.
    const levelName = getLevelNameState(frame.secondsOnSheet);
    const isWritingStill =
      areNotesStill(notes) && levelName !== 'beingWritten' && levelName !== 'beingRubbedOut';
    // The notes first: a stroke's place in the list is what its wobble comes from, and the name's
    // strokes come and go.
    const buildWrittenStrokes = (): readonly Stroke[] => [
      ...buildNoteStrokes(notes, MOVE_KEY_NAMES),
      ...buildLevelNameStrokes(level, frame.secondsOnSheet),
    ];
    this.written.show(
      isWritingStill
        ? this.getWrittenStrokes(
            JSON.stringify([level.id, notes.map((note) => note.rubbedOutFor !== null), levelName]),
            buildWrittenStrokes,
          )
        : buildWrittenStrokes(),
    );
    const seen = getWorldSeenBy(camera);
    this.pageNumber.show(
      this.getPageNumberStrokes(JSON.stringify([level.id, seen]), () =>
        buildPageNumberStrokes({ page: level.id, seen, zoomAtRest: getZoomAtRest(camera) }),
      ),
    );
    this.floor.show(buildFloorStrokes(level));
    this.flag.show(flag ? buildFlagStrokes(flag) : []);
    // One layer for both: the sheet only ever falls where a letter no longer lies.
    const fallenItem = getFallenItem(frame.sim);
    this.letter.show(
      letter ? buildLetterStrokes(letter) : fallenItem ? buildFallenPaperStrokes(fallenItem) : [],
    );
    this.airplane.show(airplane ? buildAirplaneStrokes(airplane) : []);
    // Every enemy is a club enemy so far. A second kind has its own drawing, picked here by the
    // `kind` of each enemy. One that was struck is rubbed out line by line, in the order it is
    // drawn, as far as the sim says.
    this.enemies.show(
      getEnemies(frame.sim).flatMap((enemy) =>
        getRubbedOutSoFar(
          buildClubEnemyStrokes(enemy, frame.secondsOnSheet),
          enemy.rubbedOutProgress ?? 0,
        ),
      ),
    );
    // The pencil or the spear in its hand, under the stick man's own lines: its hand is on it.
    const heldItem = getHeldItem({
      stickMan,
      itemDefId: getItemSlots(frame.sim).find((slot) => slot.isSelected)?.itemDefId ?? null,
      spear: getSpear(frame.sim),
    });
    this.heldItem.show(heldItem ? buildHeldItemStrokes(heldItem) : NOTHING);
    const eased = this.poseFor(stickMan, frame.seconds, level.floor);
    const pose = { ...eased, handAt: heldItem?.hand ?? null };
    // Seated, the stick man tips with the airplane as it is drawn, about the point it is drawn
    // turning about: its middle.
    this.stickMan.show(
      buildStickManStrokes(
        airplane
          ? seatIn(pose, { noseDown: airplane.noseDown, tipsAboutAbove: getPivotHeight(airplane) })
          : pose,
      ),
    );
  }
}

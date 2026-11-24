import { airplaneOf, flagOf, letterOf, levelOf, notesOf, stickManOf, type SimHandle } from '@stickworld/sim';
import type Phaser from 'phaser';
import { keptWhileUnchanged } from '../hud/unchanged';
import { MOVE_KEY_NAMES } from '../input/playerKeys';
import { airplanesEasedOverTime, airplaneStrokes, heightItTurnsAbout } from '../render/airplane';
import { worldSeenBy } from '../render/cameraView';
import { flagStrokes } from '../render/flag';
import { floorStrokes } from '../render/floor';
import { letterStrokes } from '../render/letter';
import { zoomAtRest } from '../render/levelCamera';
import { notesAreStill, noteStrokes } from '../render/notes';
import { layPaper, type Paper } from '../render/paper';
import { levelNameIs, levelNameStrokes, pageNumberStrokes } from '../render/sheetWords';
import { posesEasedOverTime, seatedIn, stickManStrokes } from '../render/stickMan';
import { createStrokeLayer, type Stroke, type StrokeLayer } from '../render/strokes';

/** The one empty list: a layer shown it again does not draw anew. */
const NOTHING: readonly Stroke[] = [];

/** What a sheet is shown to draw itself. */
export interface SheetNow {
  /** The sim whose level this sheet is. */
  readonly sim: SimHandle;
  /** How long ago the last frame was. */
  readonly seconds: number;
  /** How long this sheet has been the one on top: what was written as it arrived is rubbed out a few seconds later. */
  readonly secondsOnTheSheet: number;
}

/**
 * One sheet of paper with a level drawn on it, in a scene of its own camera:
 * the paper, what is written on it (the level's name, its notes, the page
 * number), the floor line, the flag, the letter, the airplane and the stick
 * man, each as the sim it is shown says it is. The level being played is one
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
  private readonly stickMan: StrokeLayer;
  private readonly poseFor = posesEasedOverTime();
  private readonly airplaneShownFor = airplanesEasedOverTime();
  private readonly strokesOfWhatIsWritten = keptWhileUnchanged<readonly Stroke[]>();
  private readonly strokesOfThePageNumber = keptWhileUnchanged<Stroke[]>();

  constructor(private readonly scene: Phaser.Scene) {
    this.paper = layPaper(scene);
    this.written = createStrokeLayer(scene);
    this.pageNumber = createStrokeLayer(scene);
    this.floor = createStrokeLayer(scene);
    this.flag = createStrokeLayer(scene);
    this.letter = createStrokeLayer(scene);
    this.airplane = createStrokeLayer(scene);
    this.stickMan = createStrokeLayer(scene);
  }

  /** Takes everything off the sheet: its layers have nothing to draw, or to redraw as they boil, until it is drawn again. */
  clear(): void {
    for (const layer of [this.written, this.pageNumber, this.floor, this.flag, this.letter, this.airplane, this.stickMan]) layer.show(NOTHING);
  }

  /** Draws the sheet as the scene's camera sees it right now. Call after moving the camera, every frame. */
  draw({ sim, seconds, secondsOnTheSheet }: SheetNow): void {
    const camera = this.scene.cameras.main;
    const level = levelOf(sim);
    const stickMan = stickManOf(sim);
    const flag = flagOf(sim);
    const letter = letterOf(sim);
    const notes = notesOf(sim);
    const airplane = this.airplaneShownFor(airplaneOf(sim), seconds);

    this.paper.cover(camera);
    // Writing that does not change is the same list every frame, which a layer does not draw anew; while some of it is being written or rubbed out it is made again each frame.
    const levelName = levelNameIs(secondsOnTheSheet);
    const writingIsStill = notesAreStill(notes) && levelName !== 'beingWritten' && levelName !== 'beingRubbedOut';
    // The notes first: a stroke's place in the list is what its wobble comes from, and the name's strokes come and go.
    const whatIsWritten = (): readonly Stroke[] => [...noteStrokes(notes, MOVE_KEY_NAMES), ...levelNameStrokes(level, secondsOnTheSheet)];
    this.written.show(writingIsStill ? this.strokesOfWhatIsWritten(JSON.stringify([level.id, notes.map((note) => note.rubbedOutFor !== null), levelName]), whatIsWritten) : whatIsWritten());
    const seen = worldSeenBy(camera);
    this.pageNumber.show(this.strokesOfThePageNumber(JSON.stringify([level.id, seen]), () => pageNumberStrokes({ page: level.id, seen, zoomAtRest: zoomAtRest(camera) })));
    this.floor.show(floorStrokes(level));
    this.flag.show(flag ? flagStrokes(flag) : []);
    this.letter.show(letter ? letterStrokes(letter) : []);
    this.airplane.show(airplane ? airplaneStrokes(airplane) : []);
    const pose = this.poseFor(stickMan, seconds, level.floor);
    // Seated, he tips with the airplane as it is drawn, about the point it is drawn turning about: its middle.
    this.stickMan.show(stickManStrokes(airplane ? seatedIn(pose, { noseDown: airplane.noseDown, tipsAboutAbove: heightItTurnsAbout(airplane) }) : pose));
  }
}

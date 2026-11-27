import type { FallenItemView, LetterView, Point } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { convertToPixels } from './units';

/**
 * The level's letter as pencil strokes: an envelope standing on the floor.
 * Nothing while he reads it: then it is in his hands, and the HUD shows what
 * it says.
 */
export function buildLetterStrokes(letter: LetterView): Stroke[] {
  if (letter.isBeingRead) return [];
  const getCorner = (across: number, up: number): Point => turnAbout(letter.position, { x: letter.position.x + (across - 0.5) * ENVELOPE.width, y: letter.position.y - up * ENVELOPE.height }, ENVELOPE.lean);
  return [
    { points: [getCorner(0, 0), getCorner(0, 1), getCorner(1, 1), getCorner(1, 0)].map(convertPointToPixels), thickness: PENCIL.thickness, isClosed: true },
    { points: [getCorner(0, 1), getCorner(0.5, 0.42), getCorner(1, 1)].map(convertPointToPixels), thickness: PENCIL.thickness },
  ];
}

/**
 * The sheet of paper that falls from the sky for him who has lost his, as pencil strokes: swaying on its way down,
 * and lying on the floor once it is there, a corner of it turned up.
 */
export function buildFallenPaperStrokes(fallenItem: FallenItemView): Stroke[] {
  // Paper comes down swinging from side to side, less and less as it nears the floor.
  const swing = Math.min(1, fallenItem.height / SHEET.settlesBelow);
  const foot = { x: fallenItem.position.x + swing * SHEET.sway * Math.sin(fallenItem.height * SHEET.swaysPerMetre), y: fallenItem.position.y - fallenItem.height };
  const lean = SHEET.lean + swing * SHEET.rock * Math.cos(fallenItem.height * SHEET.swaysPerMetre);
  // Seen almost edge on as it lies: a sheet is wide and not tall.
  const getCorner = (across: number, up: number): Point => turnAbout(foot, { x: foot.x + (across - 0.5) * SHEET.width, y: foot.y - up * SHEET.height }, lean);
  return [
    { points: [getCorner(0, 0), getCorner(0.12, 1), getCorner(0.8, 1), getCorner(1, 0.55), getCorner(0.92, 0)].map(convertPointToPixels), thickness: PENCIL.thickness, isClosed: true },
    { points: [getCorner(0.8, 1), getCorner(0.82, 0.5), getCorner(1, 0.55)].map(convertPointToPixels), thickness: PENCIL.thickness * 0.7 },
  ];
}

// ---- Helpers ----

/** The envelope's shape in metres. View detail only. */
const ENVELOPE = {
  width: 0.52,
  height: 0.34,
  /** How far it leans where it stands, in radians. */
  lean: 0.14,
} as const;

/** The fallen sheet's shape in metres and how it comes down. View detail only. */
const SHEET = {
  width: 0.6,
  height: 0.2,
  /** How far it is tipped where it lies, in radians. */
  lean: -0.05,
  /** How far to each side it swings on the way down, in metres, and how far it rocks, in radians. */
  sway: 0.45,
  rock: 0.5,
  /** How many radians of swing it goes through for each metre it comes down. */
  swaysPerMetre: 1.9,
  /** Below this height the swinging dies away, so it lies still the moment it lands. */
  settlesBelow: 1.5,
} as const;

function turnAbout(centre: Point, point: Point, angle: number): Point {
  const x = point.x - centre.x;
  const y = point.y - centre.y;
  return { x: centre.x + x * Math.cos(angle) - y * Math.sin(angle), y: centre.y + x * Math.sin(angle) + y * Math.cos(angle) };
}

const convertPointToPixels = (point: Point): Point => ({ x: convertToPixels(point.x), y: convertToPixels(point.y) });

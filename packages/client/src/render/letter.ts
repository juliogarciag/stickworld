import type { LetterView, Point } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { toPixels } from './units';

/**
 * The level's letter as pencil strokes: an envelope standing on the floor,
 * or swaying on its way down from the sky. Nothing while he reads it: then it
 * is in his hands, and the HUD shows what it says.
 */
export function letterStrokes({ at, height, beingRead }: LetterView): Stroke[] {
  if (beingRead) return [];
  // Paper comes down swinging from side to side, less and less as it nears the floor.
  const swing = Math.min(1, height / ENVELOPE.settlesBelow);
  const foot = { x: at.x + swing * ENVELOPE.sway * Math.sin(height * ENVELOPE.swaysPerMetre), y: at.y - height };
  const lean = ENVELOPE.lean + swing * ENVELOPE.rock * Math.cos(height * ENVELOPE.swaysPerMetre);
  const corner = (across: number, up: number): Point => turnedAbout(foot, { x: foot.x + (across - 0.5) * ENVELOPE.width, y: foot.y - up * ENVELOPE.height }, lean);
  return [
    { points: [corner(0, 0), corner(0, 1), corner(1, 1), corner(1, 0)].map(inPixels), thickness: PENCIL.thickness, closed: true },
    { points: [corner(0, 1), corner(0.5, 0.42), corner(1, 1)].map(inPixels), thickness: PENCIL.thickness },
  ];
}

// ---- Helpers ----

/** The envelope's shape in metres and how it comes down. View detail only. */
const ENVELOPE = {
  width: 0.52,
  height: 0.34,
  /** How far it leans where it stands, in radians. */
  lean: 0.14,
  /** How far to each side it swings on the way down, in metres, and how far it rocks, in radians. */
  sway: 0.45,
  rock: 0.5,
  /** How many radians of swing it goes through for each metre it comes down. */
  swaysPerMetre: 1.9,
  /** Below this height the swinging dies away, so it stands still the moment it lands. */
  settlesBelow: 1.5,
} as const;

function turnedAbout(centre: Point, point: Point, angle: number): Point {
  const x = point.x - centre.x;
  const y = point.y - centre.y;
  return { x: centre.x + x * Math.cos(angle) - y * Math.sin(angle), y: centre.y + x * Math.sin(angle) + y * Math.cos(angle) };
}

const inPixels = (point: Point): Point => ({ x: toPixels(point.x), y: toPixels(point.y) });

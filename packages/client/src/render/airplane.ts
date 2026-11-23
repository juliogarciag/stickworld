import type { AirplaneView, Point } from '@stickworld/sim';
import type { Stroke } from './strokes';
import { PENCIL } from './strokes/pencil';
import { toPixels } from './units';

/**
 * The paper airplane in the world as pencil strokes: a dart seen from the
 * side. Where it is, what is happening to it and where its nose points as it
 * flies come from the sim; how it is folded, how it gets from the floor to
 * his hands and how it noses down as it falls are decided here.
 */

/** The airplane as it is drawn this frame. */
export interface ShownAirplane {
  /** The middle of its underside, in metres. */
  readonly at: Point;
  readonly facing: 1 | -1;
  readonly length: number;
  readonly height: number;
  /** How far its nose points down, in radians; negative when it points up. */
  readonly noseDown: number;
}

/**
 * Returns a function to call every frame with the airplane as the sim has it
 * and the seconds since the last frame. It gives the airplane to draw: the
 * sim's, except that it takes a moment to get from the floor to over his head
 * and back, where the sim moves it in one tick, and that its nose takes a
 * moment to turn when the sim turns it at once (a stall, a landing). Once it
 * has caught up it is exactly where the sim says, and while it flies or lands
 * it always is: he sits in it. View detail only.
 */
export function airplanesEasedOverTime(): (airplane: AirplaneView | undefined, seconds: number) => ShownAirplane | undefined {
  let shown: { at: Point; noseDown: number } | undefined;
  return (airplane, seconds) => {
    if (!airplane) {
      shown = undefined;
      return undefined;
    }
    const noseDown = noseDownOf(airplane);
    if (!shown) {
      shown = { at: airplane.at, noseDown };
    } else {
      const inHisHands = airplane.state === 'resting' || airplane.state === 'carried';
      // Handled, it follows at its own pace; falling, it also keeps up with however fast it falls; flying and landing it is where the sim says.
      const reach = seconds * (HANDLING.speed + airplane.speed + Math.abs(airplane.verticalSpeed));
      const at = inHisHands || airplane.state === 'falling' ? movedTowards(shown.at, airplane.at, reach) : airplane.at;
      const turn = seconds * HANDLING.noseTurnRate;
      shown = { at, noseDown: shown.noseDown + Math.max(-turn, Math.min(turn, noseDown - shown.noseDown)) };
    }
    return { at: shown.at, facing: airplane.facing, length: airplane.length, height: airplane.height, noseDown: shown.noseDown };
  };
}

/** How far above its underside the point is that the airplane is drawn turning about, in metres: its middle. What sits in it turns about the same point. */
export function heightItTurnsAbout({ height }: { height: number }): number {
  return height / 2;
}

/** The strokes that draw the airplane, in world pixels: its outline, and the fold along its middle. */
export function airplaneStrokes({ at, facing, length, height, noseDown }: ShownAirplane): Stroke[] {
  const middle = { x: at.x, y: at.y - heightItTurnsAbout({ height }) };
  const part = ({ along, up }: { along: number; up: number }): Point => {
    const flat = { x: at.x + facing * along * length, y: at.y - up * height };
    const angle = facing * noseDown;
    const x = flat.x - middle.x;
    const y = flat.y - middle.y;
    return { x: toPixels(middle.x + x * Math.cos(angle) - y * Math.sin(angle)), y: toPixels(middle.y + x * Math.sin(angle) + y * Math.cos(angle)) };
  };
  return [
    { points: [DART.nose, DART.tailTop, DART.fold, DART.keel].map(part), thickness: PENCIL.thickness, closed: true },
    { points: [DART.nose, DART.fold].map(part), thickness: PENCIL.thickness },
  ];
}

// ---- Helpers ----

/** Where its nose points for what it is doing, in radians down: where the sim points it while it flies, further down the faster it falls, level otherwise. */
function noseDownOf(airplane: AirplaneView): number {
  if (airplane.state === 'flying') return -airplane.pitch;
  if (airplane.state === 'falling') return Math.min(HANDLING.mostNoseDown, airplane.verticalSpeed * HANDLING.noseDownPerSpeed);
  return 0;
}

/** The dart from the side: `along` is a share of its length from its middle towards the nose, `up` a share of its height from its underside. */
const DART = {
  nose: { along: 0.5, up: 0.2 },
  tailTop: { along: -0.5, up: 1 },
  /** Where the wing meets the body at the tail. */
  fold: { along: -0.42, up: 0.48 },
  /** The back of the keel it rests on. */
  keel: { along: -0.3, up: 0 },
} as const;

const HANDLING = {
  /** How fast it goes between the floor and his hands, in metres per second. Faster than he walks, so it catches up with him and then stays exactly where the sim says. */
  speed: 8,
  /** How far its nose goes down for each metre per second it falls, in radians, and the most it does. */
  noseDownPerSpeed: 0.16,
  mostNoseDown: 1.1,
  /** How fast its nose turns to where it should point, in radians per second: faster than it is ever steered, so in flight it is exactly where the sim points it. */
  noseTurnRate: 5,
} as const;

/** `from` moved towards `to` by at most `step`: `to` itself when it is within reach. */
function movedTowards(from: Point, to: Point, step: number): Point {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (distance <= step) return to;
  return { x: from.x + ((to.x - from.x) * step) / distance, y: from.y + ((to.y - from.y) * step) / distance };
}

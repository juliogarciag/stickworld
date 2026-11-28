import type { ClubEnemyView } from '@stickworld/sim';
import { buildClubEnemyStrokes } from './clubEnemy';
import type { Stroke, StrokePoint } from './strokes';
import { PENCIL } from './strokes/pencil';
import { buildTornClubEnemyStrokes } from './tornClubEnemy';
import { convertToPixels } from './units';

/**
 * TRYOUT (#44, comes out before merge): six things that may become of the halves of a torn enemy,
 * to be played and compared in a dev build with several enemies. The tear itself and the halves
 * lying for a moment are decided and are the sim's. Everything after that is faked here: the sim
 * still takes the enemy off its list when its `leaving` is over, and this file remembers what was
 * torn and goes on drawing it from the view's own clock, which a finished version would not do.
 */

/** What may become of the halves, in the order the switch goes through them. */
export const REMAINS_WAYS = [
  'carriedOff',
  'stayOnSheet',
  'stayInView',
  'fallOff',
  'settleIntoBits',
  'latestFew',
] as const;
export type RemainsWay = (typeof REMAINS_WAYS)[number];

/** What each is called on screen. */
export const REMAINS_WORDS: Readonly<Record<RemainsWay, string>> = {
  carriedOff: 'the halves are carried off the sheet',
  stayOnSheet: 'the halves stay until the page is turned',
  stayInView: 'the halves stay while they are in view',
  fallOff: 'the halves fall off the sheet',
  settleIntoBits: 'the halves settle into small scraps',
  latestFew: 'only the latest three stay',
};

/** How many torn enemies `latestFew` keeps, and how long an older one takes to be carried off. */
const LATEST_KEPT = 3;
const CARRY_OFF_SECONDS = 0.9;

let selectedWay: RemainsWay = 'carriedOff';
let clearings = 0;

/** The way that is tried right now. */
export function getRemainsWay(): RemainsWay {
  return selectedWay;
}

/** Tries the next way, and after the last the first. */
export function selectNextRemainsWay(): void {
  selectedWay = REMAINS_WAYS[(REMAINS_WAYS.indexOf(selectedWay) + 1) % REMAINS_WAYS.length]!;
}

/** Takes everything that lies on every sheet away, at once. */
export function clearTornRemains(): void {
  clearings += 1;
}

/** What a sheet shows its enemies with, every frame. */
export interface EnemiesFrame {
  /** The enemies as the sim has them right now. */
  readonly enemies: readonly ClubEnemyView[];
  /** The level they are on: what lies on one sheet does not lie on the next. */
  readonly level: number;
  /** How long ago the last frame was, and how long the sheet has been on top. */
  readonly seconds: number;
  readonly secondsOnSheet: number;
  /** The part of the level the camera shows, in world pixels, left and right. */
  readonly seen: { readonly left: number; readonly right: number };
}

/**
 * A torn enemy the view remembers: as it was last seen, and for how long the sim has had it gone.
 */
interface Remains {
  enemy: ClubEnemyView;
  isInSim: boolean;
  secondsGone: number;
  /** For `latestFew`: how long it has been on its way off, or null while it stays. */
  secondsCarriedOff: number | null;
}

/**
 * Returns a function to call every frame with the enemies of a sheet. It gives the strokes that
 * draw them: the living as ever, the torn as the sim has them while it has them, and what is left
 * of them afterwards the way that is tried.
 */
export function createEnemiesDrawing(): (frame: EnemiesFrame) => Stroke[] {
  let remains: Remains[] = [];
  let level: number | undefined;
  let clearingsSeen = clearings;
  return (frame) => {
    const shouldClear = frame.level !== level || clearingsSeen !== clearings;
    if (shouldClear) {
      remains = remains.filter((entry) => entry.isInSim && frame.level === level);
      level = frame.level;
      clearingsSeen = clearings;
    }
    const seconds = Number.isFinite(frame.seconds) ? frame.seconds : 0;
    const strokes: Stroke[] = [];
    const tornNow = frame.enemies.filter((enemy) => enemy.torn !== null);
    for (const entry of remains) {
      const current = entry.isInSim
        ? tornNow.find((enemy) => isSameTear(enemy, entry.enemy))
        : undefined;
      if (current) {
        entry.enemy = current;
      } else {
        entry.isInSim = false;
        entry.secondsGone += seconds;
      }
    }
    for (const enemy of tornNow) {
      if (!remains.some((entry) => entry.isInSim && isSameTear(enemy, entry.enemy))) {
        remains.push({ enemy, isInSim: true, secondsGone: 0, secondsCarriedOff: null });
      }
    }
    for (const enemy of frame.enemies) {
      if (enemy.torn === null) {
        strokes.push(...buildClubEnemyStrokes(enemy, frame.secondsOnSheet));
      }
    }
    const way = getRemainsWay();
    if (way === 'stayInView') {
      remains = remains.filter((entry) => entry.isInSim || isInView(entry.enemy, frame.seen));
    }
    const beyondLatest = way === 'latestFew' ? remains.slice(0, -LATEST_KEPT) : [];
    for (const entry of remains) {
      if (beyondLatest.includes(entry)) {
        entry.secondsCarriedOff = (entry.secondsCarriedOff ?? 0) + seconds;
      }
      strokes.push(...buildRemainsStrokes(way, entry));
    }
    if (way === 'latestFew') {
      remains = remains.filter((entry) => (entry.secondsCarriedOff ?? 0) < CARRY_OFF_SECONDS);
    }
    return strokes;
  };
}

// ---- Helpers ----

/** One torn enemy from frame to frame: where it stood when it was struck. */
function isSameTear(one: ClubEnemyView, other: ClubEnemyView): boolean {
  return one.position.x === other.position.x && one.defId === other.defId;
}

function isInView(enemy: ClubEnemyView, seen: { left: number; right: number }): boolean {
  const middle = convertToPixels(enemy.position.x);
  const reach = convertToPixels(2.5);
  return middle + reach >= seen.left && middle - reach <= seen.right;
}

/** How far along the leaving is: the sim's while it has the enemy, and all of it afterwards. */
function getLeaving(entry: Remains): number {
  if (!entry.isInSim) {
    return 1;
  }
  return entry.enemy.torn?.action === 'leaving' ? entry.enemy.torn.progress : 0;
}

/** The strokes of what is left of one torn enemy, the way that is tried. */
function buildRemainsStrokes(way: RemainsWay, entry: Remains): Stroke[] {
  const leaving = getLeaving(entry);
  const lying = { manner: 'wind', progress: 0 } as const;
  if (way === 'carriedOff') {
    return entry.isInSim ? buildTornClubEnemyStrokes(entry.enemy) : [];
  }
  if (way === 'fallOff') {
    return entry.isInSim
      ? buildTornClubEnemyStrokes(entry.enemy, { manner: 'falling', progress: leaving })
      : [];
  }
  if (way === 'settleIntoBits') {
    return buildSettlingStrokes(entry.enemy, leaving);
  }
  if (way === 'latestFew') {
    const carriedOff = Math.min(1, (entry.secondsCarriedOff ?? 0) / CARRY_OFF_SECONDS);
    return buildTornClubEnemyStrokes(entry.enemy, { manner: 'wind', progress: carriedOff });
  }
  return buildTornClubEnemyStrokes(entry.enemy, lying);
}

/**
 * The halves breaking down: they sink flat onto the floor line as a few small bits of paper come
 * to lie where they were, and then only the bits are left.
 */
function buildSettlingStrokes(enemy: ClubEnemyView, settled: number): Stroke[] {
  const floor = convertToPixels(enemy.position.y + enemy.floatHeight);
  const middle = convertToPixels(enemy.position.x);
  const away = enemy.facing === 1 ? -1 : 1;
  const halves =
    settled >= 1
      ? []
      : buildTornClubEnemyStrokes(enemy, { manner: 'wind', progress: 0 }).map((stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({
            x: point.x,
            y: floor - (floor - point.y) * (1 - settled),
          })),
        }));
  const shown = Math.ceil(BITS.length * settled);
  const bits = BITS.slice(0, shown).map((bit): Stroke => {
    const centre = {
      x: middle + away * convertToPixels(bit.aside),
      y: floor - convertToPixels(bit.size) / 2 - PENCIL.thickness / 2,
    };
    const half = convertToPixels(bit.size) / 2;
    const corners: StrokePoint[] = [
      { x: -half, y: -half * 0.7 },
      { x: half * 0.8, y: -half },
      { x: half, y: half * 0.6 },
      { x: -half * 0.7, y: half * 0.8 },
    ];
    return {
      points: corners.map((corner) => ({
        x: centre.x + corner.x * Math.cos(bit.turn) - corner.y * Math.sin(bit.turn),
        y: centre.y + corner.x * Math.sin(bit.turn) + corner.y * Math.cos(bit.turn),
      })),
      thickness: PENCIL.thickness * 0.6,
      isClosed: true,
    };
  });
  return [...halves, ...bits];
}

/** The bits a torn enemy settles into: how far aside of where it stood, how big, how turned. */
const BITS = [
  { aside: -0.75, size: 0.13, turn: 0.4 },
  { aside: -0.3, size: 0.1, turn: 1.1 },
  { aside: 0.1, size: 0.15, turn: -0.3 },
  { aside: 0.45, size: 0.09, turn: 0.8 },
  { aside: 0.8, size: 0.13, turn: -0.9 },
  { aside: 1.15, size: 0.1, turn: 0.2 },
] as const;

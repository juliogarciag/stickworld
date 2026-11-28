import { createSim, getEnemies, practiceLevels, type EnemyView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, buildEnemyStrokes } from './enemy';
import type { Stroke } from './strokes';
import { convertToPixels } from './units';

const { LOOK } = __testing__;

describe('the club enemy as it is drawn', () => {
  it('has a body, a hand at its back, two eyes, a mouth, an arm, a hand and a dotted club', () => {
    const strokes = buildEnemyStrokes(WAITING, 0);
    // Five lines of the box and the hand at its back, two eyes and a mouth, the arm, the hand on
    // the club, the club and its dots.
    expect(strokes).toHaveLength(6 + 3 + 3 + LOOK.clubDots);
    for (const stroke of strokes) {
      expect(stroke.points.length).toBeGreaterThanOrEqual(2);
      for (const point of stroke.points) {
        expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      }
    }
  });

  it('keeps its box inside the body the sim has: what stops the stick man is what is drawn', () => {
    const box = buildEnemyStrokes(WAITING, 0).slice(0, 5);
    const xs = box.flatMap((stroke) => stroke.points.map((point) => point.x));
    const ys = box.flatMap((stroke) => stroke.points.map((point) => point.y));
    const { position, width, height } = WAITING;
    expect(Math.min(...xs)).toBeCloseTo(convertToPixels(position.x - width / 2), 6);
    expect(Math.max(...xs)).toBeCloseTo(convertToPixels(position.x + width / 2), 6);
    expect(Math.min(...ys)).toBeCloseTo(convertToPixels(position.y - height), 6);
    expect(Math.max(...ys)).toBeCloseTo(convertToPixels(position.y), 6);
  });

  it('floats: nothing of its body touches the floor line under it', () => {
    const lowest = Math.max(
      ...buildEnemyStrokes(WAITING, 0)
        .slice(0, 9)
        .flatMap((stroke) => stroke.points.map((point) => point.y)),
    );
    expect(lowest).toBeLessThan(convertToPixels(0) - 5);
  });

  it('draws its arm from the shoulder to the hand and its club from the hand to its end, where the sim has them', () => {
    for (const enemy of [WAITING, getEnemyDoing('windingUp'), getEnemyDoing('swinging')]) {
      const strokes = buildEnemyStrokes(enemy, 0);
      const arm = strokes[strokes.length - LOOK.clubDots - 3]!;
      const club = strokes[strokes.length - LOOK.clubDots - 1]!;
      expect(arm.points).toEqual([enemy.club.shoulder, enemy.club.grip].map(convertPointToPixels));
      expect(club.isClosed).toBe(true);
      const tip = convertPointToPixels(enemy.club.tip);
      const grip = convertPointToPixels(enemy.club.grip);
      const half = convertToPixels(enemy.club.thickness / 2);
      for (const point of club.points) {
        // No part of the outline is further from the club's own line than half its thickness,
        // or past its end.
        expect(measureDistanceToLine(point, grip, tip)).toBeLessThanOrEqual(half + 1e-6);
      }
      expect(
        club.points.some((point) => Math.hypot(point.x - tip.x, point.y - tip.y) <= half),
      ).toBe(true);
    }
  });

  it('frowns only while it means to strike: winding up and swinging', () => {
    const count = buildEnemyStrokes(WAITING, 0).length;
    expect(buildEnemyStrokes(getEnemyDoing('windingUp'), 0)).toHaveLength(count + 2);
    expect(buildEnemyStrokes(getEnemyDoing('swinging'), 0)).toHaveLength(count + 2);
    expect(buildEnemyStrokes(getEnemyDoing('recovering'), 0)).toHaveLength(count);
  });

  it('is drawn the other way round when it looks the other way', () => {
    const mirrored: EnemyView = {
      ...WAITING,
      facing: WAITING.facing === 1 ? -1 : 1,
      club: {
        ...WAITING.club,
        grip: getMirrored(WAITING.club.grip),
        tip: getMirrored(WAITING.club.tip),
      },
    };
    const getFarthestLeft = (strokes: Stroke[]): number =>
      Math.min(...strokes.flatMap((stroke) => stroke.points.map((point) => point.x)));
    const getFarthestRight = (strokes: Stroke[]): number =>
      Math.max(...strokes.flatMap((stroke) => stroke.points.map((point) => point.x)));
    const middle = convertToPixels(WAITING.position.x);
    expect(getFarthestLeft(buildEnemyStrokes(mirrored, 0)) - middle).toBeCloseTo(
      middle - getFarthestRight(buildEnemyStrokes(WAITING, 0)),
      6,
    );
  });

  it('bobs a little as it floats, by the clock of the view, club and all', () => {
    const quarterOfBob = 1 / LOOK.bobsPerSecond / 4;
    const still = buildEnemyStrokes(WAITING, 0);
    const bobbed = buildEnemyStrokes(WAITING, quarterOfBob);
    bobbed.forEach((stroke, index) => {
      stroke.points.forEach((point, pointIndex) => {
        const before = still[index]!.points[pointIndex]!;
        expect(point.x).toBeCloseTo(before.x, 6);
        expect(point.y - before.y).toBeCloseTo(convertToPixels(LOOK.bobHeight), 6);
      });
    });
  });
});

// ---- Helpers ----

const YARD = practiceLevels[0]!;
const WAITING = getEnemies(createSim({ level: YARD.id }))[0]!;

/**
 * The yard's enemy as the sim has it a few ticks into `action`, the stick man standing in reach.
 */
function getEnemyDoing(action: EnemyView['action']): EnemyView {
  const sim = createSim({ level: YARD.id });
  sim.step([{ type: 'player/walk', direction: 1 }]);
  for (let tick = 0; tick < 3000; tick += 1) {
    sim.step();
    const enemy = getEnemies(sim)[0]!;
    const isWellInto = enemy.action === action && enemy.progress > 0.3;
    if (isWellInto) {
      return enemy;
    }
  }
  throw new Error(`the enemy never got to ${action}`);
}

function getMirrored(point: { x: number; y: number }): { x: number; y: number } {
  return { x: 2 * WAITING.position.x - point.x, y: point.y };
}

function convertPointToPixels(point: { x: number; y: number }): { x: number; y: number } {
  return { x: convertToPixels(point.x), y: convertToPixels(point.y) };
}

function measureDistanceToLine(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2;
  const share = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + (end.x - start.x) * share),
    point.y - (start.y + (end.y - start.y) * share),
  );
}

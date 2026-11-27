import type { FlagView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { buildFlagStrokes } from './flag';
import { convertToPixels } from './units';

describe('the flag', () => {
  it('is a stick as tall as the sim says, standing where the sim says, and a closed piece of cloth', () => {
    const [stick, cloth] = buildFlagStrokes(WAITING);
    expect(stick!.points).toEqual([
      { x: convertToPixels(WAITING.position.x), y: convertToPixels(WAITING.position.y) },
      {
        x: convertToPixels(WAITING.position.x),
        y: convertToPixels(WAITING.position.y - WAITING.height),
      },
    ]);
    expect(cloth!.isClosed).toBe(true);
    expect(buildFlagStrokes(WAITING)).toHaveLength(2);
  });

  it('keeps the cloth on the stick, wherever it is along it', () => {
    for (const raised of [0, 0.3, 1]) {
      const [, cloth] = buildFlagStrokes({ ...WAITING, raised });
      const heights = cloth!.points.map((point) => point.y);
      expect(Math.min(...heights)).toBeGreaterThan(
        convertToPixels(WAITING.position.y - WAITING.height),
      );
      expect(Math.max(...heights)).toBeLessThan(convertToPixels(WAITING.position.y));
    }
  });

  it('carries the cloth higher the more the flag is raised', () => {
    const getTopOfCloth = (raised: number): number =>
      Math.min(...buildFlagStrokes({ ...WAITING, raised })[1]!.points.map((point) => point.y));
    expect(getTopOfCloth(0.5)).toBeLessThan(getTopOfCloth(0));
    expect(getTopOfCloth(1)).toBeLessThan(getTopOfCloth(0.5));
  });
});

// ---- Helpers ----

const WAITING: FlagView = {
  position: { x: 4, y: 0.5 },
  height: 1.5,
  isReached: false,
  upFor: 0,
  raised: 0,
  isFinalFlag: false,
};

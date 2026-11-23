import type { FlagView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { flagStrokes } from './flag';
import { toPixels } from './units';

describe('the flag', () => {
  it('is a stick as tall as the sim says, standing where the sim says, and a closed piece of cloth', () => {
    const [stick, cloth] = flagStrokes(WAITING);
    expect(stick!.points).toEqual([
      { x: toPixels(WAITING.at.x), y: toPixels(WAITING.at.y) },
      { x: toPixels(WAITING.at.x), y: toPixels(WAITING.at.y - WAITING.height) },
    ]);
    expect(cloth!.closed).toBe(true);
    expect(flagStrokes(WAITING)).toHaveLength(2);
  });

  it('keeps the cloth on the stick, wherever it is along it', () => {
    for (const raised of [0, 0.3, 1]) {
      const [, cloth] = flagStrokes({ ...WAITING, raised });
      const heights = cloth!.points.map((point) => point.y);
      expect(Math.min(...heights)).toBeGreaterThan(toPixels(WAITING.at.y - WAITING.height));
      expect(Math.max(...heights)).toBeLessThan(toPixels(WAITING.at.y));
    }
  });

  it('carries the cloth higher the more the flag is raised', () => {
    const topOfCloth = (raised: number): number => Math.min(...flagStrokes({ ...WAITING, raised })[1]!.points.map((point) => point.y));
    expect(topOfCloth(0.5)).toBeLessThan(topOfCloth(0));
    expect(topOfCloth(1)).toBeLessThan(topOfCloth(0.5));
  });
});

// ---- Helpers ----

const WAITING: FlagView = { at: { x: 4, y: 0.5 }, height: 1.5, reached: false, raised: 0, endsTheGame: false };

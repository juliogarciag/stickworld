import { describe, expect, it } from 'vitest';
import { frameSeconds, MAX_FRAME_SECONDS } from './frameSeconds';

describe('frameSeconds', () => {
  it('counts all of a frame, however long, up to the cap', () => {
    expect(frameSeconds(1000 / 144)).toBeCloseTo(1 / 144, 12);
    expect(frameSeconds(1000 / 30)).toBeCloseTo(1 / 30, 12);
    expect(frameSeconds(200)).toBe(0.2);
  });

  it('counts a frame longer than the cap as the cap', () => {
    expect(frameSeconds(MAX_FRAME_SECONDS * 1000 + 1)).toBe(MAX_FRAME_SECONDS);
    expect(frameSeconds(12000)).toBe(MAX_FRAME_SECONDS);
  });

  it('counts a frame that went backwards as nothing', () => {
    expect(frameSeconds(-5)).toBe(0);
  });
});

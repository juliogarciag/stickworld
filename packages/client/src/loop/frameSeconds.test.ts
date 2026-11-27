import { describe, expect, it } from 'vitest';
import { getFrameSeconds, MAX_FRAME_SECONDS } from './frameSeconds';

describe('getFrameSeconds', () => {
  it('counts all of a frame, however long, up to the cap', () => {
    expect(getFrameSeconds(1000 / 144)).toBeCloseTo(1 / 144, 12);
    expect(getFrameSeconds(1000 / 30)).toBeCloseTo(1 / 30, 12);
    expect(getFrameSeconds(200)).toBe(0.2);
  });

  it('counts a frame longer than the cap as the cap', () => {
    expect(getFrameSeconds(MAX_FRAME_SECONDS * 1000 + 1)).toBe(MAX_FRAME_SECONDS);
    expect(getFrameSeconds(12000)).toBe(MAX_FRAME_SECONDS);
  });

  it('counts a frame that went backwards as nothing', () => {
    expect(getFrameSeconds(-5)).toBe(0);
  });
});

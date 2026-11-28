import { describe, expect, it } from 'vitest';
import { doesBlowTouchBox, type Blow, type Box } from './blow';

describe('a blow against a box', () => {
  it('touches a box it crosses', () => {
    expect(doesBlowTouchBox(makeBlow({ x: -1, y: 0.5 }, { x: 3, y: 0.5 }), BOX)).toBe(true);
  });

  it('touches a box it ends inside', () => {
    expect(doesBlowTouchBox(makeBlow({ x: -1, y: -1 }, { x: 0.5, y: 0.5 }), BOX)).toBe(true);
  });

  it('touches a box it is wholly inside', () => {
    expect(doesBlowTouchBox(makeBlow({ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }), BOX)).toBe(true);
  });

  it('does not touch a box it stops short of', () => {
    expect(doesBlowTouchBox(makeBlow({ x: -3, y: 0.5 }, { x: -0.2, y: 0.5 }), BOX)).toBe(false);
  });

  it('does not touch a box it passes beside, further away than half its thickness', () => {
    expect(doesBlowTouchBox(makeBlow({ x: -1, y: 1.2 }, { x: 3, y: 1.2 }), BOX)).toBe(false);
  });

  it('touches a box it passes beside within half its thickness', () => {
    expect(doesBlowTouchBox(makeBlow({ x: -1, y: 1.04 }, { x: 3, y: 1.04 }), BOX)).toBe(true);
  });

  it('does not touch a box whose corner it passes on a slant', () => {
    expect(doesBlowTouchBox(makeBlow({ x: 1.5, y: 0 }, { x: 2.5, y: 1 }), BOX)).toBe(false);
  });

  it('touches a box as a single point inside it, and not as one outside it', () => {
    expect(doesBlowTouchBox(makeBlow({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }), BOX)).toBe(true);
    expect(doesBlowTouchBox(makeBlow({ x: 2, y: 2 }, { x: 2, y: 2 }), BOX)).toBe(false);
  });
});

// ---- Helpers ----

const BOX: Box = { left: 0, right: 1, top: 0, bottom: 1 };

function makeBlow(start: { x: number; y: number }, end: { x: number; y: number }): Blow {
  return { start, end, thickness: 0.1, direction: 1 };
}

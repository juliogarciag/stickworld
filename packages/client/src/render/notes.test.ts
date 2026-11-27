import type { NoteView } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__, areNotesStill, buildNoteStrokes } from './notes';
import { convertToPixels } from './units';

describe('buildNoteStrokes', () => {
  it('writes a note about something he does as its keys in boxes and its words, centred on where it is, above its line', () => {
    const strokes = buildNoteStrokes([WALK], KEYS);
    expect(strokes.filter((stroke) => stroke.closed)).toHaveLength(2);
    const { xs, ys } = getExtent(strokes);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(convertToPixels(WALK.at.x), 6);
    expect(Math.max(...ys)).toBeCloseTo(convertToPixels(WALK.at.y), 6);
    expect(Math.min(...ys)).toBeCloseTo(convertToPixels(WALK.at.y) - NOTES.keyed.keySide, 6);
  });

  it('draws the keys it is handed for what the note is about, and none of its own', () => {
    const oneKey = buildNoteStrokes([WALK], { ...KEYS, walking: ['D'] });
    expect(oneKey.filter((stroke) => stroke.closed)).toHaveLength(1);
    expect(buildNoteStrokes([{ ...WALK, about: 'jumping' }], KEYS).filter((stroke) => stroke.closed)).toHaveLength(1);
  });

  it('writes a title as words alone, larger, centred, standing on its line', () => {
    const strokes = buildNoteStrokes([NAME], KEYS);
    expect(strokes.some((stroke) => stroke.closed)).toBe(false);
    const { xs, ys } = getExtent(strokes);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(convertToPixels(NAME.at.x), 6);
    expect(Math.max(...ys)).toBeCloseTo(convertToPixels(NAME.at.y), 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(NOTES.titleLetterHeight, 6);
  });

  it('rubs a note out stroke by stroke over a moment, and leaves the others as they are', () => {
    const whole = buildNoteStrokes([NAME, WALK], KEYS);
    const countPointsLeft = (rubbedOutFor: number): number => buildNoteStrokes([NAME, { ...WALK, rubbedOutFor }], KEYS).reduce((sum, stroke) => sum + stroke.points.length, 0);
    const pointsOfTheName = buildNoteStrokes([NAME], KEYS).reduce((sum, stroke) => sum + stroke.points.length, 0);
    expect(countPointsLeft(0)).toBe(whole.reduce((sum, stroke) => sum + stroke.points.length, 0));
    expect(countPointsLeft(NOTES.rubbedOutIn / 2)).toBeLessThan(countPointsLeft(0));
    expect(countPointsLeft(NOTES.rubbedOutIn / 2)).toBeGreaterThan(pointsOfTheName);
    expect(countPointsLeft(NOTES.rubbedOutIn)).toBe(pointsOfTheName);
    // The strokes that are left keep their places in the list, so they are not drawn with another wobble.
    expect(buildNoteStrokes([NAME, { ...WALK, rubbedOutFor: NOTES.rubbedOutIn / 2 }], KEYS)).toHaveLength(whole.length);
  });
});

describe('areNotesStill', () => {
  it('is false only while a note is being rubbed out', () => {
    expect(areNotesStill([NAME, WALK])).toBe(true);
    expect(areNotesStill([NAME, { ...WALK, rubbedOutFor: 0 }])).toBe(false);
    expect(areNotesStill([NAME, { ...WALK, rubbedOutFor: NOTES.rubbedOutIn / 2 }])).toBe(false);
    expect(areNotesStill([NAME, { ...WALK, rubbedOutFor: NOTES.rubbedOutIn }])).toBe(true);
  });
});

// ---- Helpers ----

const { NOTES } = __testing__;
const KEYS = { walking: ['←', '→'], jumping: ['↑'] };
const WALK: NoteView = { at: { x: 2.2, y: -2.5 }, words: 'walk', about: 'walking', rubbedOutPast: 4.2, rubbedOutFor: null };
const NAME: NoteView = { at: { x: 2, y: -5.4 }, words: 'Stickworld', title: true, rubbedOutFor: null };

function getExtent(strokes: readonly { points: readonly { x: number; y: number }[] }[]): { xs: number[]; ys: number[] } {
  const points = strokes.flatMap((stroke) => stroke.points);
  return { xs: points.map((point) => point.x), ys: points.map((point) => point.y) };
}

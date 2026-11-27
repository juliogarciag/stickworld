import type { Stroke, StrokePoint } from '../render/strokes';
import { PENCIL } from '../render/strokes/pencil';

/**
 * Words written in pencil: every letter is a few strokes, so text on the HUD
 * is drawn by the same pencil as everything else (ADR 0004). The stick man prints in
 * capitals; a character with no drawing leaves a space. View detail only:
 * what the words are comes from the sim's defs or from the HUD itself.
 */

export interface Written {
  readonly strokes: Stroke[];
  /** How wide the widest line came out, and how tall all the lines are together, in the same pixels as `letterHeight`. */
  readonly width: number;
  readonly height: number;
}

export interface WritingPlace {
  /** The top left corner of the first line. */
  readonly position: StrokePoint;
  /** How tall a capital is. */
  readonly letterHeight: number;
  /** How wide a line may get before the next word starts a new one. Left out, it is all one line. */
  readonly lineWidth?: number;
}

/** `text` as pencil strokes, word-wrapped to `lineWidth`. */
export function buildWriting(text: string, place: WritingPlace): Written {
  const lines = wrapText(text.toUpperCase(), (place.lineWidth ?? Infinity) / place.letterHeight);
  const thickness = Math.min(PENCIL.thickness, place.letterHeight * WRITING.thickness);
  const strokes = lines.flatMap((line, lineIndex) => {
    let x = 0;
    return [...line].flatMap((character) => {
      const glyph = getGlyph(character);
      const left = x;
      x += glyph.width + WRITING.betweenLetters;
      return glyph.paths.map((path) => ({ points: path.map((point) => ({ x: place.position.x + (left + point.x) * place.letterHeight, y: place.position.y + (lineIndex * WRITING.lineHeight + point.y) * place.letterHeight })), thickness }));
    });
  });
  const widest = Math.max(0, ...lines.map(measureWidth));
  return { strokes, width: widest * place.letterHeight, height: (Math.max(0, lines.length - 1) * WRITING.lineHeight + 1) * place.letterHeight };
}

// ---- Helpers ----

/** The hand's habits, as shares of a capital's height. */
const WRITING = {
  betweenLetters: 0.3,
  /** From the top of one line to the top of the next. */
  lineHeight: 1.7,
  space: 0.42,
  /** How thick the line is; never thicker than the pencil. */
  thickness: 0.11,
} as const;

interface Glyph {
  readonly width: number;
  readonly paths: readonly (readonly StrokePoint[])[];
}

/** How wide `line` is written, in capital heights. */
function measureWidth(line: string): number {
  const letters = [...line];
  return letters.reduce((width, character) => width + getGlyph(character).width, 0) + Math.max(0, letters.length - 1) * WRITING.betweenLetters;
}

/** `text` broken into lines no wider than `mostWidth` capital heights, at spaces. A single word wider than that keeps a line to itself. */
function wrapText(text: string, mostWidth: number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter((each) => each !== '')) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measureWidth(`${last} ${word}`) <= mostWidth) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

function getGlyph(character: string): Glyph {
  return GLYPHS[character] ?? SPACE;
}

/** One letter from its strokes written as "x,y x,y | x,y x,y": (0, 0) is the top left of a capital and (0, 1) its foot. */
function makeGlyph(width: number, strokes: string): Glyph {
  const paths = strokes.split('|').map((path) =>
    path
      .trim()
      .split(/\s+/)
      .map((point) => {
        const [x, y] = point.split(',').map(Number);
        return { x: x ?? 0, y: y ?? 0 };
      }),
  );
  return { width, paths };
}

const SPACE: Glyph = { width: WRITING.space, paths: [] };

const ROUND = '.2,0 .4,0 .6,.2 .6,.8 .4,1 .2,1 0,.8 0,.2 .2,0';
const BOWL = '0,1 0,0 .4,0 .58,.14 .58,.4 .4,.54 0,.54';

const GLYPHS: Readonly<Record<string, Glyph>> = {
  A: makeGlyph(0.6, '0,1 .3,0 .6,1 | .12,.62 .48,.62'),
  B: makeGlyph(0.6, '0,1 0,0 .4,0 .55,.12 .55,.36 .4,.48 0,.48 | .4,.48 .6,.62 .6,.86 .42,1 0,1'),
  C: makeGlyph(0.6, '.6,.15 .42,0 .2,0 0,.2 0,.8 .2,1 .42,1 .6,.85'),
  D: makeGlyph(0.58, '0,1 0,0 .32,0 .58,.22 .58,.78 .32,1 0,1'),
  E: makeGlyph(0.55, '.55,0 0,0 0,1 .55,1 | 0,.5 .42,.5'),
  F: makeGlyph(0.55, '.55,0 0,0 0,1 | 0,.5 .42,.5'),
  G: makeGlyph(0.6, '.6,.15 .42,0 .2,0 0,.2 0,.8 .2,1 .42,1 .6,.82 .6,.55 .34,.55'),
  H: makeGlyph(0.58, '0,0 0,1 | .58,0 .58,1 | 0,.5 .58,.5'),
  I: makeGlyph(0.4, '0,0 .4,0 | .2,0 .2,1 | 0,1 .4,1'),
  J: makeGlyph(0.5, '.5,0 .5,.8 .34,1 .16,1 0,.82'),
  K: makeGlyph(0.58, '0,0 0,1 | .55,0 0,.56 | .2,.4 .58,1'),
  L: makeGlyph(0.5, '0,0 0,1 .5,1'),
  M: makeGlyph(0.7, '0,1 0,0 .35,.6 .7,0 .7,1'),
  N: makeGlyph(0.58, '0,1 0,0 .58,1 .58,0'),
  O: makeGlyph(0.6, ROUND),
  P: makeGlyph(0.58, BOWL),
  Q: makeGlyph(0.62, `${ROUND} | .36,.72 .62,1.04`),
  R: makeGlyph(0.6, `${BOWL} | .3,.54 .6,1`),
  S: makeGlyph(0.58, '.56,.14 .4,0 .16,0 0,.14 0,.34 .14,.48 .44,.54 .58,.68 .58,.86 .42,1 .16,1 0,.86'),
  T: makeGlyph(0.6, '0,0 .6,0 | .3,0 .3,1'),
  U: makeGlyph(0.6, '0,0 0,.8 .18,1 .42,1 .6,.8 .6,0'),
  V: makeGlyph(0.6, '0,0 .3,1 .6,0'),
  W: makeGlyph(0.8, '0,0 .18,1 .4,.35 .62,1 .8,0'),
  X: makeGlyph(0.6, '0,0 .6,1 | .6,0 0,1'),
  Y: makeGlyph(0.6, '0,0 .3,.5 .6,0 | .3,.5 .3,1'),
  Z: makeGlyph(0.6, '0,0 .6,0 0,1 .6,1'),
  '0': makeGlyph(0.6, ROUND),
  '1': makeGlyph(0.3, '0,.2 .2,0 .2,1'),
  '2': makeGlyph(0.6, '0,.18 .16,0 .42,0 .58,.18 .58,.4 0,1 .6,1'),
  '3': makeGlyph(0.6, '0,.1 .2,0 .42,0 .58,.14 .58,.36 .4,.48 .2,.48 | .4,.48 .6,.62 .6,.86 .42,1 .18,1 0,.88'),
  '4': makeGlyph(0.6, '.45,1 .45,0 0,.68 .6,.68'),
  '5': makeGlyph(0.58, '.56,0 .06,0 0,.45 .36,.42 .58,.58 .58,.84 .4,1 .16,1 0,.88'),
  '6': makeGlyph(0.6, '.5,0 .22,.1 0,.45 0,.82 .18,1 .42,1 .6,.84 .6,.62 .42,.46 .18,.46 0,.6'),
  '7': makeGlyph(0.6, '0,0 .6,0 .22,1'),
  '8': makeGlyph(0.6, '.3,.48 .1,.4 .04,.2 .2,0 .4,0 .56,.2 .5,.4 .3,.48 .06,.62 0,.84 .18,1 .42,1 .6,.84 .54,.62 .3,.48'),
  '9': makeGlyph(0.6, '.6,.4 .42,.54 .18,.54 0,.38 0,.16 .18,0 .42,0 .6,.16 .6,.55 .38,.9 .1,1'),
  '.': makeGlyph(0.1, '.03,.9 .07,1'),
  ',': makeGlyph(0.12, '.1,.88 .02,1.14'),
  "'": makeGlyph(0.1, '.07,0 .02,.2'),
  '!': makeGlyph(0.1, '.05,0 .05,.68 | .03,.9 .07,1'),
  '?': makeGlyph(0.56, '0,.16 .16,0 .4,0 .56,.16 .56,.36 .28,.56 .28,.7 | .26,.9 .3,1'),
  ':': makeGlyph(0.1, '.03,.32 .07,.42 | .03,.9 .07,1'),
  '-': makeGlyph(0.45, '0,.55 .45,.55'),
  '↑': makeGlyph(0.5, '.25,1 .25,0 | 0,.32 .25,0 .5,.32'),
  '←': makeGlyph(0.7, '.7,.5 0,.5 | .3,.24 0,.5 .3,.76'),
  '→': makeGlyph(0.7, '0,.5 .7,.5 | .4,.24 .7,.5 .4,.76'),
  '↓': makeGlyph(0.5, '.25,0 .25,1 | 0,.68 .25,1 .5,.68'),
};

export const __testing__ = { GLYPHS, WRITING, wrapText, measureWidth };

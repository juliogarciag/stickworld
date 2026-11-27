import { MOVEMENT_PRESETS } from '@stickworld/sim';
import { describe, expect, it } from 'vitest';
import { __testing__ } from './movementPanel';

const { readChoiceIn } = __testing__;

describe('what the movement panel kept in browser storage', () => {
  it('reads back what it wrote', () => {
    const choice = { preset: 'ninetiesPlatformer', tuning: { ...MOVEMENT_PRESETS.ninetiesPlatformer, jumpHeight: 2 }, open: true };
    expect(readChoiceIn(JSON.stringify(choice))).toEqual(choice);
  });

  it('is nothing when nothing, or nothing that is a choice, was kept', () => {
    for (const text of [null, '', '{', 'null', '42', '"current"', 'true']) expect(readChoiceIn(text), String(text)).toBeUndefined();
  });

  it('takes an unknown preset, or one named after something every object has, for the current one', () => {
    for (const preset of ['nope', '__proto__', 'constructor', 'toString', 42, null]) {
      expect(readChoiceIn(JSON.stringify({ preset }))?.preset, String(preset)).toBe('current');
    }
  });

  it('keeps no number that is not a number within its limits: the preset has it instead', () => {
    const kept = readChoiceIn(JSON.stringify({ preset: 'ninetiesPlatformer', tuning: { jumpHeight: 1e9, walkSpeed: '5', riseGravity: null, letGoCut: -1, airBraking: 0, extra: 3 } }));
    expect(kept?.tuning).toEqual({ ...MOVEMENT_PRESETS.ninetiesPlatformer, airBraking: 0 });
    expect(kept?.tuning).not.toHaveProperty('extra');
  });

  it('is folded away unless it was kept open', () => {
    expect(readChoiceIn(JSON.stringify({ open: 'yes' }))?.open).toBe(false);
    expect(readChoiceIn(JSON.stringify({ open: true }))?.open).toBe(true);
  });

  it('ignores a tuning that is not an object', () => {
    expect(readChoiceIn(JSON.stringify({ preset: 'current', tuning: [1, 2, 3] }))?.tuning).toEqual(MOVEMENT_PRESETS.current);
  });
});

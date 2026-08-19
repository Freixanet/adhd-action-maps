import { describe, expect, it } from 'vitest';
import { keyboardLiftPx, keyboardInputHeight, composerGrowProgress } from '../mobile/src/logic/composerKeyboardLift';

describe('keyboardLiftPx', () => {
  it('rides keyboard height while opening or closing', () => {
    expect(keyboardLiftPx(120, 34, 12)).toBe(132);
    expect(keyboardLiftPx(300, 34, 12)).toBe(312);
  });

  it('rests on the home indicator when the keyboard is gone', () => {
    expect(keyboardLiftPx(0, 34, 12)).toBe(34);
    expect(keyboardLiftPx(-1, 34, 12)).toBe(34);
  });
});

describe('keyboardInputHeight', () => {
  it('stays at rest until the keyboard moves', () => {
    expect(keyboardInputHeight(0, 38, 88)).toBe(38);
  });

  it('grows to the focused height when the field is focused even if the keyboard height is still 0', () => {
    expect(keyboardInputHeight(0, 38, 88, true)).toBe(88);
  });

  it('keeps the keyboard close animation when focus already dropped', () => {
    expect(keyboardInputHeight(80, 38, 88, false)).toBe(63);
  });

  it('grows to the focused height with the keyboard', () => {
    expect(keyboardInputHeight(80, 38, 88)).toBe(63);
    expect(keyboardInputHeight(160, 38, 88)).toBe(88);
    expect(keyboardInputHeight(300, 38, 88)).toBe(88);
    expect(keyboardInputHeight(160, 0, 50)).toBe(50);
  });
});

describe('composerGrowProgress', () => {
  it('stays at rest until the keyboard moves or the field is focused', () => {
    expect(composerGrowProgress(0, false)).toBe(0);
    expect(composerGrowProgress(80, false)).toBe(0.5);
    expect(composerGrowProgress(0, true)).toBe(1);
  });
});

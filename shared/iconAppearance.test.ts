import { describe, expect, it } from 'vitest';
import {
  resolveSfSymbolName,
  SF_OPTICAL_SCALE,
  sfOpticalSize,
  sfWeightForStroke,
} from './iconAppearance';

describe('sfWeightForStroke', () => {
  it('maps stroke to weight only', () => {
    expect(sfWeightForStroke(1.5)).toBe('regular');
    expect(sfWeightForStroke(2)).toBe('medium');
    expect(sfWeightForStroke(2.15)).toBe('medium');
    expect(sfWeightForStroke(2.25)).toBe('medium');
    expect(sfWeightForStroke(2.5)).toBe('semibold');
  });
});

describe('resolveSfSymbolName', () => {
  const check = { name: 'checkmark.circle', fill: 'checkmark.circle.fill' } as const;
  const play = { name: 'play.fill', fill: 'play.fill' } as const;

  it('does not fill from stroke — filled is an explicit flag', () => {
    expect(resolveSfSymbolName(check, false)).toBe('checkmark.circle');
    expect(resolveSfSymbolName(check, true)).toBe('checkmark.circle.fill');
  });

  it('keeps play.fill as the playback glyph', () => {
    expect(resolveSfSymbolName(play, false)).toBe('play.fill');
    expect(resolveSfSymbolName(play, true)).toBe('play.fill');
  });
});

describe('sfOpticalSize', () => {
  it('scales SF ~1.1× over the Hugeicons nominal', () => {
    expect(SF_OPTICAL_SCALE).toBe(1.1);
    expect(sfOpticalSize(20)).toBe(22);
    expect(sfOpticalSize(16)).toBeCloseTo(17.6);
    expect(sfOpticalSize(24)).toBeCloseTo(26.4);
  });
});

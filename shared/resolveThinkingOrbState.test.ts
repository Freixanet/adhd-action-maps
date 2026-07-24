import { describe, expect, it } from 'vitest';
import { resolveThinkingOrbState } from './resolveThinkingOrbState';

describe('resolveThinkingOrbState', () => {
  it('usa searching al analizar la fuente', () => {
    expect(
      resolveThinkingOrbState({
        isAnalyzingSource: true,
        streamLoadPhase: 0,
        softStage: 0,
      })
    ).toBe('searching');
  });

  it('progresa working → solving → composing → shaping', () => {
    expect(
      resolveThinkingOrbState({
        isAnalyzingSource: false,
        streamLoadPhase: 0,
        softStage: 0,
      })
    ).toBe('working');
    expect(
      resolveThinkingOrbState({
        isAnalyzingSource: false,
        streamLoadPhase: 0,
        softStage: 1,
      })
    ).toBe('solving');
    expect(
      resolveThinkingOrbState({
        isAnalyzingSource: false,
        streamLoadPhase: 2,
        softStage: 0,
      })
    ).toBe('composing');
    expect(
      resolveThinkingOrbState({
        isAnalyzingSource: false,
        streamLoadPhase: 2,
        softStage: 3,
      })
    ).toBe('shaping');
  });
});

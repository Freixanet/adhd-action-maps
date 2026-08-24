import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GEMINI_MODEL_CHAIN,
  GEMINI_FLASH,
  GEMINI_FLASH_LITE,
  lumenIlluminateModelChain,
  withMinimalThinking,
} from './geminiModelChain';

describe('withMinimalThinking', () => {
  it('collapses HIGH/LOW thinking routes to MINIMAL so ask JSON is not truncated', () => {
    const routes = withMinimalThinking(DEFAULT_GEMINI_MODEL_CHAIN);
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => !route.endsWith(':HIGH') && !route.endsWith(':LOW'))).toBe(
      true
    );
    expect(routes.some((route) => route.endsWith(':MINIMAL'))).toBe(true);
  });
});

describe('lumenIlluminateModelChain', () => {
  it('uses Flash LOW before Lite, and never HIGH thinking', () => {
    const routes = lumenIlluminateModelChain(DEFAULT_GEMINI_MODEL_CHAIN);
    expect(routes[0]).toBe(`${GEMINI_FLASH}:LOW`);
    expect(routes).not.toContain(`${GEMINI_FLASH}:MINIMAL`);
    expect(routes[routes.length - 1]).toBe(`${GEMINI_FLASH_LITE}:MINIMAL`);
    expect(routes.every((route) => !route.endsWith(':HIGH'))).toBe(true);
  });
});

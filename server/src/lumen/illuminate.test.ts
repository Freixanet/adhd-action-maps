import { describe, expect, it } from 'vitest';
import { createRunLumenIlluminateDep } from './illuminate';
import { LUMEN_SAMPLE_CANVAS } from '../../../shared/lumen/samples';

describe('runLumenIlluminate', () => {
  it('assembles a map from model JSON', async () => {
    const run = createRunLumenIlluminateDep({
      generateJson: async () => ({
        text: JSON.stringify(LUMEN_SAMPLE_CANVAS),
        model: 'gemini-3.7-flash',
      }),
    });
    const result = await run({
      body: { type: 'text', text: 'relatividad especial' },
      ingest: null,
      isCancelled: () => false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.map.generationMode).toBe('lumen-v1');
      expect(result.map.lumenCanvas?.kind).toBe('explain');
      expect(result.model).toBe('gemini-3.7-flash');
    }
  });

  it('rejects empty input', async () => {
    const run = createRunLumenIlluminateDep({
      generateJson: async () => ({ text: '{}', model: 'x' }),
    });
    const result = await run({
      body: { type: 'text', text: ' ' },
      ingest: null,
      isCancelled: () => false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('LUMEN_EMPTY');
  });

  it('asks Flash to treat a long paste as explain, not a thin guide', async () => {
    let user = '';
    const run = createRunLumenIlluminateDep({
      generateJson: async (args) => {
        user = args.user;
        return { text: JSON.stringify(LUMEN_SAMPLE_CANVAS), model: 'gemini-3.7-flash' };
      },
    });
    const article = `${'El cambio de identidad precede a los hábitos. '.repeat(8)}\nUn protocolo al final no basta.`;
    const result = await run({
      body: { type: 'text', text: article },
      ingest: null,
      isCancelled: () => false,
    });
    expect(result.ok).toBe(true);
    expect(user).toMatch(/kind=explain/);
    expect(user).toContain('texto pegado');
  });

  it('recovers a truncated explain JSON instead of LUMEN_PARSE', async () => {
    const run = createRunLumenIlluminateDep({
      generateJson: async () => ({
        text: '{"kind":"explain","title":"Identidad","hook":"La conducta sigue a quien crees ser.","essence":"Cambia la identidad primero"',
        model: 'gemini-3.7-flash',
      }),
    });
    const result = await run({
      body: { type: 'text', text: 'How to fix your entire life in 1 day. '.repeat(20) },
      ingest: null,
      isCancelled: () => false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.map.lumenCanvas?.kind).toBe('explain');
  });
});

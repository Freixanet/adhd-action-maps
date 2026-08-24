import { describe, expect, it } from 'vitest';
import { classifyComposerSubmit } from '../mobile/src/logic/classifyComposerSubmit';
import {
  DEFAULT_HOME_SURFACE,
  homeSurfacePlaceholder,
  homeSurfaceToIndex,
  indexToHomeSurface,
  resolveHomeSurfaceCommit,
} from './homeSurfaceModel';

describe('homeSurfaceModel', () => {
  it('defaults to Núcleo', () => {
    expect(DEFAULT_HOME_SURFACE).toBe('nucleo');
    expect(homeSurfaceToIndex('chat')).toBe(0);
    expect(homeSurfaceToIndex('nucleo')).toBe(1);
    expect(indexToHomeSurface(0)).toBe('chat');
    expect(indexToHomeSurface(1)).toBe('nucleo');
  });

  it('commits only on a real change', () => {
    expect(
      resolveHomeSurfaceCommit({ current: 'nucleo', nextIndex: 1 }).changed
    ).toBe(false);
    expect(resolveHomeSurfaceCommit({ current: 'nucleo', nextIndex: 0 })).toEqual({
      surface: 'chat',
      index: 0,
      changed: true,
    });
  });

  it('uses distinct placeholders', () => {
    expect(homeSurfacePlaceholder('chat')).toBe('Escribe una pregunta');
    expect(homeSurfacePlaceholder('nucleo')).toBe('Pega caos, recibe un Núcleo');
  });
});

describe('classifyComposerSubmit surface', () => {
  const empty = { pastedText: null, uploadedFile: null };

  it('keeps files, paste, and URLs as source regardless of Chat', () => {
    expect(
      classifyComposerSubmit({
        inputText: '',
        pastedText: null,
        uploadedFile: { name: 'doc.pdf' },
        surface: 'chat',
      })
    ).toBe('source');
    expect(
      classifyComposerSubmit({
        inputText: '',
        pastedText: 'un pegado largo',
        uploadedFile: null,
        surface: 'chat',
      })
    ).toBe('source');
    expect(
      classifyComposerSubmit({
        ...empty,
        inputText: 'https://example.com/article',
        surface: 'chat',
      })
    ).toBe('source');
  });

  it('sends free text to ask on Chat and to source on Núcleo', () => {
    expect(
      classifyComposerSubmit({
        ...empty,
        inputText: 'cómo funciona la relatividad',
        surface: 'chat',
      })
    ).toBe('ask');
    expect(
      classifyComposerSubmit({
        ...empty,
        inputText: 'cómo funciona la relatividad',
        surface: 'nucleo',
      })
    ).toBe('source');
  });

  it('preserves ask for free text when surface is omitted', () => {
    expect(
      classifyComposerSubmit({
        ...empty,
        inputText: 'una pregunta suelta',
      })
    ).toBe('ask');
  });
});

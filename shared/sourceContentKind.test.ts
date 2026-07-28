import { describe, expect, it } from 'vitest';
import { inferLegacySourceContentKind } from './sourceContentKind';

describe('inferLegacySourceContentKind', () => {
  it('recognizes a legacy book from semantic chapter evidence', () => {
    expect(
      inferLegacySourceContentKind({
        title: 'Método de Trading de las Tortugas',
        coreSupport: 'Metodología de Curtis Faith.',
        sourceMetadata: {
          kind: 'pdf',
          title: 'Way of the Turtle',
          author: 'Curtis M. Faith',
        },
        steps: [
          {
            title: 'Ventaja',
            content: [
              {
                type: 'stat',
                source: 'Way of the Turtle, Capítulo 5 - Trading con una ventaja',
              },
            ],
          },
        ],
      })
    ).toBe('book');
  });

  it('does not treat every PDF or collection as a book', () => {
    expect(
      inferLegacySourceContentKind({
        title: 'Resultados del tercer trimestre',
        sourceMetadata: { kind: 'pdf', label: 'q3.pdf' },
        steps: [{ title: 'Ingresos', content: [] }],
      })
    ).toBeUndefined();
  });

  it('prefers an explicit report signal over chapter wording', () => {
    expect(
      inferLegacySourceContentKind({
        title: 'Informe anual 2025',
        coreSupport: 'Executive summary y capítulos financieros.',
      })
    ).toBe('report');
  });

  it('migrates an old authored book whose chapter metadata was lost', () => {
    expect(
      inferLegacySourceContentKind({
        title: 'Mi Lucha: Análisis crítico de fuentes y contexto',
        sourceMetadata: {
          kind: 'text',
          label: 'Documentos originales y prólogos',
          author: 'Adolf Hitler',
          detected: ['chunk_4130316e', 'chunk_08e232f2'],
        },
      })
    ).toBe('book');
  });
});

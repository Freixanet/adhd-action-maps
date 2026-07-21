import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CATEGORIES, FALLBACK_MAP_CATEGORY } from './categories';
import { normalizeMapData } from './mapData';
import {
  MAX_SOURCE_CHARS,
  MAX_STEPS,
  RAPIDO_STEP_COUNT,
  SOURCE_TRUNCATION_NOTICE,
  buildDepthContract,
  buildInteractiveBlocksContract,
  capStepsForDepth,
  cleanJsonMapText,
  formatReadingProgressLabel,
  migrateCategoryToEnum,
  normalizeReadingSections,
  parseJsonMapText,
  truncateSourceText,
  unwrapSourceText,
  validateMimeType,
  validateTransformType,
  wrapSourceText,
} from './nucleoPipeline';
import {
  normalizeStepContentBlock,
  normalizeStepContentBlocks,
} from './stepContentBlocks';
import { isProUser } from './proEntitlement';
import { parseTransformStreamLine } from './transformStream';

const validMapFixture = {
  title: 'Mapa de prueba',
  coreIdea: 'Idea central breve',
  coreSupport: 'Apoyo breve',
  tldr: [
    { title: 'Uno', desc: 'Primero' },
    { title: 'Dos', desc: 'Segundo' },
    { title: 'Tres', desc: 'Tercero' },
  ],
  steps: Array.from({ length: 6 }, (_, index) => ({
    id: `step-${index + 1}`,
    shortNav: `Paso ${index + 1}`,
    title: `Paso ${index + 1}`,
    time: '~3 min',
    content: [{ type: 'prose', text: 'Contenido del paso.' }],
    selfCheck: '¿Qué recuerdas de este paso?',
  })),
  readingSections: [
    { title: 'Parte A', fromStep: 1, toStep: 3 },
    { title: 'Parte B', fromStep: 4, toStep: 6 },
  ],
  sourceMetadata: {
    kind: 'text',
    label: 'Fuente',
    detected: ['Fuente'],
    limitations: [],
  },
  coverage: { summary: 'Cobertura', notes: [] },
  completionCard: {
    title: 'Completado',
    summary: 'Resumen',
    takeaways: ['Uno'],
  },
};

describe('buildDepthContract', () => {
  it('profundo no menciona decenas y limita a 9 pasos', () => {
    const contract = buildDepthContract('profundo');
    expect(contract.toLowerCase()).not.toContain('decenas');
    expect(contract).toContain('9');
  });

  it('rapido exige exactamente 3 pasos', () => {
    const contract = buildDepthContract('rapido');
    expect(contract).toContain('exactamente 3 pasos');
  });
});

describe('capStepsForDepth', () => {
  it('limita rapido a 3 pasos', () => {
    const steps = Array.from({ length: 12 }, (_, index) => index);
    expect(capStepsForDepth(steps, 'rapido')).toHaveLength(RAPIDO_STEP_COUNT);
  });

  it('nunca supera 9 pasos', () => {
    const steps = Array.from({ length: 20 }, (_, index) => index);
    expect(capStepsForDepth(steps, 'profundo')).toHaveLength(MAX_STEPS);
  });
});

describe('migrateCategoryToEnum', () => {
  it('migra categorías personalizadas a Otros', () => {
    expect(migrateCategoryToEnum('Mi categoría rara')).toBe(FALLBACK_MAP_CATEGORY);
  });

  it('conserva categorías del enum', () => {
    expect(migrateCategoryToEnum('Negocio')).toBe('Negocio');
    expect(DEFAULT_MAP_CATEGORIES).toContain(migrateCategoryToEnum('Salud'));
  });
});

describe('source hardening helpers', () => {
  it('trunca fuentes largas', () => {
    const longText = 'a'.repeat(MAX_SOURCE_CHARS + 50);
    const result = truncateSourceText(longText);
    expect(result.truncated).toBe(true);
    expect(result.text).toHaveLength(MAX_SOURCE_CHARS);
  });

  it('envuelve y desenvuelve la fuente', () => {
    const wrapped = wrapSourceText('contenido');
    expect(wrapped).toContain('<<<FUENTE>>>');
    expect(unwrapSourceText(wrapped)).toBe('contenido');
  });

  it('valida type y mime permitidos', () => {
    expect(validateTransformType('pdf')).toBe(true);
    expect(validateTransformType('docx')).toBe(false);
    expect(validateMimeType('application/pdf')).toBe(true);
    expect(validateMimeType('application/msword')).toBe(false);
  });
});

describe('reading sections', () => {
  it('genera 2-3 secciones cuando hay 6 o más pasos', () => {
    const sections = normalizeReadingSections(6, null);
    expect(sections).not.toBeNull();
    expect(sections!.length).toBeGreaterThanOrEqual(2);
    expect(sections![0].fromStep).toBe(1);
    expect(sections!.at(-1)?.toStep).toBe(6);
  });

  it('formatea el label con sección activa', () => {
    const sections = normalizeReadingSections(6, validMapFixture.readingSections);
    const label = formatReadingProgressLabel(5, 6, sections);
    expect(label).toBe('SECCIÓN 2 · PASO 5 DE 6');
  });
});

describe('normalizeMapData', () => {
  it('acepta mapas válidos con autochequeo y secciones', () => {
    const normalized = normalizeMapData(validMapFixture, { depth: 'estandar' });
    expect(normalized).not.toBeNull();
    expect(normalized!.steps).toHaveLength(6);
    expect(normalized!.steps[0].selfCheck).toBe('¿Qué recuerdas de este paso?');
    expect(normalized!.readingSections).toHaveLength(2);
    expect(normalized!.category).toBe(FALLBACK_MAP_CATEGORY);
  });

  it('rechaza mapas inválidos', () => {
    expect(normalizeMapData({ title: 'Sin pasos', tldr: [] })).toBeNull();
  });

  it('añade aviso de truncado en limitations', () => {
    const normalized = normalizeMapData(validMapFixture, { sourceTruncated: true });
    expect(normalized!.sourceMetadata?.limitations).toContain(SOURCE_TRUNCATION_NOTICE);
  });
});

describe('JSON parsing', () => {
  it('parsea JSON con fences', () => {
    const parsed = parseJsonMapText('```json\n{"title":"Hola"}\n```');
    expect(parsed).toEqual({ title: 'Hola' });
  });

  it('cleanJsonMapText extrae el objeto', () => {
    expect(cleanJsonMapText('texto ```json {"a":1} ```')).toContain('"a":1');
  });

  it('falla con JSON inválido', () => {
    expect(() => parseJsonMapText('{invalid')).toThrow();
  });
});

describe('pro entitlement', () => {
  it('concede Pro a marcfreixanet@gmail.com', () => {
    expect(isProUser('marcfreixanet@gmail.com')).toBe(true);
  });

  it('niega Pro a cuentas ajenas', () => {
    expect(isProUser('otro@ejemplo.com')).toBe(false);
  });
});

describe('NDJSON stream parsing', () => {
  it('parsea eventos partial y done', () => {
    const partial = parseTransformStreamLine(
      JSON.stringify({ type: 'partial', map: { title: 'Parcial' } })
    );
    const done = parseTransformStreamLine(
      JSON.stringify({ type: 'done', map: validMapFixture, model: 'test' })
    );
    expect(partial?.type).toBe('partial');
    expect(done?.type).toBe('done');
  });

  it('ignora líneas vacías o corruptas', () => {
    expect(parseTransformStreamLine('')).toBeNull();
    expect(parseTransformStreamLine('{no-json')).toBeNull();
  });
});

describe('buildInteractiveBlocksContract', () => {
  it('understand prioriza comparison/stat/accordion y quiz al cierre', () => {
    const contract = buildInteractiveBlocksContract('understand');
    expect(contract).toContain('comparison');
    expect(contract).toContain('cierre');
  });

  it('study enfatiza quiz y accordion', () => {
    const contract = buildInteractiveBlocksContract('study');
    expect(contract.toLowerCase()).toContain('quiz');
    expect(contract.toLowerCase()).toContain('accordion');
  });

  it('apply prioriza acción y teoría en accordions', () => {
    const contract = buildInteractiveBlocksContract('apply');
    expect(contract.toLowerCase()).toContain('acción');
    expect(contract.toLowerCase()).toContain('accordions');
  });
});

describe('normalizeStepContentBlock interactive catalog', () => {
  it('acepta stat válido', () => {
    const block = normalizeStepContentBlock({
      type: 'stat',
      value: '70%',
      label: 'de la carga baja',
      source: 'fuente',
      emphasis: 'hero',
    });
    expect(block).toEqual({
      type: 'stat',
      value: '70%',
      label: 'de la carga baja',
      source: 'fuente',
      emphasis: 'hero',
    });
  });

  it('descarta stat sin value/label', () => {
    const dropped: string[] = [];
    expect(
      normalizeStepContentBlock(
        { type: 'stat', value: '1' },
        { onDrop: (reason) => dropped.push(reason) }
      )
    ).toBeNull();
    expect(dropped[0]).toContain('stat-missing');
  });

  it('acepta comparison 2 columnas y descarta filas mal alineadas', () => {
    const block = normalizeStepContentBlock({
      type: 'comparison',
      columns: ['A', 'B'],
      rows: [
        { label: 'Inicio', values: ['x', 'y'] },
        { label: 'Bad', values: ['solo-uno'] },
      ],
    });
    expect(block?.type).toBe('comparison');
    if (block?.type === 'comparison') {
      expect(block.rows).toHaveLength(1);
      expect(block.columns).toEqual(['A', 'B']);
    }
  });

  it('descarta comparison con 1 o 4 columnas', () => {
    expect(
      normalizeStepContentBlock({
        type: 'comparison',
        columns: ['Solo'],
        rows: [{ label: 'r', values: ['a'] }],
      })
    ).toBeNull();
  });

  it('acepta accordion válido', () => {
    const block = normalizeStepContentBlock({
      type: 'accordion',
      title: '¿Por qué importa?',
      body: 'Porque externaliza el plan.',
    });
    expect(block).toMatchObject({
      type: 'accordion',
      title: '¿Por qué importa?',
      body: 'Porque externaliza el plan.',
    });
  });

  it('descarta accordion sin body', () => {
    expect(
      normalizeStepContentBlock({ type: 'accordion', title: '¿Hola?' })
    ).toBeNull();
  });

  it('acepta quiz con correct en rango', () => {
    const block = normalizeStepContentBlock({
      type: 'quiz',
      question: '¿Qué hace el plan?',
      options: ['A', 'B', 'C'],
      correct: 1,
      feedback: 'Externaliza el siguiente paso.',
    });
    expect(block).toMatchObject({ type: 'quiz', correct: 1 });
  });

  it('descarta quiz con correct fuera de rango', () => {
    const dropped: string[] = [];
    expect(
      normalizeStepContentBlock(
        {
          type: 'quiz',
          question: '¿?',
          options: ['A', 'B'],
          correct: 2,
          feedback: 'x',
        },
        { onDrop: (reason) => dropped.push(reason) }
      )
    ).toBeNull();
    expect(dropped[0]).toBe('quiz-correct-out-of-range');
  });

  it('preserva bloques legacy y descarta interactivos malformados en lote', () => {
    const blocks = normalizeStepContentBlocks([
      { type: 'prose', text: 'Sigue válido.' },
      { type: 'quiz', question: 'q', options: ['a'], correct: 0, feedback: 'f' },
      {
        type: 'stat',
        value: '3',
        label: 'días',
        emphasis: 'normal',
      },
    ]);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe('prose');
    expect(blocks[1]?.type).toBe('stat');
  });

  it('descarta prose huérfano que termina en ":" antes de un bloque dropeado', () => {
    const dropped: string[] = [];
    const blocks = normalizeStepContentBlocks(
      [
        { type: 'prose', text: 'Tres capas del sistema:' },
        { type: 'stat', value: '1' }, // missing label → drop
        { type: 'prose', text: 'Sigue válido.' },
      ],
      { onDrop: (reason) => dropped.push(reason) }
    );
    expect(blocks.map((b) => b.type)).toEqual(['prose']);
    expect(blocks[0]).toMatchObject({ type: 'prose', text: 'Sigue válido.' });
    expect(dropped).toContain('stat-missing-value-or-label');
    expect(dropped).toContain('orphan-prose-before-dropped-block');
  });

  it('descarta tipos fuera de allowlist (p. ej. timeline) sin half-render', () => {
    const dropped: string[] = [];
    expect(
      normalizeStepContentBlock(
        { type: 'timeline', text: 'no debe renderizarse' },
        { onDrop: (reason) => dropped.push(reason) }
      )
    ).toBeNull();
    expect(dropped[0]).toBe('unknown-type:timeline');
  });

  it('normalizeMapData: step con diagram/timeline queda sin esos bloques (sin error)', () => {
    const normalized = normalizeMapData({
      ...validMapFixture,
      steps: [
        {
          id: 'step-1',
          shortNav: 'Uno',
          title: 'Paso con basura tipada',
          time: '~2 min',
          content: [
            { type: 'prose', text: 'Queda.' },
            { type: 'diagram', nodes: [{ id: 'a' }] },
            { type: 'timeline', events: ['antes', 'después'] },
            {
              type: 'stat',
              value: '2',
              label: 'ejes',
            },
          ],
        },
      ],
    });
    expect(normalized.steps).toHaveLength(1);
    const types = normalized.steps[0]!.content.map((b) => b.type);
    expect(types).toEqual(['prose', 'stat']);
    expect(types).not.toContain('diagram');
    expect(types).not.toContain('timeline');
  });

  it('normalizeMapData conserva los 4 tipos interactivos', () => {
    const normalized = normalizeMapData({
      ...validMapFixture,
      steps: [
        {
          id: 'step-1',
          shortNav: 'Uno',
          title: 'Paso con catálogo',
          time: '~2 min',
          content: [
            {
              type: 'stat',
              value: '42%',
              label: 'de casos',
              emphasis: 'hero',
            },
            {
              type: 'comparison',
              columns: ['Antes', 'Después'],
              rows: [{ label: 'Foco', values: ['Bajo', 'Alto'] }],
            },
            {
              type: 'accordion',
              title: '¿Qué cambia?',
              body: 'La memoria de trabajo se libera.',
            },
            {
              type: 'quiz',
              question: '¿Qué externaliza el plan?',
              options: ['La motivación', 'El siguiente paso', 'El sueño'],
              correct: 1,
              feedback: 'Externaliza el siguiente paso, no la motivación.',
            },
            { type: 'quiz', question: 'roto', options: ['a'], correct: 9, feedback: 'x' },
          ],
        },
      ],
    });

    expect(normalized?.steps[0]?.content.map((b) => b.type)).toEqual([
      'stat',
      'comparison',
      'accordion',
      'quiz',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_MAP_CATEGORIES, FALLBACK_MAP_CATEGORY } from './categories';
import { normalizeMapData } from './mapData';
import {
  MAX_SOURCE_CHARS,
  MAX_STEPS,
  RAPIDO_STEP_COUNT,
  SOURCE_TRUNCATION_NOTICE,
  buildDepthContract,
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

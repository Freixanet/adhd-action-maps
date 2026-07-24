import type { MapDepth, ReadingSection, TransformRequest } from './contracts';
import { DEFAULT_MAP_CATEGORIES, FALLBACK_MAP_CATEGORY } from './categories';

export const MAX_SOURCE_CHARS = 120_000;
export const SOURCE_TRUNCATION_NOTICE = 'Fuente truncada a 120k caracteres.';
export const MAX_STEPS = 9;
export const RAPIDO_STEP_COUNT = 3;

export const VALID_TRANSFORM_TYPES = [
  'text',
  'link',
  'youtube',
  'pdf',
  'image',
  'video',
] as const satisfies readonly TransformRequest['type'][];

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
] as const;

export function buildDepthContract(depth?: MapDepth): string {
  const resolvedDepth = depth === 'rapido' || depth === 'profundo' ? depth : 'estandar';

  if (resolvedDepth === 'rapido') {
    return [
      'CONTRATO ACTIVO DE PROFUNDIDAD (rapido — Rápido):',
      'Resultado breve y escaneable; prevalece sobre instrucciones genéricas de cobertura exhaustiva.',
      'Genera exactamente 3 pasos (ni más ni menos).',
      'Prioriza núcleo (coreIdea, tldr) y conceptos imprescindibles; knowledgeSections mínimas (0–2 entradas cortas).',
      'Evita sublistas extensas y bloques prose largos; frases cortas.',
      'Si omites material por síntesis, decláralo en coverage.limitations.',
    ].join('\n');
  }

  if (resolvedDepth === 'profundo') {
    return [
      'CONTRATO ACTIVO DE PROFUNDIDAD (profundo — Profundo):',
      'Análisis completo; prevalece sobre brevedad.',
      'Genera entre 7 y 9 pasos como objetivo (máximo absoluto 9).',
      'Desarrolla matices, límites, ejemplos e implicaciones; no colapses fuentes densas.',
      'Cada paso debe funcionar como una página móvil: denso, completo y legible, con scroll corto solo ante overflow o texto ampliado, 2-4 bloques útiles y ≥1 bloque interactivo.',
      'knowledgeSections más ricas; granularidad fina: no fusiones unidades que el lector necesitaría separar.',
      'Si una unidad relevante no cabe en una página, crea otro paso hasta el máximo permitido; no descartes en silencio.',
    ].join('\n');
  }

  return [
    'CONTRATO ACTIVO DE PROFUNDIDAD (estandar — Estándar):',
    'Equilibrio entre cobertura y brevedad.',
    'Genera entre 4 y 6 pasos como objetivo (máximo absoluto 9).',
    'Cubre lo importante sin ser exhaustivo; una unidad principal por paso.',
    'Cada paso debe funcionar como una página móvil adaptativa: contenido suficiente para ocupar bien la pantalla, sin relleno ni scroll largo, con ≥1 bloque interactivo.',
    'Ejemplos solo donde clarifiquen; granularidad media.',
    'knowledgeSections moderadas; si omites algo relevante por espacio, decláralo en coverage.limitations.',
  ].join('\n');
}

/** Intent bias for interactive content blocks (mirrors server buildIntentGuide). */
export function buildInteractiveBlocksContract(intent?: import('./contracts').MapIntent): string {
  const resolved = intent === 'study' || intent === 'apply' ? intent : 'understand';
  if (resolved === 'apply') {
    return [
      'CONTRATO DE BLOQUES INTERACTIVOS (apply):',
      'Mantén list/callout de acción dominantes; teoría en accordions.',
      'stat/comparison solo si clarifican una decisión; quiz escaso.',
      'Cada página: ≥1 interactivo; en ≥3 bloques, prose ≤40%; en 2 bloques, máximo 1 prose.',
    ].join('\n');
  }
  if (resolved === 'study') {
    return [
      'CONTRATO DE BLOQUES INTERACTIVOS (study):',
      'quiz y accordion frecuentes; comparison para contrastes a memorizar; stat para cifras ancla.',
      'Cada página: ≥1 interactivo; en ≥3 bloques, prose ≤40%; en 2 bloques, máximo 1 prose.',
    ].join('\n');
  }
  return [
    'CONTRATO DE BLOQUES INTERACTIVOS (understand):',
    'Prioriza comparison, stat y accordion; quiz solo al cierre del mapa.',
    'Cada página: ≥1 interactivo; en ≥3 bloques, prose ≤40%; en 2 bloques, máximo 1 prose; máximo un emphasis hero por página.',
  ].join('\n');
}

export function migrateCategoryToEnum(input: unknown): string {
  const name = String(input ?? '').trim();
  if (!name) return FALLBACK_MAP_CATEGORY;
  const match = DEFAULT_MAP_CATEGORIES.find(
    (category) => category.toLowerCase() === name.toLowerCase()
  );
  return match ?? FALLBACK_MAP_CATEGORY;
}

export function truncateSourceText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_SOURCE_CHARS) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, MAX_SOURCE_CHARS), truncated: true };
}

export function wrapSourceText(text: string): string {
  return `<<<FUENTE>>>\n${text}\n<<<FIN_FUENTE>>>`;
}

export function validateTransformType(type: unknown): type is TransformRequest['type'] {
  return (
    typeof type === 'string' &&
    (VALID_TRANSFORM_TYPES as readonly string[]).includes(type)
  );
}

export function validateMimeType(mimeType: unknown): boolean {
  if (typeof mimeType !== 'string' || !mimeType.trim()) return false;
  const normalized = mimeType.trim().toLowerCase();
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(normalized);
}

export function capStepsForDepth<T>(steps: T[], depth?: MapDepth): T[] {
  if (!Array.isArray(steps)) return [];
  const limited = steps.slice(0, MAX_STEPS);
  if (depth === 'rapido') return limited.slice(0, RAPIDO_STEP_COUNT);
  return limited;
}

function autoGenerateReadingSections(stepCount: number): ReadingSection[] {
  const sectionCount = stepCount >= 8 ? 3 : 2;
  const sections: ReadingSection[] = [];
  let cursor = 1;

  for (let index = 0; index < sectionCount; index += 1) {
    const remainingSections = sectionCount - index;
    const remainingSteps = stepCount - cursor + 1;
    const span = Math.max(1, Math.ceil(remainingSteps / remainingSections));
    const fromStep = cursor;
    const toStep = Math.min(stepCount, cursor + span - 1);
    sections.push({
      title: `Sección ${index + 1}`,
      fromStep,
      toStep,
    });
    cursor = toStep + 1;
  }

  return sections;
}

export function normalizeReadingSections(
  stepCount: number,
  raw: unknown
): ReadingSection[] | null {
  if (stepCount < 6) return null;

  const parsed = Array.isArray(raw)
    ? raw
        .map((item) => {
          const section = item as {
            title?: unknown;
            titulo?: unknown;
            fromStep?: unknown;
            toStep?: unknown;
            desdePaso?: unknown;
            hastaPaso?: unknown;
          };
          const title = String(section.title ?? section.titulo ?? '').trim();
          const fromStep = Number(section.fromStep ?? section.desdePaso);
          const toStep = Number(section.toStep ?? section.hastaPaso);
          if (!title || !Number.isFinite(fromStep) || !Number.isFinite(toStep)) return null;
          return {
            title,
            fromStep: Math.max(1, Math.floor(fromStep)),
            toStep: Math.min(stepCount, Math.floor(toStep)),
          } satisfies ReadingSection;
        })
        .filter(Boolean) as ReadingSection[]
    : [];

  const candidate =
    parsed.length >= 2 && parsed.length <= 3 ? parsed : autoGenerateReadingSections(stepCount);

  const sorted = [...candidate].sort((a, b) => a.fromStep - b.fromStep);
  if (sorted.length < 2 || sorted.length > 3) {
    return autoGenerateReadingSections(stepCount);
  }

  if (sorted[0].fromStep !== 1 || sorted[sorted.length - 1].toStep !== stepCount) {
    return autoGenerateReadingSections(stepCount);
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const section = sorted[index];
    if (section.fromStep > section.toStep) return autoGenerateReadingSections(stepCount);
    if (index > 0 && section.fromStep !== sorted[index - 1].toStep + 1) {
      return autoGenerateReadingSections(stepCount);
    }
  }

  return sorted;
}

export function getReadingSectionForStep(
  step: number,
  sections: ReadingSection[] | null | undefined
): ReadingSection | null {
  if (!sections?.length || step <= 0) return null;
  return sections.find((section) => step >= section.fromStep && step <= section.toStep) ?? null;
}

export function getReadingSectionIndex(
  step: number,
  sections: ReadingSection[] | null | undefined
): number {
  if (!sections?.length || step <= 0) return 0;
  const index = sections.findIndex(
    (section) => step >= section.fromStep && step <= section.toStep
  );
  return index >= 0 ? index + 1 : 0;
}

export function isLastStepInReadingSection(
  step: number,
  sections: ReadingSection[] | null | undefined
): boolean {
  const section = getReadingSectionForStep(step, sections);
  return section != null && step === section.toStep;
}

export function formatReadingProgressLabel(
  step: number,
  totalSteps: number,
  sections: ReadingSection[] | null | undefined
): string {
  if (step <= 0) return 'Introducción';
  const sectionIndex = getReadingSectionIndex(step, sections);
  if (sectionIndex > 0) {
    return `SECCIÓN ${sectionIndex} · PASO ${step} DE ${totalSteps}`;
  }
  return `Paso ${step} de ${totalSteps}`;
}

export function cleanJsonMapText(text: string): string {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*)/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].replace(/\s*```\s*$/, '').trim();
  }
  const start = cleaned.indexOf('{');
  return start >= 0 ? cleaned.slice(start) : cleaned;
}

export function parseJsonMapText(text: string): unknown {
  const cleaned = cleanJsonMapText(text);
  return JSON.parse(cleaned);
}

export function extractSelfCheck(step: unknown): string | null {
  const value = step as { selfCheck?: unknown; autochequeo?: unknown };
  const raw = value.selfCheck ?? value.autochequeo;
  const text = String(raw ?? '').trim();
  return text || null;
}

export function resolveLlmTimeoutMs(
  depth?: MapDepth,
  generationMode?: string
): number {
  // Visualize-compiler and deep maps routinely exceed 60s on Gemini.
  if (generationMode === 'visualize-html-test') {
    return depth === 'profundo' ? 300_000 : 240_000;
  }
  return depth === 'profundo' ? 240_000 : 120_000;
}

export function unwrapSourceText(contents: string): string {
  const wrapped = contents.match(/<<<FUENTE>>>\s*([\s\S]*?)\s*<<<FIN_FUENTE>>>/);
  if (wrapped) return wrapped[1].trim();
  const marker = '\n\nContenido fuente:\n';
  const idx = contents.indexOf(marker);
  if (idx >= 0) return contents.slice(idx + marker.length).trim();
  return contents.trim();
}

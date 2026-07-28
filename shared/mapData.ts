import type {
  ActionMapData,
  CoverageNote,
  KnowledgeSection,
  MapDepth,
  MapStep,
  SourceReference,
} from './contracts';
import type { Citation, SourceChunk, SourceChunkLoc } from './types/chunk';
import { resolveNucleoGenerationMode } from './contracts';
import { FALLBACK_MAP_CATEGORY, normalizeTags, resolveMapCategory } from './categories';
import {
  capStepsForDepth,
  extractSelfCheck,
  normalizeReadingSections,
  SOURCE_TRUNCATION_NOTICE,
} from './nucleoPipeline';
// F3: re-spec pending — NucleoVisualSpec channel off; keep module for future.
// import { normalizeNucleoVisual } from './nucleoVisual';
import { normalizeVisualizeArtifact } from './visualizeCompiler';
import { normalizePersistedVisualizationRun } from './visualize';
import { normalizeStepContentBlocks } from './stepContentBlocks';

function normalizeReferences(input: unknown): SourceReference[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((ref) => {
      const value = ref as SourceReference;
      if (!value?.label || !value?.locator) return null;
      const chunkId =
        typeof value.chunkId === 'string' && value.chunkId.trim()
          ? value.chunkId.trim()
          : undefined;
      return {
        label: String(value.label),
        locator: String(value.locator),
        locatorKind: value.locatorKind,
        excerpt: value.excerpt ? String(value.excerpt) : undefined,
        note: value.note ? String(value.note) : undefined,
        chunkId,
      } satisfies SourceReference;
    })
    .filter(Boolean) as SourceReference[];
}

function normalizeSourceChunkLoc(input: unknown): SourceChunkLoc | null {
  if (!input || typeof input !== 'object') return null;
  const loc = input as SourceChunkLoc;
  const start = Number(loc.start);
  const end = Number(loc.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return {
    start,
    end,
    chapterTitle: loc.chapterTitle ? String(loc.chapterTitle) : undefined,
    chapterIndex:
      typeof loc.chapterIndex === 'number' && Number.isFinite(loc.chapterIndex)
        ? loc.chapterIndex
        : undefined,
    page: typeof loc.page === 'number' && Number.isFinite(loc.page) ? loc.page : undefined,
    timestamp:
      typeof loc.timestamp === 'number' && Number.isFinite(loc.timestamp)
        ? loc.timestamp
        : undefined,
    imageId: loc.imageId ? String(loc.imageId) : undefined,
    bbox: loc.bbox,
  };
}

function normalizeCitedChunks(input: unknown): SourceChunk[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const chunks = input
    .map((item) => {
      const raw = item as SourceChunk;
      if (!raw?.id || !raw?.text || !raw?.hash) return null;
      const loc = normalizeSourceChunkLoc(raw.loc);
      if (!loc) return null;
      return {
        id: String(raw.id),
        text: String(raw.text),
        hash: String(raw.hash),
        loc,
      } satisfies SourceChunk;
    })
    .filter(Boolean) as SourceChunk[];
  return chunks.length ? chunks : undefined;
}

function normalizeCitations(input: unknown): Citation[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const citations = input
    .map((item) => {
      const raw = item as Citation;
      if (!raw?.id || !raw?.chunkId || !raw?.label) return null;
      const loc = normalizeSourceChunkLoc(raw.loc);
      if (!loc) return null;
      return {
        id: String(raw.id),
        chunkId: String(raw.chunkId),
        label: String(raw.label),
        loc,
      } satisfies Citation;
    })
    .filter(Boolean) as Citation[];
  return citations.length ? citations : undefined;
}

export function normalizeMapData(
  input: unknown,
  options?: { depth?: MapDepth; sourceTruncated?: boolean }
): ActionMapData | null {
  const raw = input as ActionMapData;
  if (!raw?.title || !Array.isArray(raw?.steps) || !Array.isArray(raw?.tldr)) return null;

  const cappedSteps = capStepsForDepth(raw.steps, options?.depth);
  const contentKind =
    raw.sourceMetadata?.contentKind === 'book' ||
    raw.sourceMetadata?.contentKind === 'article' ||
    raw.sourceMetadata?.contentKind === 'report' ||
    raw.sourceMetadata?.contentKind === 'paper' ||
    raw.sourceMetadata?.contentKind === 'manual' ||
    raw.sourceMetadata?.contentKind === 'notes' ||
    raw.sourceMetadata?.contentKind === 'slides' ||
    raw.sourceMetadata?.contentKind === 'transcript' ||
    raw.sourceMetadata?.contentKind === 'other'
      ? raw.sourceMetadata.contentKind
      : undefined;
  const normalizedSteps: MapStep[] = cappedSteps.map((step, index) => ({
    id: String(step?.id || `step-${index + 1}`),
    shortNav: String(step?.shortNav || step?.title || `Paso ${index + 1}`),
    title: String(step?.title || `Paso ${index + 1}`),
    time: String(step?.time || '~3 min'),
    purpose: step?.purpose ? String(step.purpose) : undefined,
    content: normalizeStepContentBlocks(step?.content, {
      onDrop: (reason) => {
        if (typeof console !== 'undefined') {
          console.warn(`[normalizeMapData] dropped step content block: ${reason}`);
        }
      },
    }),
    references: normalizeReferences(step?.references),
    selfCheck: extractSelfCheck(step),
  }));

  const normalized: ActionMapData = {
    title: String(raw.title),
    category: resolveMapCategory(raw.category ?? raw.suggestedCategory),
    tags: normalizeTags(raw.tags ?? raw.suggestedTags),
    intent: raw.intent === 'study' || raw.intent === 'apply' ? raw.intent : 'understand',
    outputLanguage: raw.outputLanguage ? String(raw.outputLanguage) : 'es',
    mapVersion: Number.isFinite(raw.mapVersion) ? Number(raw.mapVersion) : 2,
    generationMode: resolveNucleoGenerationMode(raw.generationMode),
    sourceMetadata: {
      kind: raw.sourceMetadata?.kind || 'text',
      contentKind,
      label: raw.sourceMetadata?.label || 'Fuente analizada',
      url: raw.sourceMetadata?.url ? String(raw.sourceMetadata.url) : undefined,
      title: raw.sourceMetadata?.title ? String(raw.sourceMetadata.title) : undefined,
      author: raw.sourceMetadata?.author ? String(raw.sourceMetadata.author) : undefined,
      language: raw.sourceMetadata?.language ? String(raw.sourceMetadata.language) : undefined,
      detected: Array.isArray(raw.sourceMetadata?.detected)
        ? raw.sourceMetadata.detected.map((item) => String(item))
        : [],
      limitations: Array.isArray(raw.sourceMetadata?.limitations)
        ? raw.sourceMetadata.limitations.map((item) => String(item))
        : [],
    },
    coverage: {
      summary: raw.coverage?.summary
        ? String(raw.coverage.summary)
        : 'Lectura generada a partir del material disponible.',
      notes: Array.isArray(raw.coverage?.notes)
        ? (raw.coverage.notes
            .map((note) =>
              note?.label && note?.detail
                ? {
                    label: String(note.label),
                    detail: String(note.detail),
                    tone: note?.tone === 'warning' ? ('warning' as const) : ('neutral' as const),
                  }
                : null
            )
            .filter(Boolean) as CoverageNote[])
        : [],
    },
    coreIdea: String(raw.coreIdea || ''),
    coreSupport: String(raw.coreSupport || ''),
    tldr: raw.tldr
      .map((item) =>
        item?.title && item?.desc
          ? {
              title: String(item.title).trim(),
              desc: String(item.desc).trim().replace(/\s+/g, ' '),
            }
          : null
      )
      .filter(Boolean) as ActionMapData['tldr'],
    knowledgeSections: Array.isArray(raw.knowledgeSections)
      ? (raw.knowledgeSections
          .map((section) =>
            section?.title && section?.summary
              ? {
                  title: String(section.title),
                  summary: String(section.summary),
                  references: normalizeReferences(section.references),
                }
              : null
          )
          .filter(Boolean) as KnowledgeSection[])
      : [],
    readingSections: normalizeReadingSections(normalizedSteps.length, raw.readingSections),
    steps: normalizedSteps,
    references: normalizeReferences(raw.references),
    citations: normalizeCitations(raw.citations),
    citedChunks: normalizeCitedChunks(raw.citedChunks),
    completionCard: {
      title: raw.completionCard?.title ? String(raw.completionCard.title) : 'Mapa completado',
      summary: raw.completionCard?.summary
        ? String(raw.completionCard.summary)
        : 'Vuelve aquí para repasar lo esencial sin tener que releerlo todo.',
      takeaways: Array.isArray(raw.completionCard?.takeaways)
        ? raw.completionCard.takeaways.map((item) => String(item)).filter(Boolean)
        : [],
      promptQuestion: raw.completionCard?.promptQuestion
        ? String(raw.completionCard.promptQuestion)
        : undefined,
    },
    modelUsed: raw.modelUsed ? String(raw.modelUsed) : undefined,
  };

  // F3: re-spec pending — visualization channel off; ignore if present (history or model).
  normalized.steps.forEach((step, index) => {
    const rawStepVisual = (cappedSteps[index] as { visualization?: unknown } | undefined)?.visualization;
    if (rawStepVisual != null) {
      console.warn(
        '[normalizeMapData] ignored step.visualization — F3: re-spec pending'
      );
    }
    step.visualization = undefined;
  });
  if ((raw as { visualization?: unknown }).visualization != null) {
    console.warn('[normalizeMapData] ignored visualization — F3: re-spec pending');
  }
  normalized.visualization = undefined;
  normalized.visualizeArtifact = normalizeVisualizeArtifact(
    (raw as ActionMapData).visualizeArtifact
  );
  normalized.visualizeRun = normalizePersistedVisualizationRun(
    (raw as ActionMapData).visualizeRun
  );

  if (!normalized.sourceMetadata!.detected.length) {
    normalized.sourceMetadata!.detected = [normalized.sourceMetadata!.label];
  }
  if (!normalized.sourceMetadata!.url) {
    const meta = normalized.sourceMetadata!;
    const label = meta.label.trim();
    if (/^https?:\/\//i.test(label)) {
      meta.url = label;
    } else {
      const fromDetected = meta.detected.find((item) => /^https?:\/\//i.test(item.trim()));
      if (fromDetected) meta.url = fromDetected.trim();
    }
  }
  if (options?.sourceTruncated) {
    const limitations = normalized.sourceMetadata!.limitations ?? [];
    normalized.sourceMetadata!.limitations = [
      ...limitations.filter((item) => item !== SOURCE_TRUNCATION_NOTICE),
      SOURCE_TRUNCATION_NOTICE,
    ];
  }
  if (!normalized.completionCard!.takeaways.length) {
    normalized.completionCard!.takeaways = normalized.tldr
      .slice(0, 5)
      .map((item) => `${item.title}: ${item.desc}`);
  }

  return normalized;
}

export function isValidMap(data: unknown): data is ActionMapData {
  return normalizeMapData(data) !== null;
}

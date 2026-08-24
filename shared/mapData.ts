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
import { attachLumenCanvas } from './lumen/toMap';
import { normalizePersistedVisualizationRun } from './visualize';
import { validateEditorialPlan, type EditorialPlan } from './editorial';
import { normalizeStepContentBlocks } from './stepContentBlocks';
import { ensureLayer0, isLayer0Complete, normalizeLayer0 } from './layer0';
import { rehydrateUnderstanding } from './understanding/validate';
import { validateEvidenceArtifact } from './evidence/validate';
import { rehydrateApplication } from './application/validate';
import { pickReadyAssistantMessage } from './deliveryMessage';
import { normalizeTldrItems } from './tldr';

function normalizeEditorialPlanField(input: unknown): EditorialPlan | null {
  if (input == null) return null;
  const result = validateEditorialPlan(input);
  return result.plan;
}

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
  options?: { depth?: MapDepth; sourceTruncated?: boolean; allowPartial?: boolean }
): ActionMapData | null {
  const raw = input as ActionMapData;
  const earlyLayer0 = normalizeLayer0(raw?.layer0);
  const allowPartial = Boolean(options?.allowPartial && isLayer0Complete(earlyLayer0));

  if (!raw?.title || !Array.isArray(raw?.steps) || !Array.isArray(raw?.tldr)) {
    if (!allowPartial) return null;
  }

  const stepsInput = Array.isArray(raw?.steps) ? raw.steps : [];
  const tldrInput = Array.isArray(raw?.tldr) ? raw.tldr : [];
  const cappedSteps = capStepsForDepth(stepsInput, options?.depth);
  const contentKind =
    raw?.sourceMetadata?.contentKind === 'book' ||
    raw?.sourceMetadata?.contentKind === 'article' ||
    raw?.sourceMetadata?.contentKind === 'report' ||
    raw?.sourceMetadata?.contentKind === 'paper' ||
    raw?.sourceMetadata?.contentKind === 'manual' ||
    raw?.sourceMetadata?.contentKind === 'notes' ||
    raw?.sourceMetadata?.contentKind === 'slides' ||
    raw?.sourceMetadata?.contentKind === 'transcript' ||
    raw?.sourceMetadata?.contentKind === 'other'
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
    title: String(raw?.title || 'Tu Núcleo'),
    category: resolveMapCategory(raw?.category ?? raw?.suggestedCategory),
    tags: normalizeTags(raw?.tags ?? raw?.suggestedTags),
    intent: raw?.intent === 'study' || raw?.intent === 'apply' ? raw.intent : 'understand',
    outputLanguage: raw?.outputLanguage ? String(raw.outputLanguage) : 'es',
    mapVersion: Number.isFinite(raw?.mapVersion) ? Number(raw.mapVersion) : 2,
    generationMode: resolveNucleoGenerationMode(raw?.generationMode),
    sourceMetadata: {
      kind: raw?.sourceMetadata?.kind || 'text',
      contentKind,
      label: raw?.sourceMetadata?.label || 'Fuente analizada',
      url: raw?.sourceMetadata?.url ? String(raw.sourceMetadata.url) : undefined,
      title: raw?.sourceMetadata?.title ? String(raw.sourceMetadata.title) : undefined,
      author: raw?.sourceMetadata?.author ? String(raw.sourceMetadata.author) : undefined,
      language: raw?.sourceMetadata?.language ? String(raw.sourceMetadata.language) : undefined,
      detected: Array.isArray(raw?.sourceMetadata?.detected)
        ? raw.sourceMetadata.detected.map((item) => String(item))
        : [],
      limitations: Array.isArray(raw?.sourceMetadata?.limitations)
        ? raw.sourceMetadata.limitations.map((item) => String(item))
        : [],
    },
    coverage: {
      summary: raw?.coverage?.summary
        ? String(raw.coverage.summary)
        : 'Lectura generada a partir del material disponible.',
      notes: Array.isArray(raw?.coverage?.notes)
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
    coreIdea: String(raw?.coreIdea || ''),
    coreSupport: String(raw?.coreSupport || ''),
    deliveryMessage: pickReadyAssistantMessage({
      deliveryMessage:
        typeof (raw as { deliveryMessage?: unknown })?.deliveryMessage === 'string'
          ? String((raw as { deliveryMessage?: string }).deliveryMessage).trim()
          : '',
      title: String(raw?.title || 'Tu Núcleo'),
      coreIdea: String(raw?.coreIdea || ''),
      sourceKind: raw?.sourceMetadata?.kind || 'text',
      sourceLabel:
        raw?.sourceMetadata?.label ||
        raw?.sourceMetadata?.title ||
        undefined,
      stepCount: normalizedSteps.length,
      stepNames: normalizedSteps
        .slice(0, 4)
        .map((step) => step.shortNav || step.title)
        .filter(Boolean),
      tldrTitles: normalizeTldrItems(tldrInput)
        .slice(0, 3)
        .map((item) => item.title)
        .filter(Boolean),
    }),
    layer0: earlyLayer0,
    tldr: normalizeTldrItems(tldrInput),
    knowledgeSections: Array.isArray(raw?.knowledgeSections)
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
    readingSections: normalizeReadingSections(normalizedSteps.length, raw?.readingSections),
    steps: normalizedSteps,
    references: normalizeReferences(raw?.references),
    citations: normalizeCitations(raw?.citations),
    citedChunks: normalizeCitedChunks(raw?.citedChunks),
    completionCard: {
      title: raw?.completionCard?.title ? String(raw.completionCard.title) : 'Mapa completado',
      summary: raw?.completionCard?.summary
        ? String(raw.completionCard.summary)
        : 'Vuelve aquí para repasar lo esencial sin tener que releerlo todo.',
      takeaways: Array.isArray(raw?.completionCard?.takeaways)
        ? raw.completionCard.takeaways.map((item) => String(item)).filter(Boolean)
        : [],
      promptQuestion: raw?.completionCard?.promptQuestion
        ? String(raw.completionCard.promptQuestion)
        : undefined,
    },
    modelUsed: raw?.modelUsed ? String(raw.modelUsed) : undefined,
  };

  // S04: strict rehydration — never soft-preserve unvalidated IR.
  // Allowed chunk IDs come only from an independent set:
  // citedChunks (exact ingest text) and/or chunkIdManifest (IDs from ingest).
  // Never from the artifact's own segmentRefs.
  const rawUnderstanding = (raw as ActionMapData | undefined)?.understanding;
  if (rawUnderstanding != null) {
    const fromCited = (normalized.citedChunks ?? []).map((c) => c.id).filter(Boolean);
    const fromManifest = Array.isArray((raw as ActionMapData)?.chunkIdManifest)
      ? ((raw as ActionMapData).chunkIdManifest as string[]).filter(Boolean)
      : [];
    const independentChunkIds = new Set([...fromCited, ...fromManifest]);
    // Persist manifest on normalized map when present (IDs only).
    if (fromManifest.length) {
      normalized.chunkIdManifest = [...new Set(fromManifest)];
    }
    const hydrated = rehydrateUnderstanding(rawUnderstanding, {
      allowedChunkIds: independentChunkIds.size ? independentChunkIds : undefined,
    });
    if (hydrated) {
      normalized.understanding = hydrated;
    }
    // Invalid / unknown version / hostile / self-only refs → omit (legacy map body still opens)
  }

  // S05: keep evidence only when schema validates; never invent citations from it.
  const rawEvidence = (raw as ActionMapData | undefined)?.evidence;
  if (rawEvidence != null) {
    const independentChunkIds = new Set(
      [
        ...(normalized.citedChunks ?? []).map((c) => c.id),
        ...(normalized.chunkIdManifest ?? []),
      ].filter(Boolean)
    );
    const ev = validateEvidenceArtifact(rawEvidence, {
      allowedChunkIds: independentChunkIds.size ? independentChunkIds : undefined,
      strictVersions: true,
    });
    if (ev.ok) {
      normalized.evidence = ev.value;
    }
  }

  // S06: keep application only when schema validates; never invent context.
  const rawApplication = (raw as ActionMapData | undefined)?.application;
  if (rawApplication != null) {
    const hydratedApp = rehydrateApplication(rawApplication);
    if (hydratedApp) {
      normalized.application = hydratedApp;
    }
  }

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
  normalized.editorialPlan = normalizeEditorialPlanField((raw as ActionMapData).editorialPlan);

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
      .slice(0, 4)
      .map((item) => `${item.title}: ${item.desc}`);
  }

  // On partial streams, keep only model-emitted layer0 so we can open Capa 0 early.
  // On full maps, always ensure a usable fallback from coreIdea/tldr/steps.
  normalized.layer0 = allowPartial ? earlyLayer0 : ensureLayer0(normalized);

  return attachLumenCanvas(raw, normalized);
}

export function isValidMap(data: unknown): data is ActionMapData {
  return normalizeMapData(data) !== null;
}

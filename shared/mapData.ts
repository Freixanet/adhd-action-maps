import type {
  ActionMapData,
  CalloutLabel,
  CoverageNote,
  KnowledgeSection,
  MapDepth,
  MapStep,
  SourceReference,
  StepListItem,
} from './contracts';
import { FALLBACK_MAP_CATEGORY, normalizeTags, resolveMapCategory } from './categories';
import {
  capStepsForDepth,
  extractSelfCheck,
  normalizeReadingSections,
  SOURCE_TRUNCATION_NOTICE,
} from './nucleoPipeline';

const DEFAULT_CALLOUT_LABELS: Record<string, CalloutLabel> = {
  action: 'Para aplicarlo',
  info: 'Idea clave',
  alert: 'Precaución',
};

function normalizeReferences(input: unknown): SourceReference[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((ref) => {
      const value = ref as SourceReference;
      if (!value?.label || !value?.locator) return null;
      return {
        label: String(value.label),
        locator: String(value.locator),
        locatorKind: value.locatorKind,
        excerpt: value.excerpt ? String(value.excerpt) : undefined,
        note: value.note ? String(value.note) : undefined,
      } satisfies SourceReference;
    })
    .filter(Boolean) as SourceReference[];
}

export function normalizeMapData(
  input: unknown,
  options?: { depth?: MapDepth; sourceTruncated?: boolean }
): ActionMapData | null {
  const raw = input as ActionMapData;
  if (!raw?.title || !Array.isArray(raw?.steps) || !Array.isArray(raw?.tldr)) return null;

  const cappedSteps = capStepsForDepth(raw.steps, options?.depth);
  const normalizedSteps: MapStep[] = cappedSteps.map((step, index) => ({
    id: String(step?.id || `step-${index + 1}`),
    shortNav: String(step?.shortNav || step?.title || `Paso ${index + 1}`),
    title: String(step?.title || `Paso ${index + 1}`),
    time: String(step?.time || '~3 min'),
    purpose: step?.purpose ? String(step.purpose) : undefined,
    content: Array.isArray(step?.content)
      ? step.content
          .map((block) => {
            const kindRaw = block?.kind ? String(block.kind) : undefined;
            const kind: 'action' | 'info' | 'alert' | undefined =
              kindRaw === 'action' || kindRaw === 'info' || kindRaw === 'alert' ? kindRaw : undefined;
            const items: StepListItem[] | undefined = Array.isArray(block?.items)
              ? (block.items
                  .map((item) =>
                    item?.strong
                      ? {
                          strong: String(item.strong),
                          span: item?.span ? String(item.span) : undefined,
                        }
                      : null
                  )
                  .filter(Boolean) as StepListItem[])
              : undefined;

            return {
              type: String(block?.type || 'prose') as 'prose' | 'callout' | 'list',
              text: String(block?.text || '').trim(),
              kind,
              label: block?.label
                ? (String(block.label) as CalloutLabel)
                : DEFAULT_CALLOUT_LABELS[String(block?.kind || 'info')] || 'Idea clave',
              items,
              references: normalizeReferences(block?.references),
            };
          })
          .filter((block) => block.text || block.items?.length)
      : [],
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
    sourceMetadata: {
      kind: raw.sourceMetadata?.kind || 'text',
      label: raw.sourceMetadata?.label || 'Fuente analizada',
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
          ? { title: String(item.title), desc: String(item.desc) }
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

  if (!normalized.sourceMetadata!.detected.length) {
    normalized.sourceMetadata!.detected = [normalized.sourceMetadata!.label];
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

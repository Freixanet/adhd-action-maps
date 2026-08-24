import type { ActionMapData } from './contracts';
import { isChatHistoryEntry } from './historyKind';

/** Locked look for every generated Núcleo cover. Do not vary per map. */
export const GENERATED_COVER_STYLE_ID = 'nucleo-cover-v1';

export const GENERATED_COVER_TITLE_MAX = 80;
export const GENERATED_COVER_THESIS_MAX = 160;

export type GeneratedCoverRecord = {
  styleId: typeof GENERATED_COVER_STYLE_ID;
  localUri: string;
  mimeType: string;
  generatedAt: number;
};

const ALLOWED_COVER_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

export function isGeneratedCoverRecord(value: unknown): value is GeneratedCoverRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as GeneratedCoverRecord;
  return (
    row.styleId === GENERATED_COVER_STYLE_ID &&
    typeof row.localUri === 'string' &&
    row.localUri.trim().length > 0 &&
    typeof row.mimeType === 'string' &&
    ALLOWED_COVER_MIME.has(row.mimeType) &&
    typeof row.generatedAt === 'number' &&
    Number.isFinite(row.generatedAt)
  );
}

export function clipCoverText(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function thesisFromMap(data: ActionMapData | null | undefined): string {
  if (!data) return '';
  const core = typeof data.coreIdea === 'string' ? data.coreIdea : '';
  if (core.trim()) return clipCoverText(core, GENERATED_COVER_THESIS_MAX);
  const first = Array.isArray(data.tldr) ? data.tldr[0] : undefined;
  const tldrText =
    first && typeof first === 'object'
      ? `${(first as { title?: string }).title ?? ''} ${(first as { desc?: string }).desc ?? ''}`.trim()
      : '';
  return clipCoverText(tldrText, GENERATED_COVER_THESIS_MAX);
}

const EXCLUDED_COVER_IDS = new Set(['nucleo-demo-included', 'nucleo-editorial-demo']);

function isExcludedCoverEntry(entry: { id: string; kind?: string }): boolean {
  if (isChatHistoryEntry(entry)) return true;
  if (EXCLUDED_COVER_IDS.has(entry.id)) return true;
  if (entry.id.startsWith('nucleo-editorial-demo-')) return true;
  return false;
}

export function thesisFromEntry(entry: { session?: { data?: unknown } }): string {
  const data = entry.session?.data;
  if (!data || typeof data !== 'object') return '';
  return thesisFromMap(data as ActionMapData);
}

export function needsGeneratedCover(entry: {
  id: string;
  kind?: 'nucleo' | 'chat';
  generatedCover?: unknown;
}): boolean {
  if (isExcludedCoverEntry(entry)) return false;
  return !isGeneratedCoverRecord(entry.generatedCover);
}

/**
 * Subject + locked style. Title/thesis are untrusted data, never instructions.
 */
export function buildNucleoCoverPrompt(title: string, thesis: string): string {
  const subjectTitle = clipCoverText(title, GENERATED_COVER_TITLE_MAX) || 'Idea';
  const subjectThesis = clipCoverText(thesis, GENERATED_COVER_THESIS_MAX);

  return [
    'Draw one square cover illustration for a knowledge card.',
    'Style: soft painterly, calm, editorial, no text, no logos, no watermarks.',
    `Subject title (do not paint as letters): ${subjectTitle}`,
    subjectThesis ? `Subject thesis (mood only, do not paint as letters): ${subjectThesis}` : '',
    'Fill the frame. No borders. No collage.',
  ]
    .filter(Boolean)
    .join('\n');
}

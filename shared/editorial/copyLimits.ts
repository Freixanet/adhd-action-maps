/**
 * Editorial copy budgets — design lines at nucleo-editorial-v1 type sizes.
 * Soft character caps approximate wrap at EDITORIAL_MAX_READ_WIDTH (~440).
 * Planner / LLM must synthesize when over; UI scrolls, never shrinks type.
 */

import type { EditorialPage, EditorialPlan } from './types';

/** Target line counts (design). Soft char caps are derived for validation. */
export const EDITORIAL_COPY_LINE_LIMITS = {
  coverTitle: 3,
  pageTitle: 2,
  lede: 3,
  blockTitle: 2,
  /** Ideal band; soft max uses the high end. */
  descriptionMin: 2,
  descriptionMax: 3,
  callout: 3,
  /** Sequence strip label (title only). */
  sequenceLabelWords: 2,
} as const;

/**
 * Soft max character counts (approx. at max read width).
 * Over = synthesize; do not rely on UI to clamp or shrink type.
 */
export const EDITORIAL_COPY_SOFT_MAX_CHARS = {
  coverTitle: 72,
  pageTitle: 56,
  lede: 135,
  blockTitle: 48,
  description: 144,
  callout: 126,
  /** Sequence caption under the label (strip subtitle). */
  sequenceCaption: 40,
} as const;

export type EditorialCopyLimitIssue = {
  path: string;
  message: string;
  kind: 'chars' | 'words';
};

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function tooLong(text: string | undefined, maxChars: number): boolean {
  if (text == null || text === '') return false;
  return text.trim().length > maxChars;
}

function isCover(page: EditorialPage): boolean {
  return page.archetype === 'cover';
}

function usesSequenceLabels(page: EditorialPage): boolean {
  return page.archetype === 'experiment' || page.archetype === 'process';
}

/**
 * Soft copy-limit issues. Does not block structural validation by itself;
 * planner must synthesize. Callers may treat these as regenerate signals.
 */
export function collectEditorialCopyLimitIssues(
  plan: EditorialPlan
): EditorialCopyLimitIssue[] {
  const issues: EditorialCopyLimitIssue[] = [];
  const L = EDITORIAL_COPY_LINE_LIMITS;
  const C = EDITORIAL_COPY_SOFT_MAX_CHARS;

  if (tooLong(plan.nucleusClaim, C.callout)) {
    issues.push({
      path: 'nucleusClaim',
      kind: 'chars',
      message: `nucleusClaim over soft max ${C.callout} chars (callout ≤ ${L.callout} lines) — synthesize`,
    });
  }

  for (const page of plan.pages ?? []) {
    const path = `pages[${page.index}]`;
    const titleMax = isCover(page) ? C.coverTitle : C.pageTitle;
    const titleLineBudget = isCover(page) ? L.coverTitle : L.pageTitle;

    if (tooLong(page.title, titleMax)) {
      issues.push({
        path: `${path}.title`,
        kind: 'chars',
        message: `title over soft max ${titleMax} chars (≤ ${titleLineBudget} lines) — synthesize`,
      });
    }

    if (tooLong(page.body, C.lede)) {
      issues.push({
        path: `${path}.body`,
        kind: 'chars',
        message: `body/lede over soft max ${C.lede} chars (≤ ${L.lede} lines) — synthesize`,
      });
    }

    if (page.callout && tooLong(page.callout.body, C.callout)) {
      issues.push({
        path: `${path}.callout.body`,
        kind: 'chars',
        message: `callout over soft max ${C.callout} chars (≤ ${L.callout} lines) — synthesize`,
      });
    }

    for (const [i, item] of (page.items ?? []).entries()) {
      const itemPath = `${path}.items[${i}]`;
      if (usesSequenceLabels(page)) {
        const words = wordCount(item.title);
        if (words > L.sequenceLabelWords) {
          issues.push({
            path: `${itemPath}.title`,
            kind: 'words',
            message: `sequence label has ${words} words (max ${L.sequenceLabelWords}) — synthesize`,
          });
        }
        if (tooLong(item.body, C.sequenceCaption)) {
          issues.push({
            path: `${itemPath}.body`,
            kind: 'chars',
            message: `sequence caption over soft max ${C.sequenceCaption} chars — synthesize`,
          });
        }
      } else {
        if (tooLong(item.title, C.blockTitle)) {
          issues.push({
            path: `${itemPath}.title`,
            kind: 'chars',
            message: `block title over soft max ${C.blockTitle} chars (≤ ${L.blockTitle} lines) — synthesize`,
          });
        }
        if (tooLong(item.body, C.description)) {
          issues.push({
            path: `${itemPath}.body`,
            kind: 'chars',
            message: `description over soft max ${C.description} chars (ideal ${L.descriptionMin}–${L.descriptionMax} lines) — synthesize`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Compact rules for editorial planner / LLM prompts (Spanish product).
 * Keep alongside NO_AI_SLOP_WRITING_CONTRACT.
 */
export const EDITORIAL_COPY_LIMITS_CONTRACT = `LÍMITES DE COPIA EDITORIAL (obligatorio — no romper el layout):
- Título de portada (archetype cover): máximo ${EDITORIAL_COPY_LINE_LIMITS.coverTitle} líneas (~${EDITORIAL_COPY_SOFT_MAX_CHARS.coverTitle} caracteres).
- Títulos restantes: máximo ${EDITORIAL_COPY_LINE_LIMITS.pageTitle} líneas (~${EDITORIAL_COPY_SOFT_MAX_CHARS.pageTitle} caracteres).
- Entradilla (page.body): máximo ${EDITORIAL_COPY_LINE_LIMITS.lede} líneas (~${EDITORIAL_COPY_SOFT_MAX_CHARS.lede} caracteres).
- Título de bloque (items[].title en listas/comparación): máximo ${EDITORIAL_COPY_LINE_LIMITS.blockTitle} líneas (~${EDITORIAL_COPY_SOFT_MAX_CHARS.blockTitle} caracteres).
- Descripción (items[].body): ideal ${EDITORIAL_COPY_LINE_LIMITS.descriptionMin}–${EDITORIAL_COPY_LINE_LIMITS.descriptionMax} líneas (tope blando ~${EDITORIAL_COPY_SOFT_MAX_CHARS.description} caracteres).
- Callout (callout.body / nucleusClaim): máximo ${EDITORIAL_COPY_LINE_LIMITS.callout} líneas (~${EDITORIAL_COPY_SOFT_MAX_CHARS.callout} caracteres).
- Etiquetas de secuencia (items[].title en experiment/process): máximo ${EDITORIAL_COPY_LINE_LIMITS.sequenceLabelWords} palabras; pie corto (~${EDITORIAL_COPY_SOFT_MAX_CHARS.sequenceCaption} caracteres).
- Si el contenido supera un límite, sintetiza: acorta conservando el hecho útil. No rellenes.
- La app hace scroll si algo se pasa; nunca reduzcas tipografía ni inventes estilos.`;

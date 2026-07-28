import type { ActionMapData, SourceContentKind } from './contracts';

function semanticText(input: unknown): string {
  const map = (input ?? {}) as Partial<ActionMapData>;
  const metadata = map.sourceMetadata;
  const compact = {
    title: map.title,
    coreSupport: map.coreSupport,
    category: map.category,
    tags: map.tags,
    sourceTitle: metadata?.title,
    author: metadata?.author,
    detected: metadata?.detected,
    limitations: metadata?.limitations,
    sections: map.knowledgeSections?.map((section) => ({
      title: section.title,
      summary: section.summary,
    })),
    // Legacy maps may only reveal their identity inside a stat source,
    // accordion title, reference note, or chapter locator.
    steps: map.steps?.map((step) => ({
      title: step.title,
      purpose: step.purpose,
      content: step.content,
      references: step.references,
    })),
    references: map.references,
  };
  return JSON.stringify(compact).toLowerCase().slice(0, 60_000);
}

/**
 * Migration fallback for maps saved before SourceMetadata.contentKind existed.
 * Uses semantic evidence in the generated map; file extension and collection
 * membership are deliberately absent.
 */
export function inferLegacySourceContentKind(input: unknown): SourceContentKind | undefined {
  const map = (input ?? {}) as Partial<ActionMapData>;
  const text = semanticText(input);
  if (!text) return undefined;

  if (
    /\b(doi|abstract|peer[- ]review|journal|resultados del estudio|research paper)\b/i.test(
      text
    )
  ) {
    return 'paper';
  }
  if (
    /\b(informe ejecutivo|executive summary|annual report|informe anual|memoria anual|reporte de resultados)\b/i.test(
      text
    )
  ) {
    return 'report';
  }
  if (
    /\b(manual de|manual del|user manual|instruction manual|gu[ií]a de usuario|procedimiento operativo)\b/i.test(
      text
    )
  ) {
    return 'manual';
  }
  if (/\b(diapositiva|diapositivas|slide deck|presentaci[oó]n)\b/i.test(text)) {
    return 'slides';
  }
  if (/\b(apuntes|notas de clase|lecture notes)\b/i.test(text)) {
    return 'notes';
  }
  if (/\b(transcripci[oó]n|transcript|speaker \d|entrevistador:)\b/i.test(text)) {
    return 'transcript';
  }
  if (
    /\b(isbn|novela|novel|libro|book|cap[ií]tulo|chapter)\b/i.test(text)
  ) {
    return 'book';
  }
  if (
    /\b(art[ií]culo|article|publicado en|newsletter|columna de opini[oó]n)\b/i.test(text)
  ) {
    return 'article';
  }
  // Old book maps often retained only the credited author after normalization.
  // Apply this only after explicit paper/report/manual/article signals above.
  if (map.sourceMetadata?.author?.trim() && map.title?.trim()) {
    return 'book';
  }
  return undefined;
}

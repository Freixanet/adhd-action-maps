import type { StepContentBlock, StepListItem } from '../contracts';
import type { UnderstandingUnit } from '../understanding/types';
import { stableRelationId } from '../understanding/relationIds';
import type { NucleoFormatId } from './types';

const RELATION_LABELS: Record<string, string> = {
  causes: 'causa / contribuye a',
  contributes: 'contribuye a',
  limited_by: 'queda limitado por',
  limits: 'limita',
  contradicts: 'contradice',
  answers: 'responde a',
  faces: 'enfrenta',
  precedes: 'precede a',
  enables: 'habilita',
  implies: 'implica',
  supports: 'apoya',
};

export type CompiledRelationRow = {
  label: string;
  values: [string, string];
  relationId: string;
};

export type ComposeStepInput = {
  unit: UnderstandingUnit;
  allUnits: UnderstandingUnit[];
  format: NucleoFormatId;
  includeRelations: boolean;
  isFirst: boolean;
  isLast: boolean;
  nuclearIdea: string;
};

function relationLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return RELATION_LABELS[key] ?? kind.trim();
}

export function collectRelationRows(
  unit: UnderstandingUnit,
  allUnits: UnderstandingUnit[]
): CompiledRelationRow[] {
  const byId = new Map(allUnits.map((item) => [item.id, item]));
  const rows: CompiledRelationRow[] = [];
  let emitOrdinal = 0;
  for (const rel of unit.relations) {
    const target = byId.get(rel.toUnitId);
    if (!target) continue;
    const relationId =
      rel.id && rel.id.trim().length > 0
        ? rel.id.trim()
        : stableRelationId(unit.id, rel.toUnitId, rel.kind, emitOrdinal);
    emitOrdinal += 1;
    rows.push({
      label: relationLabel(rel.kind),
      values: [unit.title, target.title],
      relationId,
    });
  }
  return rows;
}

/** First 1–2 sentences on the page; the rest goes to accordion. */
export function splitLeadProse(text: string): { lead: string; rest: string } {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return { lead: '', rest: '' };
  if (cleaned.length <= 240) return { lead: cleaned, rest: '' };

  const sentences = cleaned.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length <= 1) {
    const cutAt = cleaned.lastIndexOf(' ', 280);
    const at = cutAt >= 140 ? cutAt : 280;
    return { lead: cleaned.slice(0, at).trim(), rest: cleaned.slice(at).trim() };
  }

  let lead = sentences[0]!;
  let used = 1;
  if (sentences[1] && lead.length + 1 + sentences[1].length <= 280) {
    lead = `${lead} ${sentences[1]}`;
    used = 2;
  }
  return { lead, rest: sentences.slice(used).join(' ').trim() };
}

function firstSentence(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  const match = cleaned.match(/^.+?[.!?…](?=\s|$)/);
  return (match ? match[0] : cleaned).trim();
}

function comparisonColumns(format: NucleoFormatId): [string, string] {
  if (format === 'contrast') return ['Un lado', 'El otro'];
  if (format === 'causal') return ['Esta pieza', 'Otra pieza'];
  if (format === 'argument') return ['Afirma', 'Enfrenta'];
  return ['Desde', 'Hacia'];
}

function extrasTitle(format: NucleoFormatId): string {
  if (format === 'process') return 'Límites del procedimiento';
  if (format === 'causal') return 'Matices';
  if (format === 'argument') return 'Objeciones y bordes';
  if (format === 'sequence') return 'Más del recorrido';
  if (format === 'contrast') return 'Donde no coinciden';
  return 'Más detalle';
}

function listLeadText(format: NucleoFormatId): string {
  if (format === 'process') return 'Lo que describe la fuente, en orden.';
  if (format === 'sequence') return 'El hilo, en orden.';
  if (format === 'contrast') return 'Las piezas a tener en cuenta.';
  return 'En concreto.';
}

function toListItems(lines: string[]): StepListItem[] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const split = line.split(/[:—–]\s+/);
      if (split.length >= 2 && split[0]!.length <= 42) {
        return { strong: split[0]!.trim(), span: split.slice(1).join(': ').trim() };
      }
      const words = line.split(/\s+/);
      if (words.length > 6) {
        return { strong: words.slice(0, 4).join(' '), span: words.slice(4).join(' ') };
      }
      return { strong: line };
    });
}

function pushAccordion(content: StepContentBlock[], title: string, parts: string[]): void {
  const body = parts.map((part) => part.trim()).filter(Boolean).join('\n\n');
  if (!body) return;
  content.push({ type: 'accordion', title, body });
}

function pushComparison(content: StepContentBlock[], format: NucleoFormatId, rows: CompiledRelationRow[]): void {
  if (!rows.length) return;
  content.push({
    type: 'comparison',
    columns: comparisonColumns(format),
    rows: rows.map((row) => ({
      label: row.label,
      values: [...row.values],
      relationId: row.relationId,
    })),
    emphasis: format === 'contrast' || format === 'causal' ? 'hero' : 'normal',
  });
}

function pushConnectionCallouts(content: StepContentBlock[], rows: CompiledRelationRow[]): void {
  for (const row of rows) {
    content.push({
      type: 'callout',
      text: `«${row.values[0]}» ${row.label} «${row.values[1]}».`,
      kind: 'info',
      label: 'Conexión',
      relationId: row.relationId,
    });
  }
}

function pushQuiz(content: StepContentBlock[], unit: UnderstandingUnit, allUnits: UnderstandingUnit[]): void {
  const others = allUnits.filter((item) => item.id !== unit.id).map((item) => item.title.trim());
  if (others.length < 1) return;
  const correct = unit.title.trim();
  const distractors = others.slice(0, 2);
  const options = [correct, ...distractors];
  content.push({
    type: 'quiz',
    question: `Si tuvieras que nombrar esta pieza, ¿cuál encaja?`,
    options,
    correct: 0,
    feedback: firstSentence(unit.explanation) || correct,
  });
}

/**
 * Compose one reading page. Visual useful bit first. Density in accordion.
 * Relations: comparison XOR Conexión callouts — never both.
 */
export function composeStepContent(input: ComposeStepInput): StepContentBlock[] {
  const { unit, format, includeRelations, isFirst, isLast, nuclearIdea } = input;
  const content: StepContentBlock[] = [];
  const { lead, rest } = splitLeadProse(unit.explanation);
  const rows = includeRelations ? collectRelationRows(unit, input.allUnits) : [];
  const extras: string[] = [];
  if (rest) extras.push(rest);
  if (unit.incomplete && unit.incompleteReason) extras.push(unit.incompleteReason);

  const examples = unit.examples.map((item) => item.trim()).filter(Boolean);
  const cautions = unit.cautions.map((item) => item.trim()).filter(Boolean);

  const showComparison =
    rows.length > 0 &&
    (format === 'contrast' ||
      format === 'causal' ||
      format === 'argument' ||
      (format === 'concept' && rows.length >= 2));

  if (format === 'contrast' && showComparison) {
    pushComparison(content, format, rows);
  }

  if (isFirst && nuclearIdea.trim() && (format === 'concept' || format === 'reading')) {
    const idea = nuclearIdea.trim();
    if (!lead.toLowerCase().includes(idea.toLowerCase().slice(0, 24))) {
      content.push({
        type: 'callout',
        text: idea,
        kind: 'info',
        label: 'Idea clave',
      });
    }
  }

  if (format === 'argument' && cautions[0]) {
    content.push({
      type: 'callout',
      text: cautions[0],
      kind: 'alert',
      label: 'Precaución',
    });
  }

  if ((format === 'sequence' || format === 'process') && examples.length) {
    content.push({
      type: 'list',
      text: listLeadText(format),
      kind: 'info',
      items: toListItems(examples),
    });
  } else if (format === 'concept' && examples[0]) {
    content.push({
      type: 'callout',
      text: examples[0],
      kind: 'info',
      label: 'Ejemplo',
    });
  }

  if (lead) {
    content.push({
      type: 'prose',
      text: lead,
      kind: 'info',
    });
  }

  if (format !== 'contrast' && showComparison) {
    pushComparison(content, format, rows);
  } else if (rows.length && !showComparison) {
    pushConnectionCallouts(content, rows);
  }

  if (format !== 'sequence' && format !== 'process') {
    for (const example of examples.slice(format === 'concept' ? 1 : 0)) {
      extras.push(example);
    }
  }
  const cautionStart = format === 'argument' ? 1 : 0;
  for (const caution of cautions.slice(cautionStart)) {
    extras.push(caution);
  }

  pushAccordion(content, extrasTitle(format), extras);

  if (isLast) {
    pushQuiz(content, unit, input.allUnits);
  }

  if (!content.length && unit.explanation.trim()) {
    content.push({ type: 'prose', text: unit.explanation.trim(), kind: 'info' });
  }

  return content;
}

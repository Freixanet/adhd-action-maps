import type { SourceMetadata, SourceReference } from './contracts';

export const STUDY_DOC_SCHEMA_VERSION = 1;

export const STUDY_DOC_LIMITS = {
  tldr: { min: 3, target: 3, max: 4 },
  concepts: { min: 5, max: 9 },
  pretest: { min: 2, max: 3 },
  sectionCheckQuestions: { min: 2, max: 5 },
  flashcardsPerConcept: { min: 1, max: 3 },
  spacedReviewDays: [1, 3, 7] as const,
} as const;

export type StudyDocId = string;

export type StudyDocIntent = 'understand' | 'study' | 'apply';

export type StudyDocDepth = 'rapido' | 'estandar' | 'profundo';

export type StudyDocDifficulty = 'intro' | 'intermediate' | 'advanced';

export type StudyDocSectionKind =
  | 'concept'
  | 'argument'
  | 'process'
  | 'case'
  | 'practice'
  | 'review';

export type StudyEdgeRelation =
  | 'causes'
  | 'depends_on'
  | 'contrasts_with'
  | 'enables'
  | 'explains'
  | 'is_example_of'
  | 'part_of'
  | 'supports'
  | 'warns_about';

export type StudyQuestionKind =
  | 'recall'
  | 'why'
  | 'compare'
  | 'apply'
  | 'diagnose'
  | 'predict';

export type StudyRevealMode = 'tap' | 'after_answer';

export type StudyDocCoverage = {
  summary: string;
  included: string[];
  condensed: string[];
  omitted: string[];
};

export type StudyDocTldrItem = {
  id: StudyDocId;
  title: string;
  detail: string;
  conceptIds?: StudyDocId[];
  references?: SourceReference[];
};

export type StudyConcept = {
  id: StudyDocId;
  name: string;
  definition: string;
  analogyPrompt: string;
  whyItMatters?: string;
  commonConfusion?: string;
  references?: SourceReference[];
};

export type StudyEdge = {
  from: StudyDocId;
  to: StudyDocId;
  relation: StudyEdgeRelation;
  label: string;
  explanation?: string;
};

export type StudyPretestQuestion = {
  id: StudyDocId;
  kind: StudyQuestionKind;
  prompt: string;
  reveal: string;
  conceptIds?: StudyDocId[];
  revealMode?: StudyRevealMode;
};

export type StudyCheckQuestion = {
  id: StudyDocId;
  kind: StudyQuestionKind;
  prompt: string;
  expectedAnswer: string;
  conceptIds?: StudyDocId[];
};

export type StudySection = {
  id: StudyDocId;
  title: string;
  kind: StudyDocSectionKind;
  conceptIds: StudyDocId[];
  pretest: StudyPretestQuestion[];
  /**
   * Markdown de contenido, no HTML. La UI decide cómo renderizarlo en componentes nativos.
   */
  bodyMarkdown: string;
  checkQuestions: StudyCheckQuestion[];
  selfExplainPrompt: string;
  estimatedMinutes?: number;
  references?: SourceReference[];
};

export type StudyFlashcard = {
  id: StudyDocId;
  conceptId: StudyDocId;
  front: string;
  back: string;
  hint?: string;
  references?: SourceReference[];
};

export type StudyDistill = {
  schemaVersion: typeof STUDY_DOC_SCHEMA_VERSION;
  title: string;
  thesis: string;
  sourceMetadata?: SourceMetadata;
  coverage: StudyDocCoverage;
  concepts: StudyConcept[];
  edges: StudyEdge[];
};

export type StudyDoc = StudyDistill & {
  intent: StudyDocIntent;
  depth: StudyDocDepth;
  difficulty: StudyDocDifficulty;
  tldr: StudyDocTldrItem[];
  sections: StudySection[];
  flashcards: StudyFlashcard[];
};

export type StudyProgressState = {
  docId: StudyDocId;
  completedSectionIds: StudyDocId[];
  pretestAnswers: Record<StudyDocId, string>;
  revealedPretestIds: StudyDocId[];
  checkAnswers: Record<StudyDocId, string>;
  selfExplanations: Record<StudyDocId, string>;
  flashcards: Record<
    StudyDocId,
    {
      lastReviewedAt?: number;
      nextReviewAt?: number;
      reviewCount: number;
      ease: 'again' | 'hard' | 'good' | 'easy';
    }
  >;
};

export type StudyDocValidationIssue = {
  path: string;
  message: string;
};

export type StudyDocValidationResult =
  | { ok: true; issues: [] }
  | { ok: false; issues: StudyDocValidationIssue[] };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushIssue(
  issues: StudyDocValidationIssue[],
  path: string,
  message: string
) {
  issues.push({ path, message });
}

function validateText(
  issues: StudyDocValidationIssue[],
  value: unknown,
  path: string
) {
  if (!hasText(value)) {
    pushIssue(issues, path, 'Debe ser un string no vacío.');
  }
}

function validateArrayLength(
  issues: StudyDocValidationIssue[],
  value: unknown,
  path: string,
  min: number,
  max: number
) {
  if (!Array.isArray(value)) {
    pushIssue(issues, path, 'Debe ser un array.');
    return;
  }
  if (value.length < min || value.length > max) {
    pushIssue(issues, path, `Debe tener entre ${min} y ${max} elementos.`);
  }
}

export function validateStudyDoc(input: unknown): StudyDocValidationResult {
  const issues: StudyDocValidationIssue[] = [];

  if (!isObject(input)) {
    return {
      ok: false,
      issues: [{ path: '$', message: 'StudyDoc debe ser un objeto.' }],
    };
  }

  validateText(issues, input.title, 'title');
  validateText(issues, input.thesis, 'thesis');
  validateText(issues, input.intent, 'intent');
  validateText(issues, input.depth, 'depth');
  validateText(issues, input.difficulty, 'difficulty');

  validateArrayLength(
    issues,
    input.tldr,
    'tldr',
    STUDY_DOC_LIMITS.tldr.min,
    STUDY_DOC_LIMITS.tldr.max
  );
  validateArrayLength(
    issues,
    input.concepts,
    'concepts',
    STUDY_DOC_LIMITS.concepts.min,
    STUDY_DOC_LIMITS.concepts.max
  );
  validateArrayLength(issues, input.sections, 'sections', 1, 12);
  validateArrayLength(issues, input.flashcards, 'flashcards', 1, 27);

  const conceptIds = new Set<string>();
  if (Array.isArray(input.concepts)) {
    input.concepts.forEach((concept, index) => {
      if (!isObject(concept)) {
        pushIssue(issues, `concepts.${index}`, 'Debe ser un objeto.');
        return;
      }
      validateText(issues, concept.id, `concepts.${index}.id`);
      validateText(issues, concept.name, `concepts.${index}.name`);
      validateText(issues, concept.definition, `concepts.${index}.definition`);
      validateText(issues, concept.analogyPrompt, `concepts.${index}.analogyPrompt`);
      if (hasText(concept.id)) conceptIds.add(concept.id);
    });
  }

  if (Array.isArray(input.sections)) {
    input.sections.forEach((section, index) => {
      if (!isObject(section)) {
        pushIssue(issues, `sections.${index}`, 'Debe ser un objeto.');
        return;
      }
      validateText(issues, section.id, `sections.${index}.id`);
      validateText(issues, section.title, `sections.${index}.title`);
      validateText(issues, section.bodyMarkdown, `sections.${index}.bodyMarkdown`);
      validateText(
        issues,
        section.selfExplainPrompt,
        `sections.${index}.selfExplainPrompt`
      );
      validateArrayLength(
        issues,
        section.pretest,
        `sections.${index}.pretest`,
        STUDY_DOC_LIMITS.pretest.min,
        STUDY_DOC_LIMITS.pretest.max
      );
      validateArrayLength(
        issues,
        section.checkQuestions,
        `sections.${index}.checkQuestions`,
        STUDY_DOC_LIMITS.sectionCheckQuestions.min,
        STUDY_DOC_LIMITS.sectionCheckQuestions.max
      );
      if (Array.isArray(section.conceptIds)) {
        section.conceptIds.forEach((conceptId, conceptIndex) => {
          if (!hasText(conceptId) || !conceptIds.has(conceptId)) {
            pushIssue(
              issues,
              `sections.${index}.conceptIds.${conceptIndex}`,
              'Debe referenciar un concept.id existente.'
            );
          }
        });
      }
    });
  }

  if (Array.isArray(input.edges)) {
    input.edges.forEach((edge, index) => {
      if (!isObject(edge)) {
        pushIssue(issues, `edges.${index}`, 'Debe ser un objeto.');
        return;
      }
      if (!hasText(edge.from) || !conceptIds.has(edge.from)) {
        pushIssue(issues, `edges.${index}.from`, 'Debe referenciar un concept.id existente.');
      }
      if (!hasText(edge.to) || !conceptIds.has(edge.to)) {
        pushIssue(issues, `edges.${index}.to`, 'Debe referenciar un concept.id existente.');
      }
      validateText(issues, edge.relation, `edges.${index}.relation`);
      validateText(issues, edge.label, `edges.${index}.label`);
    });
  }

  if (Array.isArray(input.flashcards)) {
    input.flashcards.forEach((card, index) => {
      if (!isObject(card)) {
        pushIssue(issues, `flashcards.${index}`, 'Debe ser un objeto.');
        return;
      }
      validateText(issues, card.id, `flashcards.${index}.id`);
      validateText(issues, card.front, `flashcards.${index}.front`);
      validateText(issues, card.back, `flashcards.${index}.back`);
      if (!hasText(card.conceptId) || !conceptIds.has(card.conceptId)) {
        pushIssue(
          issues,
          `flashcards.${index}.conceptId`,
          'Debe referenciar un concept.id existente.'
        );
      }
    });
  }

  return issues.length ? { ok: false, issues } : { ok: true, issues: [] };
}

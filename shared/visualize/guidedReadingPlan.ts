import { conceptById, type KnowledgeModel } from './knowledgeModel';
import type { VisualizationPlan } from './visualizationPlan';

/**
 * Deterministic VisualizationPlan for guided-reading — same pipeline as LLM plans.
 */
export function buildGuidedReadingPlan(model: KnowledgeModel): VisualizationPlan {
  const concepts = model.concepts.slice(0, 3);
  const byId = conceptById(model);
  const nucleusLabel = model.thesis.slice(0, 90) || concepts[0]?.label || 'Idea central';

  const elements: VisualizationPlan['elements'] = [
    {
      id: 'nucleus',
      label: nucleusLabel,
      description: model.uncertainties[0]?.slice(0, 140),
      role: 'primary',
      evidence: model.thesisEvidence,
    },
  ];

  concepts.forEach((c, i) => {
    elements.push({
      id: `idea-${i + 1}`,
      label: c.label.slice(0, 55),
      description: (c.summary || '').slice(0, 140) || undefined,
      role: i === 0 ? 'primary' : 'secondary',
      conceptId: c.id,
      evidence: c.evidence,
    });
  });

  const exampleConcept =
    model.concepts[3] || model.concepts.find((c) => c.id !== concepts[0]?.id);
  if (exampleConcept && byId.has(exampleConcept.id) && !concepts.some((c) => c.id === exampleConcept.id)) {
    elements.push({
      id: 'example',
      label: `Ejemplo: ${exampleConcept.label}`.slice(0, 55),
      description: (exampleConcept.summary || '').slice(0, 140) || undefined,
      role: 'secondary',
      conceptId: exampleConcept.id,
      evidence: exampleConcept.evidence,
    });
  }

  elements.push({
    id: 'check',
    label: 'Comprueba',
    description: '¿Puedes explicar la idea central con tus palabras?',
    role: 'secondary',
  });

  return {
    strategy: 'guided-reading',
    title: nucleusLabel.slice(0, 90),
    expectedInsight: 'Captar la tesis y 2–3 ideas ancladas en la fuente',
    elements,
    relationships: [],
    interactions: [],
    readingOrder: elements.map((e) => e.id),
    assumptions: [
      'El contenido no admite una estructura visual más fuerte o falló verificación',
    ],
    excludedDetails: model.concepts.slice(4).map((c) => c.label),
  };
}

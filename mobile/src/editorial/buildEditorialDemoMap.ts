import type { ActionMapData, MapStep } from '@shared/contracts';
import type { EditorialPlan } from '@shared/editorial';
import { buildEditorialFixture } from '@shared/editorial';

export const EDITORIAL_DEMO_NUCLEO_ID = 'nucleo-editorial-demo';

/**
 * Builds an ActionMapData shell that carries an EditorialPlan for ResultScreen.
 * Classic steps remain available as a thin fallback; editorial UI is primary.
 */
export function buildEditorialDemoMap(
  fixtureId:
    | 'procrastination'
    | 'attention'
    | 'conceptual'
    | 'practical'
    | 'comparison'
    | 'no-application'
    | 'evidence' = 'procrastination'
): ActionMapData {
  const plan = buildEditorialFixture(fixtureId);
  return editorialPlanToMapData(plan);
}

export function editorialPlanToMapData(plan: EditorialPlan): ActionMapData {
  const steps: MapStep[] = plan.pages.slice(1).map((page, i) => ({
    id: page.id,
    shortNav: page.title.slice(0, 24),
    title: page.title,
    time: '~2 min',
    purpose: page.body ?? page.title,
    content: [
      {
        type: 'prose' as const,
        text: page.body ?? page.items?.map((it) => `${it.title}: ${it.body}`).join('\n') ?? page.title,
      },
    ],
  }));

  return {
    title: plan.title,
    category: 'Aprendizaje',
    intent: plan.derivedMapIntent,
    generationMode: 'editorial-v1',
    coreIdea: plan.nucleusClaim,
    coreSupport: plan.pages[0]?.body ?? plan.nucleusClaim,
    tldr: plan.pages.slice(0, 3).map((p) => ({
      title: p.title.slice(0, 40),
      desc: (p.body ?? plan.nucleusClaim).slice(0, 120),
    })),
    steps:
      steps.length > 0
        ? steps
        : [
            {
              id: 'editorial-fallback',
              shortNav: plan.title.slice(0, 24),
              title: plan.title,
              time: '~2 min',
              content: [{ type: 'prose' as const, text: plan.nucleusClaim }],
            },
          ],
    editorialPlan: plan,
    sourceMetadata: {
      kind: 'text',
      label: plan.sourceLabel ?? 'Referencia editorial',
      detected: [plan.sourceLabel ?? 'Referencia editorial'],
      url: plan.sourceUrl,
    },
    modelUsed: plan.providerVersions.planner,
  };
}

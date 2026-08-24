import type { ActionMapData } from '../contracts';
import { KIND_LABEL, type Canvas } from './types';
import { parseLumenCanvas } from './parse';

function wordTrim(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
}

function canvasSupport(canvas: Canvas): string {
  if (canvas.kind === 'explain') return canvas.essence;
  if (canvas.kind === 'compare') return canvas.verdict;
  if (canvas.kind === 'recipe') return canvas.science || canvas.yieldNote;
  if (canvas.kind === 'plan') return `${canvas.occasion} · ${canvas.timeframe}`.trim();
  if (canvas.kind === 'collection') return canvas.query;
  return canvas.outcome;
}

export function lumenCanvasToMap(
  canvas: Canvas,
  opts?: { modelUsed?: string }
): ActionMapData {
  const prompts = canvas.prompts.filter(Boolean);
  const actions = [
    prompts[0] ?? 'Lee la esencia',
    prompts[1] ?? 'Pregunta lo que no cierra',
    prompts[2] ?? `Abre ${KIND_LABEL[canvas.kind].toLowerCase()}`,
  ].map((label, index) => ({
    id: `lumen-a${index + 1}`,
    label: wordTrim(label.replace(/^\?/, 'Revisa'), 12),
  }));

  return {
    title: canvas.title,
    intent: 'understand',
    outputLanguage: 'es',
    mapVersion: 2,
    generationMode: 'lumen-v1',
    lumenCanvas: canvas,
    sourceMetadata: {
      kind: canvas.source.kind === 'url' ? 'link' : 'text',
      label: canvas.source.title || canvas.title,
      title: canvas.source.title,
      detected: [],
      limitations: [],
    },
    coverage: {
      summary: 'Interfaz generada a partir del material disponible.',
      notes: [],
    },
    coreIdea: canvas.hook,
    coreSupport: canvasSupport(canvas),
    deliveryMessage: `Armé ${KIND_LABEL[canvas.kind].toLowerCase()}: ${canvas.title}.`,
    layer0: {
      what: wordTrim(canvas.title, 12),
      why: canvas.hook.startsWith('El ') || canvas.hook.startsWith('La ')
        ? `Muestra ${canvas.hook.charAt(0).toLowerCase()}${canvas.hook.slice(1)}`
        : canvas.hook,
      actions,
    },
    tldr: [
      { title: canvas.title, desc: canvas.hook },
      ...(canvas.kind === 'explain'
        ? canvas.insights.slice(0, 2).map((insight) => ({
            title: insight.title,
            desc: insight.body,
          }))
        : []),
    ].slice(0, 3),
    steps: [
      {
        id: 'lumen',
        shortNav: KIND_LABEL[canvas.kind],
        title: canvas.title,
        time: `~${canvas.readMinutes} min`,
        content: [{ type: 'prose', text: canvas.hook }],
      },
    ],
    completionCard: {
      title: canvas.title,
      summary: canvas.hook,
      takeaways: prompts.slice(0, 3),
    },
    modelUsed: opts?.modelUsed,
  };
}

export function attachLumenCanvas(raw: unknown, map: ActionMapData): ActionMapData {
  const canvas = parseLumenCanvas((raw as { lumenCanvas?: unknown })?.lumenCanvas);
  if (!canvas) return map;
  return {
    ...map,
    generationMode: 'lumen-v1',
    lumenCanvas: canvas,
  };
}

import type { ActionMapData } from '../contracts';
import type { HistoryEntry, HistoryStore } from '../history';
import type { Canvas, CanvasKind } from './types';
import { lumenCanvasToMap } from './toMap';
import { LUMEN_SAMPLE_CANVAS, LUMEN_SAMPLE_NUCLEO_ID } from './samples';
import {
  LUMEN_CUMPLE_CANVAS,
  LUMEN_EV_CANVAS,
  LUMEN_GALLETAS_CANVAS,
} from './homeSampleCanvases';

const SAMPLE_MODEL = 'lumen-sample.v2';

export const LUMEN_HOME_CHIPS: readonly {
  id: string;
  title: string;
  kind: CanvasKind;
  canvas: Canvas;
}[] = [
  {
    id: LUMEN_SAMPLE_NUCLEO_ID,
    title: 'Relatividad especial',
    kind: 'explain',
    canvas: LUMEN_SAMPLE_CANVAS,
  },
  {
    id: 'nucleo-lumen-galletas',
    title: 'Galletas extra chewy',
    kind: 'recipe',
    canvas: LUMEN_GALLETAS_CANVAS,
  },
  {
    id: 'nucleo-lumen-ev',
    title: 'Model 3 vs Ioniq 6',
    kind: 'compare',
    canvas: LUMEN_EV_CANVAS,
  },
  {
    id: 'nucleo-lumen-cumple',
    title: 'Cumple de 8 años',
    kind: 'plan',
    canvas: LUMEN_CUMPLE_CANVAS,
  },
];

export function findLumenHomeChip(id: string) {
  return LUMEN_HOME_CHIPS.find((chip) => chip.id === id) ?? null;
}

export function mapLumenHomeChip(id: string): ActionMapData | null {
  const chip = findLumenHomeChip(id);
  if (!chip?.canvas?.kind || !chip.canvas.title) return null;
  try {
    const map = lumenCanvasToMap(chip.canvas, { modelUsed: SAMPLE_MODEL });
    return map?.title && map.lumenCanvas ? map : null;
  } catch {
    return null;
  }
}

/** Insert one home chip into history. No shared helpers besides toMap — those Fast Refresh as undefined. */
export function insertLumenHomeChip(store: HistoryStore, id: string): HistoryStore {
  if (!store?.entries) return store;
  if (store.entries.some((entry) => entry.id === id)) return store;
  const chip = findLumenHomeChip(id);
  const map = mapLumenHomeChip(id);
  if (!chip || !map) return store;
  const now = Date.now();
  const created: HistoryEntry = {
    id: chip.id,
    title: chip.title,
    createdAt: now,
    updatedAt: now,
    sourceType: 'text',
    pinned: true,
    pinnedAt: now,
    intent: 'understand',
    status: 'unread',
    session: {
      data: map,
      currentStep: 0,
      isComplete: false,
      viewAll: false,
    },
  };
  return {
    ...store,
    entries: [created, ...store.entries],
  };
}

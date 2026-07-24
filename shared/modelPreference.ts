import { getStorage } from './storage';

export const MODEL_OPTIONS = [
  { id: 'auto', label: 'Automático', hint: 'Mejor disponible' },
  { id: 'gemini-3.6-flash', label: 'Flash 3.6', hint: 'Equilibrado' },
  { id: 'gemini-3.5-flash', label: 'Flash 3.5', hint: 'Máxima calidad' },
  { id: 'gemini-3.5-flash-lite', label: 'Flash Lite', hint: 'Rápido / pruebas' },
] as const;

export type ModelPreference = (typeof MODEL_OPTIONS)[number]['id'];

const STORAGE_KEY = 'tdah-model-preference';

/** Map retired Gemini IDs saved on device to the current catalog. */
const LEGACY_MODEL_IDS: Record<string, ModelPreference> = {
  'gemini-3-flash-preview': 'gemini-3.6-flash',
  'gemini-3.1-flash-lite': 'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite-preview': 'gemini-3.5-flash-lite',
};

export function resolveModelPreference(value: unknown): ModelPreference {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw === 'auto') return 'auto';
  if (MODEL_OPTIONS.some((option) => option.id === raw)) {
    return raw as ModelPreference;
  }
  return LEGACY_MODEL_IDS[raw] ?? 'auto';
}

export function getInitialModelPreference(): ModelPreference {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    return resolveModelPreference(stored);
  } catch {
    // Storage not ready yet (SSR or pre-bootstrap)
  }
  return 'auto';
}

export function saveModelPreference(value: ModelPreference): void {
  getStorage().setItem(STORAGE_KEY, value);
}

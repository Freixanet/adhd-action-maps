import { getStorage } from './storage';

export const MODEL_OPTIONS = [
  { id: 'auto', label: 'Automático', hint: 'Mejor disponible' },
  { id: 'gemini-3.5-flash', label: 'Flash 3.5', hint: 'Máxima calidad' },
  { id: 'gemini-3-flash-preview', label: 'Flash Preview', hint: 'Equilibrado' },
  { id: 'gemini-3.1-flash-lite', label: 'Flash Lite', hint: 'Pruebas' },
] as const;

export type ModelPreference = (typeof MODEL_OPTIONS)[number]['id'];

const STORAGE_KEY = 'tdah-model-preference';

export function getInitialModelPreference(): ModelPreference {
  try {
    const stored = getStorage().getItem(STORAGE_KEY);
    if (stored && MODEL_OPTIONS.some((option) => option.id === stored)) {
      return stored as ModelPreference;
    }
  } catch {
    // Storage not ready yet (SSR or pre-bootstrap)
  }
  return 'auto';
}

export function saveModelPreference(value: ModelPreference): void {
  getStorage().setItem(STORAGE_KEY, value);
}

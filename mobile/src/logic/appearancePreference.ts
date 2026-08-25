import { getStorage } from '@shared/storage';

export const APPEARANCE_OPTIONS = [
  { id: 'system', label: 'Sistema' },
  { id: 'light', label: 'Claro' },
  { id: 'dark', label: 'Oscuro' },
] as const;

export type AppearancePreference = (typeof APPEARANCE_OPTIONS)[number]['id'];

const STORAGE_KEY = 'nucleo.appearance-preference';

export function resolveAppearancePreference(value: unknown): AppearancePreference {
  const raw = typeof value === 'string' ? value : '';
  return APPEARANCE_OPTIONS.some((option) => option.id === raw)
    ? (raw as AppearancePreference)
    : 'system';
}

export function getInitialAppearancePreference(): AppearancePreference {
  try {
    return resolveAppearancePreference(getStorage().getItem(STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function saveAppearancePreference(value: AppearancePreference): void {
  try {
    getStorage().setItem(STORAGE_KEY, value);
  } catch {
    // Preference is best-effort; system appearance remains the fallback.
  }
}

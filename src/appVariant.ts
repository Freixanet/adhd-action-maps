export const APP_VARIANT_OPTIONS = [
  { id: 'classic', label: 'Clásica', hint: 'Mapas de acción paso a paso' },
  { id: 'comprension', label: 'Comprensión', hint: 'Lectura guiada con objetivos' },
] as const;

export type AppVariant = (typeof APP_VARIANT_OPTIONS)[number]['id'];

const STORAGE_KEY = 'nucleo-app-variant';

export function getAppVariant(): AppVariant {
  if (typeof window === 'undefined') return 'comprension';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'classic' || stored === 'comprension') return stored;
  return 'comprension';
}

export function saveAppVariant(variant: AppVariant): void {
  localStorage.setItem(STORAGE_KEY, variant);
}

export function switchAppVariant(next: AppVariant): void {
  if (next === getAppVariant()) return;
  saveAppVariant(next);
  window.location.reload();
}

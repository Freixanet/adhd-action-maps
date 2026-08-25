import { getStorage } from '@shared/storage';

export const READING_SIZE_OPTIONS = [
  { id: 'system', label: 'Sistema', scale: 1 },
  { id: 'comfortable', label: 'Cómodo', scale: 1.08 },
  { id: 'large', label: 'Grande', scale: 1.18 },
  { id: 'extraLarge', label: 'Muy grande', scale: 1.28 },
] as const;

export type ReadingSizePreference = (typeof READING_SIZE_OPTIONS)[number]['id'];

const STORAGE_KEY = 'nucleo.reading-size-preference';

export function resolveReadingSizePreference(value: unknown): ReadingSizePreference {
  const raw = typeof value === 'string' ? value : '';
  return READING_SIZE_OPTIONS.some((option) => option.id === raw)
    ? (raw as ReadingSizePreference)
    : 'system';
}

export function getInitialReadingSizePreference(): ReadingSizePreference {
  try {
    return resolveReadingSizePreference(getStorage().getItem(STORAGE_KEY));
  } catch {
    return 'system';
  }
}

export function saveReadingSizePreference(value: ReadingSizePreference): void {
  try {
    getStorage().setItem(STORAGE_KEY, value);
  } catch {
    // Local preference is best-effort; the system Dynamic Type remains active.
  }
}

export function readingSizeScale(value: ReadingSizePreference): number {
  return READING_SIZE_OPTIONS.find((option) => option.id === value)?.scale ?? 1;
}

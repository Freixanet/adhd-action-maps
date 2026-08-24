/**
 * Reading shape of a Núcleo — compiler-owned, never a user-facing mode.
 * Pages are composed from the step-block allowlist only.
 */

export const NUCLEO_FORMAT_IDS = [
  'contrast',
  'causal',
  'sequence',
  'process',
  'argument',
  'concept',
  'reading',
] as const;

export type NucleoFormatId = (typeof NUCLEO_FORMAT_IDS)[number];

export function isNucleoFormatId(value: unknown): value is NucleoFormatId {
  return typeof value === 'string' && (NUCLEO_FORMAT_IDS as readonly string[]).includes(value);
}

/** One-line cue under the step title. What to do with this page. */
export const NUCLEO_FORMAT_PURPOSE: Record<NucleoFormatId, string> = {
  contrast: 'Mira las dos caras a la vez.',
  causal: 'Sigue qué empuja a qué.',
  sequence: 'El orden de las piezas importa.',
  process: 'Así describe el procedimiento la fuente.',
  argument: 'Qué se afirma y qué lo limita.',
  concept: 'Qué hay que entender aquí.',
  reading: 'Una idea por pantalla.',
};

export const NUCLEO_FORMAT_SELF_CHECK: Record<NucleoFormatId, (title: string) => string> = {
  contrast: (title) => `¿Qué distingue «${title}» de lo que no es?`,
  causal: (title) => `¿Qué mueve qué en «${title}»?`,
  sequence: (title) => `¿Qué va antes y qué va después en «${title}»?`,
  process: (title) => `¿Cuáles son los pasos que describe «${title}»?`,
  argument: (title) => `¿Qué objeción no puedes perder de «${title}»?`,
  concept: (title) => `¿Qué aporta «${title}» a la idea nuclear?`,
  reading: (title) => `¿Qué te llevas de «${title}»?`,
};

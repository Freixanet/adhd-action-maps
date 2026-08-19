/**
 * Nucleo design tokens — typed facade.
 *
 * Canonical source: `./canonical.json`
 * Generated: `./generated/tokens.ts` via `npm run tokens:generate`
 *
 * Prefer semantic exports (`color`, `space`, `type`, `radius`, `motion`, `shadow`)
 * over primitives.
 *
 * Uses a namespace import so Metro/Hermes get concrete value bindings (named
 * `export { x } from` re-exports have resolved to undefined at app boot).
 */
import * as generated from './generated/tokens';

export const TOKEN_FINGERPRINT = generated.TOKEN_FINGERPRINT;
export const primitive = generated.primitive;
export const color = generated.color;
export const themeColor = generated.themeColor;
export const space = generated.space;
export const type = generated.type;
export const font = generated.font;
export const reading = generated.reading;
export const typography = generated.typography;
export const radius = generated.radius;
export const motion = generated.motion;
export const shadow = generated.shadow;
export const blur = generated.blur;
export const control = generated.control;
export const glass = generated.glass;
export const engraved = generated.engraved;

export type TypeRole = generated.TypeRole;
export type ColorSchemeName = generated.ColorSchemeName;

/** Runtime palette for a resolved scheme. */
export function colorsFor(scheme: generated.ColorSchemeName) {
  return generated.themeColor[scheme];
}

/**
 * SHA-256 of the exact canonical pasted string.
 * Portable — no node:crypto (Metro/RN safe).
 */
import { sha256Hex } from './sha256Hex';

export function hashCanonicalPastedText(canonical: string): string {
  return sha256Hex(canonical);
}

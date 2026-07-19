import { FEATURES } from './features';

/** Cuentas con Pro permanente (desarrollo / equipo). */
export const BUILTIN_PRO_EMAILS = ['marcfreixanet@gmail.com'] as const;

function normalizeProEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseProEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((item) => normalizeProEmail(item))
    .filter(Boolean);
}

function envProEmails(): string[] {
  if (typeof process === 'undefined') return [];
  return parseProEmailList(
    process.env.NUCLEO_PRO_EMAILS ?? process.env.EXPO_PUBLIC_NUCLEO_PRO_EMAILS
  );
}

export function getProEmailAllowlist(): readonly string[] {
  const seen = new Set<string>();
  const emails: string[] = [];

  for (const email of [...BUILTIN_PRO_EMAILS, ...envProEmails()]) {
    const normalized = normalizeProEmail(email);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    emails.push(normalized);
  }

  return emails;
}

export function isProUser(email: string | null | undefined): boolean {
  if (FEATURES.deepDepth) return true;
  if (!email?.trim()) return false;
  const normalized = normalizeProEmail(email);
  return getProEmailAllowlist().includes(normalized);
}

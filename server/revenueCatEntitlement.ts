/**
 * Server-side RevenueCat entitlement check.
 * When REVENUECAT_SECRET_API_KEY is set, Pro is resolved from the `pro`
 * entitlement for the given app user id (Supabase user id preferred).
 * Allowlist remains a team/dev fallback via isProUser(email).
 */

import { isProUser } from '../shared/proEntitlement';

export const PRO_ENTITLEMENT_ID = 'pro';

const RC_TIMEOUT_MS = 4000;

type RcSubscriberResponse = {
  subscriber?: {
    entitlements?: {
      [key: string]: { expires_date?: string | null; product_identifier?: string };
    };
  };
};

function secretKey(): string | undefined {
  return process.env.REVENUECAT_SECRET_API_KEY?.trim() || undefined;
}

export function isRevenueCatServerConfigured(): boolean {
  return Boolean(secretKey());
}

/**
 * True when the subscriber has an active `pro` entitlement (null expiry or future).
 */
export function subscriberHasPro(payload: RcSubscriberResponse): boolean {
  const ent = payload.subscriber?.entitlements?.[PRO_ENTITLEMENT_ID];
  if (!ent) return false;
  if (ent.expires_date == null || ent.expires_date === '') return true;
  const expires = Date.parse(ent.expires_date);
  if (!Number.isFinite(expires)) return true;
  return expires > Date.now();
}

export async function fetchRevenueCatIsPro(appUserId: string): Promise<boolean | null> {
  const key = secretKey();
  const id = appUserId.trim();
  if (!key || !id) return null;

  try {
    const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(RC_TIMEOUT_MS),
    });
    if (response.status === 404) return false;
    if (!response.ok) {
      console.warn('[revenuecat] subscriber lookup failed', response.status);
      return null;
    }
    const body = (await response.json()) as RcSubscriberResponse;
    return subscriberHasPro(body);
  } catch (err) {
    console.warn(
      '[revenuecat] subscriber lookup error',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * Resolve Pro for an authenticated user: RevenueCat first, then email allowlist.
 */
export async function resolveServerIsPro(options: {
  userId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  if (options.userId && isRevenueCatServerConfigured()) {
    const fromRc = await fetchRevenueCatIsPro(options.userId);
    if (fromRc === true) return true;
    if (fromRc === false && !isProUser(options.email)) return false;
  }
  return isProUser(options.email);
}

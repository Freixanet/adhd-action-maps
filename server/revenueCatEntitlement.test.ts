import { describe, expect, it } from 'vitest';
import { subscriberHasPro } from './revenueCatEntitlement';

describe('subscriberHasPro', () => {
  it('returns false without entitlement', () => {
    expect(subscriberHasPro({})).toBe(false);
    expect(subscriberHasPro({ subscriber: { entitlements: {} } })).toBe(false);
  });

  it('returns true for active pro with null expiry', () => {
    expect(
      subscriberHasPro({
        subscriber: { entitlements: { pro: { expires_date: null } } },
      })
    ).toBe(true);
  });

  it('returns true for future expiry', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      subscriberHasPro({
        subscriber: { entitlements: { pro: { expires_date: future } } },
      })
    ).toBe(true);
  });

  it('returns false for past expiry', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(
      subscriberHasPro({
        subscriber: { entitlements: { pro: { expires_date: past } } },
      })
    ).toBe(false);
  });
});

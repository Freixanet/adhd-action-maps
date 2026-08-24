import { describe, expect, it } from 'vitest';
import {
  recentProductEvents,
  trackProductEvent,
} from './productTelemetry';

describe('productTelemetry', () => {
  it('records events without throwing', () => {
    trackProductEvent('paywall_view');
    trackProductEvent('transform_success', { ok: true });
    const events = recentProductEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[events.length - 1]?.name).toBe('transform_success');
  });
});

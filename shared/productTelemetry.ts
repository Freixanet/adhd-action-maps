/**
 * Product analytics — no PII, no source text, no map content.
 * Events go to an in-memory ring + optional POST /api/telemetry when configured.
 */

export type ProductEventName =
  | 'transform_start'
  | 'transform_success'
  | 'transform_error'
  | 'paywall_view'
  | 'paywall_purchase_start'
  | 'paywall_purchase_success'
  | 'paywall_purchase_cancel'
  | 'trial_start'
  | 'subscribe'
  | 'restore_success'
  | 'continue_open'
  | 'incomplete_reminder_scheduled'
  | 'share_incoming';

export type ProductEvent = {
  name: ProductEventName;
  at: number;
  props?: Record<string, string | number | boolean | null>;
};

const RING_MAX = 100;
const ring: ProductEvent[] = [];
const listeners = new Set<(event: ProductEvent) => void>();

export function trackProductEvent(
  name: ProductEventName,
  props?: ProductEvent['props']
): void {
  const event: ProductEvent = { name, at: Date.now(), props };
  ring.push(event);
  if (ring.length > RING_MAX) ring.shift();
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Never break product flows for analytics.
    }
  }
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.info('[telemetry]', name, props ?? {});
  }
}

export function subscribeProductEvents(
  listener: (event: ProductEvent) => void
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recentProductEvents(): readonly ProductEvent[] {
  return ring.slice();
}

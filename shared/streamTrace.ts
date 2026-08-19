/**
 * Transform-stream lifecycle tracing (server + client).
 * Always on in development; force with TRANSFORM_STREAM_TRACE=1.
 * Never log private source content.
 */

export type StreamTraceEvent =
  | 'request_started'
  | 'headers_flushed'
  | 'heartbeat_written'
  | 'result_persisted'
  | 'done_serialized'
  | 'done_write_ok'
  | 'done_write_failed'
  | 'response_finish'
  | 'response_close'
  | 'request_aborted'
  | 'generation_failed'
  | 'stream_start'
  | 'stream_started'
  | 'heartbeat'
  | 'stage'
  | 'essential_ready'
  | 'done_bytes'
  | 'done_parsed'
  | 'done_received'
  | 'result_poll_started'
  | 'result_recovered'
  | 'finish'
  | 'close'
  | 'aborted'
  | 'idle_timeout'
  | 'incomplete'
  | 'error'
  | 'app_status'
  | 'event_received';

export type StreamTraceFields = {
  runId?: string | number;
  mapId?: string;
  generationRunId?: string;
  stage?: string;
  bytes?: number;
  status?: string;
  detail?: string;
  processed?: number;
  total?: number;
  eventType?: string;
};

function isDevRuntime(): boolean {
  try {
    const env =
      (typeof process !== 'undefined' && process.env
        ? process.env
        : {}) as Record<string, string | undefined>;
    if (env.TRANSFORM_STREAM_TRACE === '0' || env.EXPO_PUBLIC_TRANSFORM_STREAM_TRACE === '0') {
      return false;
    }
    if (env.TRANSFORM_STREAM_TRACE === '1' || env.EXPO_PUBLIC_TRANSFORM_STREAM_TRACE === '1') {
      return true;
    }
    if (env.NODE_ENV === 'production') return false;
    // Expo / RN
    if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
    return env.NODE_ENV !== 'production';
  } catch {
    return true;
  }
}

declare const __DEV__: boolean | undefined;

export function streamTrace(
  event: StreamTraceEvent,
  fields: StreamTraceFields = {},
  level: 'info' | 'error' = 'info'
): void {
  if (level !== 'error' && !isDevRuntime()) return;
  const payload = { event, ...fields, t: Date.now() };
  if (level === 'error') {
    console.error('[transform-stream]', payload);
  } else {
    console.log('[transform-stream]', payload);
  }
}

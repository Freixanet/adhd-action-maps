import type { ActionMapData, AskResponse, MapDepth, TransformStreamEvent } from './contracts';
import { isLayer0Complete } from './layer0';
import { normalizeMapData } from './mapData';
import { streamTrace } from './streamTrace';
import {
  buildGenerationResultUrl,
  GENERATION_RESULT_POLL_MAX_MS,
  GENERATION_RESULT_POLL_MS,
  GENERATION_WALL_CLOCK_MS,
  isGenerationResultComplete,
  type GenerationResultResponse,
} from './generationResult';

/** Default idle window when depth is unknown (estándar). */
export const TRANSFORM_IDLE_TIMEOUT_MS = 150_000;
export const TRANSFORM_IDLE_TIMEOUT_MESSAGE =
  'La generación se ha detenido. Comprueba tu conexión e inténtalo de nuevo.';
/** Max gap between stream activity before clients should expect a heartbeat. */
export const TRANSFORM_HEARTBEAT_HINT_MS = 10_000;

export function isAskLanePayload(value: unknown): value is AskResponse & { isAsk: true; answer: string } {
  if (!value || typeof value !== 'object') return false;
  const raw = value as AskResponse;
  return raw.isAsk === true && typeof raw.answer === 'string' && raw.answer.trim().length > 0;
}

export function resolveTransformIdleTimeoutMs(depth?: MapDepth): number {
  if (depth === 'rapido') return 120_000;
  if (depth === 'profundo') return 240_000;
  return 150_000;
}

export function resolveTransformFallbackTimeoutMs(depth?: MapDepth): number {
  if (depth === 'rapido') return 90_000;
  if (depth === 'profundo') return 240_000;
  return 150_000;
}

function resolveDepthFromBody(body: unknown): MapDepth {
  const depth = (body as { depth?: string })?.depth;
  if (depth === 'rapido' || depth === 'profundo') return depth;
  return 'estandar';
}

export function isNonRetryableTransformError(message: string): boolean {
  return (
    /Demasiadas solicitudes/i.test(message) ||
    /No hay modelos disponibles/i.test(message) ||
    /l[ií]mite.*Gemini/i.test(message) ||
    /Error 429/i.test(message) ||
    /Error 503/i.test(message) ||
    /quota|RESOURCE_EXHAUSTED/i.test(message) ||
    /plan gratuito de Gemini/i.test(message) ||
    /Inicia sesi[oó]n/i.test(message) ||
    /3 N[uú]cleos gratis/i.test(message) ||
    /5 N[uú]cleos gratis/i.test(message) ||
    /L[ií]mite beta alcanzado/i.test(message) ||
    /l[ií]mite diario/i.test(message) ||
    /exclusiva? de Pro/i.test(message)
  );
}

export class TransformHttpError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly action?: string;

  constructor(
    message: string,
    options: { status: number; code?: string; action?: string }
  ) {
    super(message);
    this.name = 'TransformHttpError';
    this.status = options.status;
    this.code = options.code;
    this.action = options.action;
  }
}

export function isBetaQuotaExceededError(err: unknown): boolean {
  if (err instanceof TransformHttpError) {
    return err.status === 402 || err.code === 'quota_exceeded';
  }
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (code === 'quota_exceeded') return true;
  }
  if (err instanceof Error) {
    return (
      /quota_exceeded/i.test(err.message) ||
      /L[ií]mite beta alcanzado/i.test(err.message) ||
      /5 N[uú]cleos gratis/i.test(err.message)
    );
  }
  return false;
}

function throwTransformHttpError(
  status: number,
  payload: { error?: string; code?: string; action?: string }
): never {
  throw new TransformHttpError(payload.error || `Error del servidor (${status})`, {
    status,
    code: payload.code,
    action: payload.action,
  });
}

export type FetchWithTimeoutOptions = {
  timeoutMs?: number;
  timeoutMessage?: string;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 20000,
    timeoutMessage = 'La conexión está tardando demasiado. Inténtalo de nuevo.',
  } = options;

  const controller = new AbortController();
  const { signal } = init;

  let didTimeout = false;
  let externalAbortListener: (() => void) | null = null;

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      externalAbortListener = () => {
        controller.abort();
      };
      signal.addEventListener('abort', externalAbortListener, { once: true });
    }
  }

  const timer = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (didTimeout) {
      throw new Error(timeoutMessage);
    }
    if (err && err.name === 'AbortError') {
      if (signal?.aborted) {
        throw err;
      }
      throw new Error(timeoutMessage);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal && externalAbortListener) {
      signal.removeEventListener('abort', externalAbortListener);
    }
  }
}

export function isRenderablePartialMap(map: ActionMapData | null): boolean {
  if (!map) return false;
  if (isLayer0Complete(map.layer0)) return true;
  const hasTitle = Boolean(map.title?.trim() && map.title !== 'Mapa sin título');
  const hasCore = Boolean(map.coreIdea?.trim());
  const hasSteps = Boolean(map.steps?.length);
  return (hasTitle && hasCore) || hasSteps;
}

export type TransformSourceMeta =
  | import('./pastedText').PastedTextSourceMeta
  | import('./pdf/types').PdfSourceMeta;

export type TransformStreamHandlers = {
  onPartial?: (map: ActionMapData) => void;
  onFirstStreamByte?: () => void;
  onDone: (
    map: ActionMapData,
    model?: string,
    sourceMeta?: TransformSourceMeta,
    pdfPersistRetry?: import('./pdf/types').PdfPersistRetryPayload | null
  ) => void;
  onSourceMeta?: (
    meta: TransformSourceMeta,
    pdfPersistRetry?: import('./pdf/types').PdfPersistRetryPayload | null
  ) => void;
  /** S04: Lo esencial listo antes del mapa completo. */
  onEssentialReady?: (partial: ActionMapData) => void;
  /** S04: etiqueta humana de etapa. */
  onStage?: (label: string) => void;
  /** Keep-alive during long stages; must not mutate progress UI. */
  onHeartbeat?: () => void;
  /** Server assigned / echoed mapId + generationRunId for recovery polls. */
  onRun?: (ids: { mapId: string; generationRunId: string }) => void;
  /** Server routed the request to the unverified ask lane. */
  onAsk?: (result: AskResponse & { isAsk: true; answer: string }) => void;
  onError: (message: string) => void;
};

export type ConsumeTransformStreamResult = 'done' | 'error' | 'idle' | 'incomplete' | 'aborted';

export function parseTransformStreamLine(line: string): TransformStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as TransformStreamEvent;
  } catch {
    return null;
  }
}

export async function consumeTransformStream(
  response: Response,
  handlers: TransformStreamHandlers,
  options: {
    signal?: AbortSignal;
    idleTimeoutMs?: number;
    runId?: string;
    mapId?: string;
  } = {}
): Promise<ConsumeTransformStreamResult> {
  const body = response.body;
  if (!body) return 'incomplete';

  const idleTimeoutMs = options.idleTimeoutMs ?? TRANSFORM_IDLE_TIMEOUT_MS;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleAborted = false;
  let firstStreamByteEmitted = false;
  let doneBytes = 0;

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const resetIdle = () => {
    clearIdle();
    idleTimer = setTimeout(() => {
      idleAborted = true;
      streamTrace('idle_timeout', {
        runId: options.runId,
        mapId: options.mapId,
        detail: String(idleTimeoutMs),
      });
      reader.cancel().catch(() => undefined);
    }, idleTimeoutMs);
  };

  const onExternalAbort = () => {
    idleAborted = true;
    streamTrace('aborted', { runId: options.runId, mapId: options.mapId });
    reader.cancel().catch(() => undefined);
  };

  options.signal?.addEventListener('abort', onExternalAbort, { once: true });

  streamTrace('stream_started', { runId: options.runId, mapId: options.mapId });
  resetIdle();

  const dispatchEvent = (
    event: TransformStreamEvent
  ): ConsumeTransformStreamResult | null => {
    streamTrace('event_received', {
      runId: options.runId,
      mapId: options.mapId,
      eventType: event.type,
    });

    if (event.type === 'run' && event.mapId && event.generationRunId) {
      handlers.onRun?.({
        mapId: event.mapId,
        generationRunId: event.generationRunId,
      });
      return null;
    }

    if (event.type === 'partial' && event.map) {
      const normalized = normalizeMapData(event.map, { allowPartial: true });
      if (normalized && isRenderablePartialMap(normalized)) {
        handlers.onPartial?.(normalized);
      }
      return null;
    }

    if (event.type === 'source_meta' && event.sourceMeta) {
      handlers.onSourceMeta?.(event.sourceMeta, event.pdfPersistRetry ?? null);
      return null;
    }

    if (event.type === 'stage' && event.stageLabel) {
      streamTrace('stage', {
        runId: options.runId,
        mapId: options.mapId,
        stage: event.stageLabel,
      });
      handlers.onStage?.(event.stageLabel);
      return null;
    }

    if (event.type === 'heartbeat') {
      streamTrace('heartbeat', { runId: options.runId, mapId: options.mapId });
      handlers.onHeartbeat?.();
      return null;
    }

    if (event.type === 'essential_ready') {
      streamTrace('essential_ready', { runId: options.runId, mapId: options.mapId });
      const partialFromEvent =
        event.map ||
        (event.essential
          ? ({
              title: event.essential.title,
              coreIdea: event.essential.coreIdea,
              coreSupport: event.essential.coreSupport,
              layer0: event.essential.layer0,
              tldr: [],
              steps: [],
              intent: 'understand',
            } satisfies ActionMapData)
          : null);
      if (partialFromEvent) {
        const normalized = normalizeMapData(partialFromEvent, { allowPartial: true });
        if (normalized) {
          handlers.onEssentialReady?.(normalized);
          if (isRenderablePartialMap(normalized)) {
            handlers.onPartial?.(normalized);
          }
        }
      }
      return null;
    }

    if (event.type === 'done' && event.map) {
      const raw = JSON.stringify(event);
      doneBytes = raw.length;
      streamTrace('done_received', {
        runId: options.runId,
        mapId: options.mapId,
        bytes: doneBytes,
      });
      streamTrace('done_bytes', {
        runId: options.runId,
        mapId: options.mapId,
        bytes: doneBytes,
      });
      const normalized = normalizeMapData(event.map);
      if (!normalized) {
        handlers.onError('No se pudo interpretar el mapa generado.');
        streamTrace(
          'error',
          { runId: options.runId, mapId: options.mapId, detail: 'done_normalize_failed' },
          'error'
        );
        return 'error';
      }
      streamTrace('done_parsed', {
        runId: options.runId,
        mapId: options.mapId,
        bytes: doneBytes,
      });
      handlers.onDone(
        normalized,
        event.model,
        event.sourceMeta,
        event.pdfPersistRetry ?? null
      );
      return 'done';
    }

    if (event.type === 'error') {
      handlers.onError(event.error || 'Error desconocido durante la generación.');
      streamTrace(
        'error',
        {
          runId: options.runId,
          mapId: options.mapId,
          detail: event.error || 'stream_error',
        },
        'error'
      );
      return 'error';
    }

    return null;
  };

  const consumeLines = (chunk: string): ConsumeTransformStreamResult | null => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const event = parseTransformStreamLine(line);
      if (!event) continue;
      const result = dispatchEvent(event);
      if (result) return result;
    }
    return null;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (idleAborted) {
          const status = options.signal?.aborted ? 'aborted' : 'idle';
          streamTrace(status === 'aborted' ? 'aborted' : 'idle_timeout', {
            runId: options.runId,
            mapId: options.mapId,
          });
          return status;
        }
        break;
      }
      if (idleAborted) {
        return options.signal?.aborted ? 'aborted' : 'idle';
      }

      if (value?.byteLength && !firstStreamByteEmitted) {
        firstStreamByteEmitted = true;
        handlers.onFirstStreamByte?.();
      }

      resetIdle();
      const early = consumeLines(decoder.decode(value, { stream: true }));
      if (early) {
        streamTrace('finish', { runId: options.runId, mapId: options.mapId, status: early });
        return early;
      }
    }

    // Final decode + flush leftover buffer so a large `done` split across chunks still parses.
    const trailing = consumeLines(decoder.decode());
    if (trailing) {
      streamTrace('finish', { runId: options.runId, mapId: options.mapId, status: trailing });
      return trailing;
    }
    if (buffer.trim()) {
      const event = parseTransformStreamLine(buffer);
      buffer = '';
      if (event) {
        const result = dispatchEvent(event);
        if (result) {
          streamTrace('finish', { runId: options.runId, mapId: options.mapId, status: result });
          return result;
        }
      }
    }

    streamTrace('incomplete', { runId: options.runId, mapId: options.mapId });
    streamTrace('close', { runId: options.runId, mapId: options.mapId, status: 'incomplete' });
    return 'incomplete';
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : '';
    if (options.signal?.aborted) {
      streamTrace('aborted', { runId: options.runId, mapId: options.mapId });
      return 'aborted';
    }
    if (idleAborted || name === 'AbortError') {
      streamTrace('idle_timeout', { runId: options.runId, mapId: options.mapId });
      return 'idle';
    }
    streamTrace(
      'error',
      {
        runId: options.runId,
        mapId: options.mapId,
        detail: err instanceof Error ? err.message : 'stream_exception',
      },
      'error'
    );
    throw err;
  } finally {
    clearIdle();
    options.signal?.removeEventListener('abort', onExternalAbort);
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
}

export type FetchTransformOptions = {
  streamUrl: string;
  fallbackUrl: string;
  body: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  depth?: MapDepth;
  idleTimeoutMs?: number;
  fallbackTimeoutMs?: number;
  handlers: TransformStreamHandlers;
};

function streamEndedWithoutDoneMessage(
  result: ConsumeTransformStreamResult,
  receivedRenderablePartial: boolean
): string {
  if (result === 'idle') {
    return TRANSFORM_IDLE_TIMEOUT_MESSAGE;
  }
  if (receivedRenderablePartial) {
    return 'La generación se interrumpió antes de completarse.';
  }
  return 'Streaming incompleto';
}

async function fetchGenerationResultOnce(args: {
  url: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<GenerationResultResponse | null> {
  try {
    const response = await fetch(args.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(args.headers ?? {}),
      },
      signal: args.signal,
    });
    if (!response.ok && response.status !== 404) return null;
    const parsed = (await response.json()) as GenerationResultResponse;
    if (!parsed?.mapId || !parsed?.generationRunId || !parsed?.status) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Poll durable generation result until complete/failed/cancelled or timeout.
 * Never re-runs models — GET only.
 */
export async function pollGenerationResultUntilTerminal(args: {
  streamUrl: string;
  mapId: string;
  generationRunId: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  pollMs?: number;
  maxMs?: number;
  onTick?: (record: GenerationResultResponse | null) => void;
}): Promise<GenerationResultResponse | null> {
  const pollMs = args.pollMs ?? GENERATION_RESULT_POLL_MS;
  const maxMs = args.maxMs ?? GENERATION_RESULT_POLL_MAX_MS;
  const started = Date.now();
  streamTrace('result_poll_started', {
    mapId: args.mapId,
    generationRunId: args.generationRunId,
  });

  while (Date.now() - started < maxMs) {
    if (args.signal?.aborted) return null;
    const url = buildGenerationResultUrl(args.streamUrl, args.mapId, args.generationRunId);
    const record = await fetchGenerationResultOnce({
      url,
      headers: args.headers,
      signal: args.signal,
    });
    args.onTick?.(record);
    if (
      record &&
      (record.status === 'complete' ||
        record.status === 'failed' ||
        record.status === 'cancelled')
    ) {
      return record;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, pollMs);
      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };
      if (args.signal) {
        if (args.signal.aborted) {
          clearTimeout(timer);
          resolve();
          return;
        }
        args.signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }
  return null;
}

function sourceMetaFromHeaders(headers: Headers): import('./pastedText').PastedTextSourceMeta | null {
  const sourceId = headers.get('X-Nucleo-Source-Id')?.trim();
  const sourceVersionId = headers.get('X-Nucleo-Source-Version-Id')?.trim();
  const sourceRequestId = headers.get('X-Nucleo-Source-Request-Id')?.trim();
  const sourceStatus = headers.get('X-Nucleo-Source-Status')?.trim() as
    | import('./pastedText').PastedTextSourceStatus
    | undefined;
  const persistStatus = headers.get('X-Nucleo-Persist-Status')?.trim() as
    | import('./pastedText').PastedTextPersistStatus
    | undefined;
  const contentHash = headers.get('X-Nucleo-Content-Hash')?.trim();
  const segmentCountRaw = headers.get('X-Nucleo-Segment-Count')?.trim();
  const segmentCount = segmentCountRaw ? Number(segmentCountRaw) : NaN;
  if (
    !sourceId ||
    !sourceVersionId ||
    !sourceRequestId ||
    !sourceStatus ||
    !persistStatus ||
    !contentHash ||
    !Number.isFinite(segmentCount)
  ) {
    return null;
  }
  return {
    sourceId,
    sourceVersionId,
    sourceRequestId,
    sourceStatus,
    persistStatus,
    contentHash,
    segmentCount,
    ...(headers.get('X-Nucleo-Persist-Failure-Code')?.trim()
      ? {
          persistFailureCode: headers.get('X-Nucleo-Persist-Failure-Code')!.trim(),
        }
      : {}),
  };
}

export async function fetchTransformWithProgress({
  streamUrl,
  fallbackUrl,
  body,
  headers = {},
  signal,
  depth,
  idleTimeoutMs,
  fallbackTimeoutMs,
  handlers,
}: FetchTransformOptions): Promise<'stream' | 'fallback' | 'ask'> {
  let receivedRenderablePartial = false;
  let streamEstablished = false;
  const wallStartedAt = Date.now();

  const resolvedDepth = depth ?? resolveDepthFromBody(body);
  const resolvedIdleTimeoutMs = idleTimeoutMs ?? resolveTransformIdleTimeoutMs(resolvedDepth);
  const resolvedFallbackTimeoutMs =
    fallbackTimeoutMs ?? resolveTransformFallbackTimeoutMs(resolvedDepth);
  const resolvedStreamTimeoutMs = (() => {
    if (resolvedDepth === 'rapido') return 20000;
    if (resolvedDepth === 'profundo') return 45000;
    return 25000; // estandar
  })();

  let latestSourceMeta: TransformSourceMeta | null = null;
  let latestPdfPersistRetry: import('./pdf/types').PdfPersistRetryPayload | null = null;

  const ids = {
    mapId:
      body && typeof body === 'object' && typeof (body as { mapId?: unknown }).mapId === 'string'
        ? (body as { mapId: string }).mapId.trim()
        : '',
    generationRunId:
      body &&
      typeof body === 'object' &&
      typeof (body as { generationRunId?: unknown }).generationRunId === 'string'
        ? (body as { generationRunId: string }).generationRunId.trim()
        : '',
  };

  let terminalHandled = false;
  let terminalKind: 'done' | 'error' | null = null;
  const localAbort = new AbortController();
  const onUserAbort = () => localAbort.abort();
  if (signal) {
    if (signal.aborted) localAbort.abort();
    else signal.addEventListener('abort', onUserAbort, { once: true });
  }

  const finishDone = (
    map: ActionMapData,
    model?: string,
    sourceMeta?: TransformSourceMeta,
    pdfPersistRetry?: import('./pdf/types').PdfPersistRetryPayload | null,
    via: 'stream' | 'poll' = 'stream'
  ): boolean => {
    if (terminalHandled) return false;
    if (via === 'poll') {
      streamTrace('result_recovered', {
        mapId: ids.mapId,
        generationRunId: ids.generationRunId,
      });
    }
    handlers.onDone(
      map,
      model,
      sourceMeta ?? latestSourceMeta ?? undefined,
      pdfPersistRetry ?? latestPdfPersistRetry
    );
    // Only mark the transport complete after the consumer has accepted and saved
    // the map. Otherwise an AppSession failure is swallowed as a successful run.
    terminalHandled = true;
    terminalKind = 'done';
    return true;
  };

  const finishError = (message: string): boolean => {
    if (terminalHandled) return false;
    terminalHandled = true;
    terminalKind = 'error';
    handlers.onError(message);
    return true;
  };

  const applyRecoveredRecord = (record: GenerationResultResponse): boolean => {
    if (isGenerationResultComplete(record)) {
      const normalized = normalizeMapData(record.map);
      if (!normalized) {
        return finishError('No se pudo interpretar el mapa generado.');
      }
      return finishDone(normalized, record.model, undefined, null, 'poll');
    }
    if (record.status === 'failed' || record.status === 'cancelled') {
      return finishError(
        record.error ||
          (record.status === 'cancelled'
            ? 'Creación cancelada'
            : 'No se pudo generar el Núcleo.')
      );
    }
    return false;
  };

  const wrappedHandlers: TransformStreamHandlers = {
    onPartial: (map) => {
      receivedRenderablePartial = true;
      handlers.onPartial?.(map);
    },
    onFirstStreamByte: handlers.onFirstStreamByte,
    onSourceMeta: (meta, pdfPersistRetry) => {
      latestSourceMeta = meta;
      if (pdfPersistRetry) latestPdfPersistRetry = pdfPersistRetry;
      handlers.onSourceMeta?.(meta, pdfPersistRetry);
    },
    onEssentialReady: handlers.onEssentialReady,
    onStage: handlers.onStage,
    onHeartbeat: handlers.onHeartbeat,
    onRun: (runIds) => {
      ids.mapId = runIds.mapId;
      ids.generationRunId = runIds.generationRunId;
      handlers.onRun?.(runIds);
    },
    onDone: (map, model, sourceMeta, pdfPersistRetry) => {
      finishDone(map, model, sourceMeta, pdfPersistRetry, 'stream');
    },
    onAsk: handlers.onAsk,
    onError: (message) => {
      finishError(message);
    },
  };

  const shouldAllowRestFallback = () =>
    !signal?.aborted && !streamEstablished && !receivedRenderablePartial;

  const assertWithinWallClock = () => {
    if (Date.now() - wallStartedAt > GENERATION_WALL_CLOCK_MS) {
      throw new Error(
        'La generación ha superado el tiempo máximo. Comprueba el resultado o inténtalo de nuevo.'
      );
    }
  };

  try {
    const response = await fetchWithTimeout(
      streamUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/x-ndjson',
          ...headers,
        },
        body: JSON.stringify(body),
        signal: localAbort.signal,
      },
      {
        timeoutMs: resolvedStreamTimeoutMs,
        timeoutMessage: 'La generación está tardando demasiado en empezar. Inténtalo de nuevo.',
      }
    );

    if (!response.ok) {
      const errPayload = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        action?: string;
      };
      throwTransformHttpError(response.status, errPayload);
    }

    const headerMeta = sourceMetaFromHeaders(response.headers);
    if (headerMeta) {
      latestSourceMeta = headerMeta;
      wrappedHandlers.onSourceMeta?.(headerMeta);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
      const parsed = (await response.json()) as unknown;
      if (isAskLanePayload(parsed)) {
        wrappedHandlers.onAsk?.(parsed);
        return 'ask';
      }
      const jsonMeta =
        parsed && typeof parsed === 'object' && 'sourceMeta' in (parsed as object)
          ? ((parsed as { sourceMeta?: TransformSourceMeta }).sourceMeta ?? null)
          : null;
      const jsonRetry =
        parsed && typeof parsed === 'object' && 'pdfPersistRetry' in (parsed as object)
          ? ((parsed as { pdfPersistRetry?: import('./pdf/types').PdfPersistRetryPayload })
              .pdfPersistRetry ?? null)
          : null;
      if (jsonMeta) {
        latestSourceMeta = jsonMeta;
        if (jsonRetry) latestPdfPersistRetry = jsonRetry;
        wrappedHandlers.onSourceMeta?.(jsonMeta, jsonRetry);
      }
      const normalized = normalizeMapData(parsed);
      if (!normalized) {
        throw new Error('No se pudo interpretar el mapa generado.');
      }
      finishDone(
        normalized,
        (parsed as ActionMapData).modelUsed,
        latestSourceMeta ?? undefined,
        latestPdfPersistRetry,
        'stream'
      );
      return 'fallback';
    }

    if (!response.body) {
      throw new Error('Streaming no disponible');
    }

    streamEstablished = true;

    // Parallel durable-result poll — stream is progress; GET is source of truth.
    const pollCtl = new AbortController();
    const stopPollOnLocalAbort = () => pollCtl.abort();
    localAbort.signal.addEventListener('abort', stopPollOnLocalAbort, { once: true });

    const parallelPoll = (async () => {
      // Wait until ids exist (body or first `run` event).
      const waitStarted = Date.now();
      while (!ids.mapId || !ids.generationRunId) {
        if (pollCtl.signal.aborted || terminalHandled) return;
        if (Date.now() - waitStarted > 30_000) return;
        await new Promise((r) => setTimeout(r, 200));
      }
      const remainingWall = Math.max(
        5_000,
        GENERATION_WALL_CLOCK_MS - (Date.now() - wallStartedAt)
      );
      try {
        const record = await pollGenerationResultUntilTerminal({
          streamUrl,
          mapId: ids.mapId,
          generationRunId: ids.generationRunId,
          headers,
          signal: pollCtl.signal,
          maxMs: Math.min(GENERATION_RESULT_POLL_MAX_MS * 4, remainingWall),
        });
        if (!record || terminalHandled) return;
        if (applyRecoveredRecord(record)) {
          localAbort.abort();
        }
      } catch {
        // onError may throw; stream/AppSession catch handles terminal errors.
      }
    })();

    const result = await consumeTransformStream(response, wrappedHandlers, {
      signal: localAbort.signal,
      idleTimeoutMs: resolvedIdleTimeoutMs,
      mapId: ids.mapId || undefined,
      runId: ids.generationRunId || undefined,
    });

    if (terminalKind === 'done' || result === 'done') {
      pollCtl.abort();
      await parallelPoll.catch(() => undefined);
      return 'stream';
    }

    if (terminalKind === 'error') {
      pollCtl.abort();
      await parallelPoll.catch(() => undefined);
      throw new Error('No se pudo generar el Núcleo.');
    }

    if (signal?.aborted) {
      pollCtl.abort();
      await parallelPoll.catch(() => undefined);
      throw new DOMException('Aborted', 'AbortError');
    }

    // Stream closed without a usable terminal — keep polling the durable store.
    assertWithinWallClock();
    if (ids.mapId && ids.generationRunId && !terminalHandled) {
      const remaining = Math.max(
        3_000,
        Math.min(
          GENERATION_RESULT_POLL_MAX_MS,
          GENERATION_WALL_CLOCK_MS - (Date.now() - wallStartedAt)
        )
      );
      const record = await pollGenerationResultUntilTerminal({
        streamUrl,
        mapId: ids.mapId,
        generationRunId: ids.generationRunId,
        headers,
        signal,
        maxMs: remaining,
      });
      pollCtl.abort();
      await parallelPoll.catch(() => undefined);
      if (record && applyRecoveredRecord(record)) {
        if (terminalKind === 'done') return 'stream';
      }
      if (terminalKind === 'done') return 'stream';
      if (terminalKind === 'error') {
        throw new Error('No se pudo generar el Núcleo.');
      }
    } else {
      pollCtl.abort();
      await parallelPoll.catch(() => undefined);
    }

    if (terminalKind === 'done') return 'stream';

    if (result === 'aborted' && signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    throw new Error(streamEndedWithoutDoneMessage(result, receivedRenderablePartial));
  } catch (err: unknown) {
    if (signal?.aborted) throw err;
    if (terminalKind === 'done') return 'stream';
    if (terminalKind === 'error') throw err;
    const message = err instanceof Error ? err.message : '';
    if (message && isNonRetryableTransformError(message)) {
      throw err;
    }
    if (!shouldAllowRestFallback()) throw err;

    const fallbackResponse = await fetchWithTimeout(
      fallbackUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(body),
        signal,
      },
      {
        timeoutMs: resolvedFallbackTimeoutMs,
        timeoutMessage: 'La generación está tardando demasiado. Inténtalo de nuevo.',
      }
    );

    const headerMeta = sourceMetaFromHeaders(fallbackResponse.headers);
    if (headerMeta) {
      latestSourceMeta = headerMeta;
      wrappedHandlers.onSourceMeta?.(headerMeta);
    }

    const parsed = (await fallbackResponse.json()) as ActionMapData & {
      error?: string;
      code?: string;
      action?: string;
      isAsk?: boolean;
      answer?: string;
      sourceMeta?: TransformSourceMeta;
      pdfPersistRetry?: import('./pdf/types').PdfPersistRetryPayload;
    };
    if (!fallbackResponse.ok || parsed.error) {
      throwTransformHttpError(fallbackResponse.status, parsed);
    }

    if (isAskLanePayload(parsed)) {
      wrappedHandlers.onAsk?.(parsed);
      return 'ask';
    }

    if (parsed.sourceMeta) {
      latestSourceMeta = parsed.sourceMeta;
      if (parsed.pdfPersistRetry) latestPdfPersistRetry = parsed.pdfPersistRetry;
      wrappedHandlers.onSourceMeta?.(parsed.sourceMeta, parsed.pdfPersistRetry ?? null);
    }

    const normalized = normalizeMapData(parsed);
    if (!normalized) {
      throw new Error('No se pudo interpretar el mapa generado.');
    }

    finishDone(
      normalized,
      parsed.modelUsed,
      latestSourceMeta ?? undefined,
      latestPdfPersistRetry,
      'stream'
    );
    return 'fallback';
  } finally {
    signal?.removeEventListener('abort', onUserAbort);
  }
}

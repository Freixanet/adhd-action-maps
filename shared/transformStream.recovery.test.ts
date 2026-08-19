import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ActionMapData } from './contracts';
import {
  consumeTransformStream,
  fetchTransformWithProgress,
  pollGenerationResultUntilTerminal,
} from './transformStream';
import { buildGenerationResultUrl } from './generationResult';

const baseMap = (title = 'Completo'): ActionMapData =>
  ({
    title,
    coreIdea: 'Idea central',
    coreSupport: 'Soporte',
    tldr: [{ title: 'A', desc: 'B' }],
    steps: [
      {
        id: '1',
        title: 'Paso',
        shortNav: 'Paso',
        purpose: 'P',
        time: '2 min',
        content: [{ type: 'prose', text: 'Texto' }],
      },
    ],
    layer0: {
      what: 'Practicar el foco',
      why: 'Reduce la sobrecarga',
      actions: [
        { id: 'a1', label: 'Acción uno con suficiente texto' },
        { id: 'a2', label: 'Acción dos con suficiente texto' },
        { id: 'a3', label: 'Acción tres con suficiente texto' },
      ],
    },
    intent: 'understand',
  }) as ActionMapData;

function ndjsonResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]!));
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('lost done recovery', () => {
  it('parses a large done event fragmented across chunks', async () => {
    const map = baseMap('Fragmentado');
    const line = `${JSON.stringify({ type: 'done', map })}\n`;
    const mid = Math.floor(line.length / 2);
    const events: string[] = [];
    let doneTitle = '';
    const result = await consumeTransformStream(
      ndjsonResponse([line.slice(0, mid), line.slice(mid)]),
      {
        onDone: (m) => {
          events.push('done');
          doneTitle = m.title;
        },
        onError: (msg) => {
          events.push(`error:${msg}`);
        },
      }
    );
    expect(result).toBe('done');
    expect(events).toEqual(['done']);
    expect(doneTitle).toBe('Fragmentado');
  });

  it('returns incomplete when stream closes before done', async () => {
    const result = await consumeTransformStream(
      ndjsonResponse([`${JSON.stringify({ type: 'stage', stageLabel: 'S04' })}\n`]),
      {
        onDone: () => undefined,
        onError: () => undefined,
      }
    );
    expect(result).toBe('incomplete');
  });

  it('recovers via GET result when stream closes without done', async () => {
    const mapId = 'map-recover-1';
    const generationRunId = 'run-recover-1';
    const final = baseMap('Recuperado');
    let pollCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/api/transform/stream') && init?.method === 'POST') {
          return ndjsonResponse([
            `${JSON.stringify({ type: 'run', mapId, generationRunId })}\n`,
            `${JSON.stringify({ type: 'stage', stageLabel: 'Terminando…' })}\n`,
          ]);
        }
        if (url.includes('/api/transform/result')) {
          pollCount += 1;
          if (pollCount < 2) {
            return new Response(
              JSON.stringify({
                mapId,
                generationRunId,
                status: 'running',
                updatedAt: Date.now(),
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({
              mapId,
              generationRunId,
              status: 'complete',
              map: final,
              model: 'test',
              updatedAt: Date.now(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(`unexpected fetch ${url}`);
      })
    );

    let doneTitle = '';
    let saves = 0;
    await fetchTransformWithProgress({
      streamUrl: 'http://localhost:3000/api/transform/stream',
      fallbackUrl: 'http://localhost:3000/api/transform',
      body: { mapId, generationRunId, text: 'x', type: 'text', intent: 'understand' },
      handlers: {
        onDone: (m) => {
          saves += 1;
          doneTitle = m.title;
        },
        onError: (msg) => {
          throw new Error(msg);
        },
      },
    });

    expect(doneTitle).toBe('Recuperado');
    expect(saves).toBe(1);
    expect(pollCount).toBeGreaterThanOrEqual(2);
  });

  it('ignores a second terminal done after poll recovery (single save)', async () => {
    const mapId = 'map-dual-1';
    const generationRunId = 'run-dual-1';
    const final = baseMap('Unico');
    let saves = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/stream') && init?.method === 'POST') {
          // Never emit done — only run + close.
          return ndjsonResponse([
            `${JSON.stringify({ type: 'run', mapId, generationRunId })}\n`,
          ]);
        }
        if (url.includes('/result')) {
          return new Response(
            JSON.stringify({
              mapId,
              generationRunId,
              status: 'complete',
              map: final,
              updatedAt: Date.now(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(url);
      })
    );

    await fetchTransformWithProgress({
      streamUrl: 'http://localhost:3000/api/transform/stream',
      fallbackUrl: 'http://localhost:3000/api/transform',
      body: { mapId, generationRunId, text: 'x', type: 'text' },
      handlers: {
        onDone: () => {
          saves += 1;
        },
        onError: (msg) => {
          throw new Error(msg);
        },
      },
    });

    expect(saves).toBe(1);
  });

  it('surfaces failed durable status instead of spinning', async () => {
    const mapId = 'map-fail-1';
    const generationRunId = 'run-fail-1';

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/stream') && init?.method === 'POST') {
          return ndjsonResponse([
            `${JSON.stringify({ type: 'run', mapId, generationRunId })}\n`,
          ]);
        }
        if (url.includes('/result')) {
          return new Response(
            JSON.stringify({
              mapId,
              generationRunId,
              status: 'failed',
              error: 'Fallo de proveedor',
              code: 'PROVIDER_ERROR',
              updatedAt: Date.now(),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        throw new Error(url);
      })
    );

    await expect(
      fetchTransformWithProgress({
        streamUrl: 'http://localhost:3000/api/transform/stream',
        fallbackUrl: 'http://localhost:3000/api/transform',
        body: { mapId, generationRunId, text: 'x', type: 'text' },
        handlers: {
          onDone: () => undefined,
          onError: (msg) => {
            throw new Error(msg);
          },
        },
      })
    ).rejects.toThrow(/Fallo de proveedor|No se pudo generar/);
  });
});

describe('pollGenerationResultUntilTerminal', () => {
  it('builds result URL from stream URL', () => {
    expect(
      buildGenerationResultUrl(
        'http://192.168.1.33:3000/api/transform/stream',
        'm1',
        'r1'
      )
    ).toBe('http://192.168.1.33:3000/api/transform/result?mapId=m1&generationRunId=r1');
  });

  it('stops on cancelled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            mapId: 'm',
            generationRunId: 'r',
            status: 'cancelled',
            error: 'Creación cancelada',
            updatedAt: Date.now(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    const record = await pollGenerationResultUntilTerminal({
      streamUrl: 'http://localhost:3000/api/transform/stream',
      mapId: 'm',
      generationRunId: 'r',
      pollMs: 10,
      maxMs: 200,
    });
    expect(record?.status).toBe('cancelled');
  });
});

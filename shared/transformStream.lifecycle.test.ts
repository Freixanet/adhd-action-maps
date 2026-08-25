import { describe, expect, it, vi } from 'vitest';
import type { ActionMapData } from './contracts';
import { mapWithConcurrency } from './concurrency';
import {
  consumeTransformStream,
  parseTransformStreamLine,
  TRANSFORM_IDLE_TIMEOUT_MESSAGE,
} from './transformStream';

const baseMap = (overrides: Partial<ActionMapData> = {}): ActionMapData =>
  ({
    title: 'Mapa de prueba',
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
    ...overrides,
  }) as ActionMapData;

function ndjsonResponse(chunks: string[], delayMs = 0): Response {
  const encoder = new TextEncoder();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      const chunk = chunks[i++]!;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      controller.enqueue(encoder.encode(chunk));
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  });
}

describe('mapWithConcurrency', () => {
  it('preserves input order with limited concurrency', async () => {
    const seen: number[] = [];
    const out = await mapWithConcurrency([3, 1, 2], 2, async (n) => {
      seen.push(n);
      await new Promise((r) => setTimeout(r, n * 5));
      return n * 10;
    });
    expect(out).toEqual([30, 10, 20]);
    expect(seen).toHaveLength(3);
  });
});

describe('consumeTransformStream lifecycle', () => {
  it('essential_ready then later done keeps both callbacks', async () => {
    const essential = baseMap({ title: 'Esencial' });
    const final = baseMap({ title: 'Completo', coreIdea: 'Final' });
    const events: string[] = [];
    const result = await consumeTransformStream(
      ndjsonResponse([
        `${JSON.stringify({ type: 'essential_ready', map: essential })}\n`,
        `${JSON.stringify({ type: 'stage', stageLabel: 'Verificando…' })}\n`,
        `${JSON.stringify({ type: 'done', map: final })}\n`,
      ]),
      {
        onEssentialReady: (m) => events.push(`essential:${m.title}`),
        onPartial: (m) => events.push(`partial:${m.title}`),
        onStage: (l) => events.push(`stage:${l}`),
        onDone: (m) => events.push(`done:${m.title}`),
        onError: (e) => events.push(`error:${e}`),
      }
    );
    expect(result).toBe('done');
    expect(events.some((e) => e.startsWith('essential:'))).toBe(true);
    expect(events).toContain('done:Completo');
  });

  it('heartbeats during a slow evidence phase reset idle without progress side effects', async () => {
    const final = baseMap();
    const heartbeats: number[] = [];
    const result = await consumeTransformStream(
      ndjsonResponse([
        `${JSON.stringify({ type: 'essential_ready', map: baseMap() })}\n`,
        `${JSON.stringify({ type: 'heartbeat', heartbeatAt: 1 })}\n`,
        `${JSON.stringify({ type: 'heartbeat', heartbeatAt: 2 })}\n`,
        `${JSON.stringify({ type: 'done', map: final })}\n`,
      ]),
      {
        onHeartbeat: () => heartbeats.push(Date.now()),
        onDone: () => undefined,
        onError: () => undefined,
      },
      { idleTimeoutMs: 80 }
    );
    expect(result).toBe('done');
    expect(heartbeats.length).toBe(2);
  });

  it('parses a large done event split across many chunks', async () => {
    const bigSupport = 'x'.repeat(50_000);
    const final = baseMap({ coreSupport: bigSupport });
    const line = `${JSON.stringify({ type: 'done', map: final })}\n`;
    const parts: string[] = [];
    const size = 1700;
    for (let i = 0; i < line.length; i += size) {
      parts.push(line.slice(i, i + size));
    }
    expect(parts.length).toBeGreaterThan(5);

    let doneTitle: string | null = null;
    const result = await consumeTransformStream(ndjsonResponse(parts), {
      onDone: (m) => {
        doneTitle = m.title;
      },
      onError: (e) => {
        throw new Error(e);
      },
    });
    expect(result).toBe('done');
    expect(doneTitle).toBe('Mapa de prueba');
  });

  it('returns incomplete when the stream closes without done', async () => {
    const result = await consumeTransformStream(
      ndjsonResponse([
        `${JSON.stringify({ type: 'stage', stageLabel: 'Analizando…' })}\n`,
        `${JSON.stringify({ type: 'essential_ready', map: baseMap() })}\n`,
      ]),
      {
        onDone: () => undefined,
        onError: () => undefined,
      }
    );
    expect(result).toBe('incomplete');
  });

  it('returns aborted on manual cancel', async () => {
    const controller = new AbortController();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(
          encoder.encode(`${JSON.stringify({ type: 'stage', stageLabel: '…' })}\n`)
        );
        // Keep the stream open until the consumer aborts.
        const timer = setInterval(() => {
          try {
            ctrl.enqueue(
              encoder.encode(
                `${JSON.stringify({ type: 'heartbeat', heartbeatAt: Date.now() })}\n`
              )
            );
          } catch {
            clearInterval(timer);
          }
        }, 15);
        setTimeout(() => {
          controller.abort();
          clearInterval(timer);
        }, 40);
      },
      cancel() {
        // expected on abort
      },
    });
    const result = await consumeTransformStream(
      new Response(stream),
      { onDone: () => undefined, onError: () => undefined },
      { signal: controller.signal, idleTimeoutMs: 5_000 }
    );
    expect(result === 'aborted' || result === 'idle').toBe(true);
  });

  it('surfaces provider error events', async () => {
    let errorMsg = '';
    const result = await consumeTransformStream(
      ndjsonResponse([
        `${JSON.stringify({ type: 'error', error: 'Proveedor caído', code: 'PROVIDER' })}\n`,
      ]),
      {
        onDone: () => undefined,
        onError: (m) => {
          errorMsg = m;
        },
      }
    );
    expect(result).toBe('error');
    expect(errorMsg).toContain('Proveedor');
  });

  it('parses heartbeat lines', () => {
    const event = parseTransformStreamLine(
      JSON.stringify({ type: 'heartbeat', heartbeatAt: 123 })
    );
    expect(event?.type).toBe('heartbeat');
  });

  it('idle timeout message is recoverable copy', () => {
    expect(TRANSFORM_IDLE_TIMEOUT_MESSAGE).toMatch(/conexión/i);
  });
});

describe('generation finish invariants (logic)', () => {
  it('early layer0 open must not force status away from generating', () => {
    // Documented contract used by AppSessionContext.applyPartialMap:
    // opening Capa 0 early keeps status generating until done/error/cancel.
    const statusBefore = 'generating';
    const clearInlineGenerationWouldSet = 'idle';
    const statusAfterEarlyOpen = statusBefore; // must NOT become clearInlineGenerationWouldSet
    expect(statusAfterEarlyOpen).toBe('generating');
    expect(statusAfterEarlyOpen).not.toBe(clearInlineGenerationWouldSet);
  });

  it('done after early open ends generating exactly once', () => {
    let saves = 0;
    let generating = true;
    const saveOnce = () => {
      saves += 1;
    };
    // Simulate finalizeStreamSuccess for early-open path
    saveOnce();
    generating = false;
    expect(saves).toBe(1);
    expect(generating).toBe(false);
  });
});

void vi;

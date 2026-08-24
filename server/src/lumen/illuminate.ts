import {
  LUMEN_ACCEPT_CAP,
  LUMEN_ILLUMINATE_SYSTEM,
  LUMEN_SOURCE_CAP,
  LUMEN_STORED_SOURCE_CAP,
  buildLumenUserPrompt,
} from '../../../shared/lumen/prompt';
import { assembleLumenCanvas, tryParseLumenJson } from '../../../shared/lumen/parse';
import { extractLumenMaterial } from '../../../shared/lumen/source';
import { lumenCanvasToMap } from '../../../shared/lumen/toMap';
import type { ActionMapData, TransformRequest } from '../../../shared/contracts';
import type { IngestResult } from '../../../shared/types/chunk';

export type LumenGenerateJson = (args: {
  system: string;
  user: string;
  maxOutputTokens: number;
}) => Promise<{ text: string; model: string }>;

export type RunLumenIlluminate = (args: {
  body: TransformRequest;
  ingest: IngestResult | null;
  isCancelled: () => boolean;
  onStage?: (label: string) => void;
}) => Promise<
  | { ok: true; map: ActionMapData; model: string }
  | { ok: false; status: number; error: string; code: string }
>;

export function createRunLumenIlluminateDep(opts: {
  generateJson: LumenGenerateJson;
}): RunLumenIlluminate {
  return async ({ body, ingest, isCancelled, onStage }) => {
    const { raw, material, sourceKind, sourceTitle } = extractLumenMaterial(body, ingest);
    if (material.length < 2) {
      return {
        ok: false,
        status: 400,
        error: 'Escribe algo que comprender.',
        code: 'LUMEN_EMPTY',
      };
    }
    if (material.length > LUMEN_ACCEPT_CAP) {
      return {
        ok: false,
        status: 400,
        error: 'Ese texto es enorme. Pega las partes clave o un enlace.',
        code: 'LUMEN_TOO_LARGE',
      };
    }

    const clipped = material.length > LUMEN_SOURCE_CAP;
    const excerpt = material.slice(0, LUMEN_SOURCE_CAP);
    const user = buildLumenUserPrompt({
      sourceKind: sourceKind === 'url' ? 'url' : sourceKind === 'text' ? 'text' : 'topic',
      raw,
      excerpt,
      clipped,
    });

    if (isCancelled()) {
      return {
        ok: false,
        status: 499,
        error: 'Creación cancelada',
        code: 'CANCELLED',
      };
    }

    onStage?.('Componiendo la interfaz…');

    let generated: { text: string; model: string };
    try {
      generated = await opts.generateJson({
        system: LUMEN_ILLUMINATE_SYSTEM,
        user,
        maxOutputTokens: 8192,
      });
    } catch {
      return {
        ok: false,
        status: 502,
        error: 'No pude componer la interfaz. Inténtalo de nuevo.',
        code: 'LUMEN_PROVIDER',
      };
    }

    if (isCancelled()) {
      return {
        ok: false,
        status: 499,
        error: 'Creación cancelada',
        code: 'CANCELLED',
      };
    }

    try {
      const doc = tryParseLumenJson(generated.text);
      if (!doc) {
        console.warn('[lumen] parse failed', {
          model: generated.model,
          textLength: generated.text.length,
          preview: generated.text.slice(0, 240),
        });
        return {
          ok: false,
          status: 502,
          error: 'La interfaz no cuajó. Prueba a reformular o usa un ejemplo.',
          code: 'LUMEN_PARSE',
        };
      }
      const canvas = assembleLumenCanvas(doc, {
        source: {
          kind: sourceKind,
          raw: raw.slice(0, LUMEN_STORED_SOURCE_CAP),
          ...(sourceTitle ? { title: sourceTitle } : {}),
        },
      });
      const map = lumenCanvasToMap(canvas, { modelUsed: generated.model });
      return { ok: true, map, model: generated.model };
    } catch (err) {
      console.warn('[lumen] parse threw', {
        model: generated.model,
        textLength: generated.text.length,
        preview: generated.text.slice(0, 240),
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        ok: false,
        status: 502,
        error: 'La interfaz no cuajó. Prueba a reformular o usa un ejemplo.',
        code: 'LUMEN_PARSE',
      };
    }
  };
}

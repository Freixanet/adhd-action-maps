/**
 * Transform-route ingest bridge (ADR-002).
 * Keeps secureFetcher (via urlIngestor) and does not touch llmAccess quota.
 */
import type { TransformRequest } from "../../../shared/contracts";
import {
  OVERVIEW_CHAPTER_THRESHOLD,
  type IngestResult,
} from "../../../shared/types/chunk";
import { isAskLaneInput } from "../ingestors/askLane";
import { labelledChunkText, labelledOverviewSeedText } from "../ingestors/chunkUtils";
import { getIngestor, IngestError } from "../ingestors/factory";
import { validateIngestChunks } from "../ingestors/validateChunks";
import type { IngestorInput } from "../ingestors/types";

export { askResultShell, isAskLaneInput } from "../ingestors/askLane";
export { IngestError };

export type PrepareIngestOutcome =
  | { kind: "ask" }
  | { kind: "passthrough" }
  | { kind: "source"; body: TransformRequest; ingest: IngestResult; overviewOnly: boolean }
  | { kind: "error"; status: number; error: string; code?: string };

function extFromName(name?: string): string | undefined {
  if (!name?.includes(".")) return undefined;
  return name.split(".").pop()?.toLowerCase();
}

function bufferFromBase64(fileData?: string): Buffer | undefined {
  if (!fileData) return undefined;
  try {
    return Buffer.from(fileData, "base64");
  } catch {
    return undefined;
  }
}

function toIngestorInput(body: TransformRequest): IngestorInput {
  const buffer = bufferFromBase64(body.fileData);
  return {
    text: body.text,
    url: body.type === "link" ? body.text : undefined,
    mime: body.mimeType,
    ext: extFromName(body.sourceLabel) || (body.type === "pdf" ? "pdf" : undefined),
    size: buffer?.byteLength,
    buffer,
    fileName: body.sourceLabel,
  };
}

/**
 * Decide ask vs source ingest. YouTube / video / vision fallback stay passthrough
 * so `canRunUnderstandingEngine` routes them to the legacy transcript/multimodal path.
 * PDF uses native text extract only — scanned/empty/encrypted are honest errors
 * (S08: never pretend OCR success via multimodal fallback).
 */
export async function prepareTransformIngest(
  body: TransformRequest,
  opts?: { signal?: AbortSignal }
): Promise<PrepareIngestOutcome> {
  if (isAskLaneInput(body)) {
    return { kind: "ask" };
  }

  if (body.type === "youtube" || body.type === "video") {
    return { kind: "passthrough" };
  }

  // Expanded types without binary/text → still run factory (feature flag / 501).
  const wantsFactory =
    body.type === "link" ||
    body.type === "text" ||
    body.type === "pdf" ||
    body.type === "image" ||
    Boolean(body.fileData) ||
    Boolean(body.mimeType?.includes("epub")) ||
    Boolean(body.mimeType?.includes("wordprocessingml")) ||
    Boolean(body.sourceLabel?.match(/\.epub$/i)) ||
    Boolean(body.sourceLabel?.match(/\.docx$/i));

  if (!wantsFactory) {
    return { kind: "passthrough" };
  }

  try {
    const input = toIngestorInput(body);
    if (opts?.signal) input.signal = opts.signal;

    // Plain text without URL → text ingestor via factory.
    if (body.type === "text" && body.text?.trim() && !input.buffer) {
      try {
        const asUrl = new URL(body.text.trim());
        if (asUrl.protocol === "http:" || asUrl.protocol === "https:") {
          input.url = body.text.trim();
        }
      } catch {
        // plain text
      }
    }

    const ingestor = getIngestor(input);
    const ingest = await ingestor.ingest(input);

    // Image OCR empty → multimodal. PDF scanned/empty must NOT take this path.
    if (ingest.needsVisionFallback && input.buffer?.length && body.type !== "pdf") {
      return { kind: "passthrough" };
    }
    if (body.type === "pdf" && ingest.needsVisionFallback) {
      return {
        kind: "error",
        status: 422,
        error:
          "No se extrajo texto verificable del PDF. Núcleo no presenta OCR como exitoso.",
        code: "PDF_INSUFFICIENT_TEXT",
      };
    }

    validateIngestChunks(ingest);

    const overviewOnly = Boolean(
      ingest.chapters && ingest.chapters.length > OVERVIEW_CHAPTER_THRESHOLD
    );
    const sourceText = overviewOnly
      ? labelledOverviewSeedText(ingest.chunks, ingest.chapters!)
      : labelledChunkText(ingest.chunks);

    const coverageNote =
      body.type === "pdf" && ingest.metadata.pdfCoverageSummary
        ? [
            `LIMITACIONES PDF: ${ingest.metadata.pdfCoverageSummary}`,
            ingest.metadata.pdfLimitations
              ? `Códigos: ${ingest.metadata.pdfLimitations}.`
              : "",
            "No inventes tablas, diagramas ni texto de páginas sin chunk.",
            "",
          ]
            .filter(Boolean)
            .join("\n")
        : "";

    const preface = overviewOnly
      ? [
          "MODO OVERVIEW (libro/documento largo):",
          `Hay ${ingest.chapters!.length} capítulos. Usa solo estas semillas (primer trozo de cada capítulo).`,
          "Genera un Núcleo overview de 3–6 pasos. No inventes citas fuera de este texto.",
          "Los capítulos completos quedan para una futura acción «Profundizar».",
          "Los marcadores [[chunk_…]] son ids de cita: úsalos en references.chunkId. Nunca los escribas en la prosa.",
          coverageNote,
          "",
        ].join("\n")
      : [
          "Los marcadores [[chunk_…]] en la fuente son ids de cita. Solo puedes poner en references.chunkId un id que aparezca entre [[…]].",
          "Si un hecho no tiene fuente en esos chunks, no cites. Nunca escribas los marcadores en la prosa del Núcleo.",
          coverageNote,
          "",
        ].join("\n");

    const nextBody: TransformRequest = {
      ...body,
      type: "text",
      text: `${preface}${sourceText}`,
      fileData: undefined,
      mimeType: undefined,
      sourceLabel:
        ingest.metadata.title ||
        body.sourceLabel ||
        (overviewOnly ? "Overview de libro" : body.sourceLabel),
    };

    return { kind: "source", body: nextBody, ingest, overviewOnly };
  } catch (err) {
    if (err instanceof IngestError) {
      // S08: PDF failures are honest errors — never silent multimodal fallback.
      if (body.type === "pdf") {
        const pdfCode =
          (err as IngestError & { pdfCode?: string }).pdfCode || err.code;
        return {
          kind: "error",
          status: err.httpStatus,
          error: err.message,
          code: pdfCode,
        };
      }
      return {
        kind: "error",
        status: err.httpStatus,
        error: err.message,
        code: err.code,
      };
    }
    if (body.type === "pdf") {
      return {
        kind: "error",
        status: 422,
        error: err instanceof Error ? err.message : "No se pudo ingerir el PDF.",
        code: "PDF_EXTRACT_FAILED",
      };
    }
    return {
      kind: "error",
      status: 422,
      error: err instanceof Error ? err.message : "No se pudo ingerir la fuente.",
      code: "INGEST_FAILED",
    };
  }
}

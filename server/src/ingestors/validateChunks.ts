import type { IngestResult, SourceChunk } from "../../../shared/types/chunk";
import { IngestError } from "./types";

const MAX_CHUNK_CHARS = 800;

export function validateIngestChunks(result: IngestResult): void {
  if (!result.chunks.length) {
    throw new IngestError("Ingestión sin chunks.", "INGEST_FAILED", 422);
  }
  for (const chunk of result.chunks) {
    validateChunk(chunk);
  }
  if (result.chapters?.length) {
    const ids = new Set(result.chunks.map((c) => c.id));
    for (const chapter of result.chapters) {
      for (const id of chapter.chunkIds) {
        if (!ids.has(id)) {
          throw new IngestError(
            `Capítulo "${chapter.title}" referencia chunk desconocido.`,
            "INGEST_FAILED",
            422
          );
        }
      }
    }
  }
}

function validateChunk(chunk: SourceChunk): void {
  if (!chunk.id || !chunk.hash) {
    throw new IngestError("Chunk sin id/hash.", "INGEST_FAILED", 422);
  }
  if (!chunk.text.trim()) {
    throw new IngestError("Chunk vacío.", "INGEST_FAILED", 422);
  }
  if (chunk.text.length > MAX_CHUNK_CHARS) {
    throw new IngestError("Chunk excede el tamaño máximo.", "INGEST_FAILED", 422);
  }
  if (
    typeof chunk.loc.start !== "number" ||
    typeof chunk.loc.end !== "number" ||
    chunk.loc.end < chunk.loc.start
  ) {
    throw new IngestError("Chunk con loc inválida.", "INGEST_FAILED", 422);
  }
}

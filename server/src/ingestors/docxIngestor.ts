import type { IngestResult } from "../../../shared/types/chunk";
import { chunkText, rawHashOf } from "./chunkUtils";
import type { Ingestor, IngestorInput } from "./types";

export const docxIngestor: Ingestor = {
  canHandle(input) {
    const mime = (input.mime || "").toLowerCase();
    const ext = (input.ext || "").toLowerCase();
    return (
      mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    );
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    if (!input.buffer?.length) {
      throw new Error("DOCX vacío.");
    }
    const mammoth = await import("mammoth");
    const extract =
      (mammoth as { default?: { extractRawText: typeof mammoth.extractRawText } }).default
        ?.extractRawText ?? mammoth.extractRawText;
    const result = await extract({ buffer: input.buffer });
    const text = (result.value || "").trim();
    if (!text) {
      throw new Error("No se pudo extraer texto del DOCX.");
    }
    const chunks = chunkText(text);
    return {
      chunks,
      metadata: {
        type: "docx",
        title: input.fileName?.replace(/\.docx$/i, "") || undefined,
      },
      rawHash: rawHashOf(input.buffer),
    };
  },
};

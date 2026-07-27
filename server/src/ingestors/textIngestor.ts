import type { IngestResult } from "../../../shared/types/chunk";
import { chunkText, rawHashOf } from "./chunkUtils";
import type { Ingestor, IngestorInput } from "./types";

export const textIngestor: Ingestor = {
  canHandle(input) {
    if (input.text?.trim()) return true;
    const mime = (input.mime || "").toLowerCase();
    const ext = (input.ext || "").toLowerCase();
    return (
      mime === "text/plain" ||
      mime === "text/markdown" ||
      ext === "txt" ||
      ext === "md" ||
      ext === "markdown"
    );
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    const text =
      input.text?.trim() ||
      (input.buffer ? input.buffer.toString("utf8") : "");
    if (!text.trim()) {
      throw new Error("Texto vacío.");
    }
    const chunks = chunkText(text);
    return {
      chunks,
      metadata: {
        type: "text",
        title: input.fileName?.replace(/\.[^.]+$/, "") || undefined,
      },
      rawHash: rawHashOf(text),
    };
  },
};

import type { IngestResult } from "../../../shared/types/chunk";
import { secureFetch } from "../lib/secureFetcher";
import { chunkText, rawHashOf } from "./chunkUtils";
import type { Ingestor, IngestorInput } from "./types";

export const urlIngestor: Ingestor = {
  canHandle(input) {
    const candidate = (input.text || "").trim();
    try {
      const url = new URL(candidate);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    const rawUrl = (input.url || input.text || "").trim();
    const doc = await secureFetch(rawUrl);
    const chunks = chunkText(doc.text, {
      locFor: () => ({}),
    });
    return {
      chunks,
      metadata: {
        type: "url",
        title: doc.title || undefined,
      },
      rawHash: rawHashOf(doc.text),
    };
  },
};

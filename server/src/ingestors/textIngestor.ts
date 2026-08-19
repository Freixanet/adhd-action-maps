import type { IngestResult } from "../../../shared/types/chunk";
import { canonicalizePastedText, validatePastedText } from "../../../shared/pastedText";
import { hashCanonicalPastedText } from "../../../shared/pastedTextHash";
import { chunkText } from "./chunkUtils";
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
    const raw =
      input.text ||
      (input.buffer ? input.buffer.toString("utf8") : "");
    const validation = validatePastedText(raw);
    if (validation.ok === false) {
      if (validation.code === "TEXT_EMPTY") {
        throw new Error("Texto vacío.");
      }
      if (validation.code === "TEXT_TOO_LARGE") {
        throw Object.assign(new Error("Texto demasiado largo."), {
          code: "TEXT_TOO_LARGE",
        });
      }
      throw new Error("Texto no válido.");
    }
    const canonical = validation.canonical;
    // chunkText must not re-canonicalize into a different string — pass already canonical.
    const chunks = chunkText(canonical, { alreadyCanonical: true });
    return {
      chunks,
      metadata: {
        type: "text",
        title: input.fileName?.replace(/\.[^.]+$/, "") || undefined,
      },
      rawHash: hashCanonicalPastedText(canonical),
    };
  },
};

/** Exposed for tests — same path as ingest. */
export function canonicalizeForTextIngest(input: string): string {
  return canonicalizePastedText(input);
}

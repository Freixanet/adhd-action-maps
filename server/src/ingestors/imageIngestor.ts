import type { IngestResult } from "../../../shared/types/chunk";
import { chunkText, md5Short, rawHashOf } from "./chunkUtils";
import type { Ingestor, IngestorInput } from "./types";

/**
 * Hybrid image ingest:
 * Layer A — OCR verbatim (citable).
 * Layer B — vision caption placeholder (not citable; empty until Gemini vision wired).
 */
export const imageIngestor: Ingestor = {
  canHandle(input) {
    const mime = (input.mime || "").toLowerCase();
    const ext = (input.ext || "").toLowerCase();
    if (mime.startsWith("image/")) return true;
    return ["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext);
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    if (!input.buffer?.length) {
      throw new Error("Imagen vacía.");
    }

    const imageId = md5Short(input.buffer);
    const tesseract = await import("tesseract.js");
    const recognize =
      (tesseract as { recognize?: typeof import("tesseract.js").recognize }).recognize ??
      (tesseract as { default?: { recognize: typeof import("tesseract.js").recognize } }).default
        ?.recognize;
    if (!recognize) {
      throw new Error("tesseract.recognize no disponible.");
    }

    let ocrText = "";
    try {
      const result = await recognize(input.buffer, "spa+eng", {
        logger: () => undefined,
      });
      ocrText = (result.data?.text || "").trim();
    } catch (err) {
      console.warn(
        "[imageIngestor] OCR failed:",
        err instanceof Error ? err.message : err
      );
    }

    // Layer B placeholder — Gemini vision caption later (not citable).
    const caption = "";
    void caption;

    if (!ocrText) {
      const placeholder = "[Imagen sin texto detectable: diagrama]";
      const hash = md5Short(`${imageId}:${placeholder}`);
      return {
        chunks: [
          {
            id: `chunk_${hash}`,
            text: placeholder,
            loc: { imageId, start: 0, end: placeholder.length },
            hash,
          },
        ],
        metadata: { type: "image", title: input.fileName },
        rawHash: rawHashOf(input.buffer),
      };
    }

    const chunks = chunkText(ocrText, {
      idPrefix: `img:${imageId}`,
      locFor: () => ({ imageId }),
    }).map((chunk) => {
      const hash = md5Short(`${imageId}:${chunk.loc.start}:${chunk.text}`);
      return {
        ...chunk,
        id: `chunk_${hash}`,
        hash,
        loc: { ...chunk.loc, imageId },
      };
    });

    return {
      chunks,
      metadata: { type: "image", title: input.fileName },
      rawHash: rawHashOf(input.buffer),
    };
  },
};

import type { IngestResult } from "../../../shared/types/chunk";
import { chunkText, md5Short, rawHashOf } from "./chunkUtils";
import type { Ingestor, IngestorInput } from "./types";

/**
 * Formats Leptonica can decode. Anything else (notably HEIC from iOS) makes the
 * tesseract worker fail with "pixReadStream: Unknown format", so we skip OCR.
 */
function isOcrDecodable(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const startsWith = (...bytes: number[]) =>
    bytes.every((byte, index) => buffer[index] === byte);

  if (startsWith(0xff, 0xd8, 0xff)) return true; // JPEG
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return true; // PNG
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return true; // GIF
  if (startsWith(0x42, 0x4d)) return true; // BMP
  if (startsWith(0x49, 0x49, 0x2a, 0x00)) return true; // TIFF LE
  if (startsWith(0x4d, 0x4d, 0x00, 0x2a)) return true; // TIFF BE
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return true;
  }
  return false;
}

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
    if (!isOcrDecodable(input.buffer)) {
      console.warn("[imageIngestor] OCR skipped: format not decodable by Leptonica.");
    } else {
      try {
        const result = await recognize(input.buffer, "spa+eng", {
          logger: () => undefined,
          // Without an errorHandler tesseract rethrows worker failures outside the
          // promise chain (createWorker.js:217), which kills the whole process.
          errorHandler: (err: unknown) => {
            console.warn("[imageIngestor] OCR worker error:", err);
          },
        });
        ocrText = (result.data?.text || "").trim();
      } catch (err) {
        console.warn(
          "[imageIngestor] OCR failed:",
          err instanceof Error ? err.message : err
        );
      }
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
        needsVisionFallback: true,
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

import type { IngestResult, SourceChunk } from "../../../shared/types/chunk";
import { buildChapterMeta, chunkText, md5Short, rawHashOf } from "./chunkUtils";
import { IngestError, type Ingestor, type IngestorInput } from "./types";

type PdfTextResult = {
  text?: string;
  total?: number;
  pages?: Array<{ text?: string; num?: number }>;
};

type PdfInfoResult = {
  info?: { Title?: string };
  total?: number;
};

async function extractPdf(buffer: Buffer): Promise<{
  text: string;
  pages: string[];
  title?: string;
}> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = (await parser.getText()) as PdfTextResult;
    let info: PdfInfoResult | undefined;
    try {
      info = (await parser.getInfo()) as PdfInfoResult;
    } catch {
      info = undefined;
    }

    const pageTexts =
      Array.isArray(textResult.pages) && textResult.pages.length
        ? textResult.pages.map((p) => (p.text || "").trim())
        : (textResult.text || "")
            .split("\f")
            .map((p) => p.trim());

    const text =
      pageTexts.filter(Boolean).join("\n\f\n").trim() ||
      (textResult.text || "").trim();
    return {
      text,
      pages: pageTexts.length ? pageTexts : text ? [text] : [],
      title: info?.info?.Title,
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

/**
 * Local PDF text extraction with page hints when form-feed markers exist.
 * Legacy Gemini multimodal path remains for uploads when this path is unused.
 */
export const pdfIngestor: Ingestor = {
  canHandle(input) {
    const mime = (input.mime || "").toLowerCase();
    const ext = (input.ext || "").toLowerCase();
    return mime === "application/pdf" || ext === "pdf";
  },

  async ingest(input: IngestorInput): Promise<IngestResult> {
    if (!input.buffer?.length) {
      throw new IngestError("PDF vacío.", "INGEST_FAILED", 422);
    }

    let extracted: { text: string; pages: string[]; title?: string };
    try {
      extracted = await extractPdf(input.buffer);
    } catch (err) {
      throw new IngestError(
        err instanceof Error ? err.message : "No se pudo extraer texto del PDF.",
        "INGEST_FAILED",
        422
      );
    }

    if (!extracted.text) {
      throw new IngestError("No se pudo extraer texto del PDF.", "INGEST_FAILED", 422);
    }

    const pages = extracted.pages.filter(Boolean).length
      ? extracted.pages
      : [extracted.text];
    const chunks: SourceChunk[] = [];
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
      const pageText = pages[pageIndex]!.trim();
      if (!pageText) continue;
      const pageChunks = chunkText(pageText, {
        idPrefix: `pdf-p${pageIndex}`,
        locFor: () => ({ page: pageIndex + 1 }),
      });
      for (const chunk of pageChunks) {
        const hash = md5Short(`pdf:${pageIndex}:${chunk.loc.start}:${chunk.text}`);
        chunks.push({
          ...chunk,
          id: `chunk_${hash}`,
          hash,
          loc: { ...chunk.loc, page: pageIndex + 1 },
        });
      }
    }

    if (!chunks.length) {
      throw new IngestError("No se pudo extraer texto del PDF.", "INGEST_FAILED", 422);
    }

    return {
      chunks,
      chapters:
        pages.filter(Boolean).length > 1
          ? pages.map((_, i) =>
              buildChapterMeta(
                `Página ${i + 1}`,
                i,
                chunks.filter((c) => c.loc.page === i + 1)
              )
            )
          : undefined,
      metadata: {
        type: "pdf",
        title:
          extracted.title || input.fileName?.replace(/\.pdf$/i, "") || undefined,
      },
      rawHash: rawHashOf(input.buffer),
    };
  },
};

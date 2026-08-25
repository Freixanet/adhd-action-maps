import { MAX_BOOK_BYTES, MAX_IMAGE_BYTES } from "../../../shared/types/chunk";
import { docxIngestor } from "./docxIngestor";
import { epubIngestor } from "./epubIngestor";
import { imageIngestor } from "./imageIngestor";
import { pdfIngestor } from "./pdfIngestor";
import { textIngestor } from "./textIngestor";
import { urlIngestor } from "./urlIngestor";
import {
  expandedInputsEnabled,
  IngestError,
  type Ingestor,
  type IngestorInput,
} from "./types";

const EXPANDED = [epubIngestor, docxIngestor, imageIngestor] as const;
const CORE = [pdfIngestor, urlIngestor, textIngestor] as const;

function extOf(fileName?: string, mime?: string): string | undefined {
  if (fileName?.includes(".")) {
    return fileName.split(".").pop()?.toLowerCase();
  }
  if (mime?.includes("epub")) return "epub";
  if (mime === "application/pdf") return "pdf";
  if (mime?.includes("wordprocessingml")) return "docx";
  if (mime?.startsWith("image/")) return mime.split("/")[1];
  return undefined;
}

function isExpandedKind(input: { mime?: string; ext?: string }): boolean {
  return EXPANDED.some((ingestor) =>
    ingestor.canHandle({ mime: input.mime, ext: input.ext })
  );
}

function isImageKind(input: { mime?: string; ext?: string }): boolean {
  return imageIngestor.canHandle({ mime: input.mime, ext: input.ext });
}

export function getIngestor(input: IngestorInput): Ingestor {
  const mime = input.mime;
  const ext = input.ext || extOf(input.fileName, mime);
  const size = input.size ?? input.buffer?.byteLength ?? 0;
  const probe = { mime, ext, size, text: input.text };

  if (isExpandedKind(probe) && !expandedInputsEnabled()) {
    throw new IngestError(
      "Este tipo de fuente aún no está habilitado.",
      "FEATURE_DISABLED",
      501
    );
  }

  if (isImageKind(probe) && size > MAX_IMAGE_BYTES) {
    throw new IngestError(
      "La imagen supera el límite de 10 MB.",
      "FILE_TOO_LARGE",
      413
    );
  }

  if (
    (pdfIngestor.canHandle(probe) ||
      epubIngestor.canHandle(probe) ||
      docxIngestor.canHandle(probe)) &&
    size > MAX_BOOK_BYTES
  ) {
    throw new IngestError(
      "El archivo supera el límite de 20 MB.",
      "FILE_TOO_LARGE",
      413
    );
  }

  const ordered: Ingestor[] = [
    ...(expandedInputsEnabled() ? EXPANDED : []),
    ...CORE,
  ];

  // Prefer URL when text looks like a URL and no binary buffer.
  if (!input.buffer && (input.url || input.text)) {
    const candidate = (input.url || input.text || "").trim();
    if (
      /^https?:\/\//i.test(candidate) &&
      urlIngestor.canHandle({ ...probe, text: candidate })
    ) {
      return urlIngestor;
    }
  }

  for (const ingestor of ordered) {
    if (ingestor.canHandle(probe)) return ingestor;
  }

  throw new IngestError(
    "Tipo de fuente no soportado.",
    "UNSUPPORTED_TYPE",
    400
  );
}

export {
  textIngestor,
  urlIngestor,
  pdfIngestor,
  epubIngestor,
  imageIngestor,
  docxIngestor,
  expandedInputsEnabled,
  IngestError,
};

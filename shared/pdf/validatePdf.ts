/**
 * Fail-closed PDF validation: magic bytes, size, MIME honesty, encrypt sniff.
 */

import {
  MAX_PDF_BYTES,
  MAX_PDF_PAGES,
  PDF_VALIDATOR_VERSION,
} from './versions';
import type { PdfErrorCode, PdfValidationResult } from './types';

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

export function sniffPdfMagic(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  // Allow optional BOM/whitespace before %PDF- (rare but real).
  const head = buffer.subarray(0, Math.min(1024, buffer.length));
  const idx = head.indexOf(PDF_MAGIC);
  return idx >= 0 && idx < 1024;
}

export function readPdfVersionToken(buffer: Buffer): string | null {
  const head = buffer.subarray(0, Math.min(32, buffer.length)).toString('latin1');
  const m = head.match(/%PDF-(\d\.\d)/);
  return m?.[1] ?? null;
}

/**
 * Heuristic: /Encrypt dictionary present in the file.
 * False positives possible on document text mentioning Encrypt; bounded search
 * of trailer-ish regions + full scan capped for small files.
 */
export function looksEncryptedPdf(buffer: Buffer): boolean {
  const sample =
    buffer.length <= 512 * 1024
      ? buffer
      : Buffer.concat([
          buffer.subarray(0, 256 * 1024),
          buffer.subarray(buffer.length - Math.min(256 * 1024, buffer.length)),
        ]);
  const asLatin = sample.toString('latin1');
  // PDF encrypt dict typically `/Encrypt <<` or `/Encrypt N 0 R`
  return /\/Encrypt[\s\r\n]*(\d+\s+\d+\s+R|<<)/.test(asLatin);
}

export function normalizeDeclaredMime(mime: string | null | undefined): string | null {
  if (!mime || typeof mime !== 'string') return null;
  const base = mime.split(';')[0]!.trim().toLowerCase();
  return base || null;
}

export function validatePdfBuffer(args: {
  buffer: Buffer;
  declaredMime?: string | null;
  fileName?: string | null;
  maxBytes?: number;
}): PdfValidationResult {
  const maxBytes = args.maxBytes ?? MAX_PDF_BYTES;
  const buf = args.buffer;
  if (!buf || buf.length === 0) {
    return {
      ok: false,
      code: 'PDF_EMPTY',
      message: 'El archivo PDF está vacío.',
    };
  }
  if (buf.length > maxBytes) {
    return {
      ok: false,
      code: 'PDF_TOO_LARGE',
      message: `El PDF supera el límite de ${Math.floor(maxBytes / (1024 * 1024))} MB.`,
    };
  }
  if (!sniffPdfMagic(buf)) {
    return {
      ok: false,
      code: 'PDF_INVALID_SIGNATURE',
      message: 'La firma del archivo no es PDF (%PDF-).',
    };
  }

  const declared = normalizeDeclaredMime(args.declaredMime);
  const name = (args.fileName || '').toLowerCase();
  const extPdf = name.endsWith('.pdf');
  if (declared && declared !== 'application/pdf' && declared !== 'application/x-pdf') {
    // Declared MIME is not PDF but bytes are — mismatch (possible rename attack).
    return {
      ok: false,
      code: 'PDF_MIME_MISMATCH',
      message: `MIME declarado «${declared}» no coincide con un PDF real.`,
    };
  }
  // Extension lies but magic is PDF: accept with sniffed mime (extension alone is not authority).
  void extPdf;
  void PDF_VALIDATOR_VERSION;

  if (looksEncryptedPdf(buf)) {
    return {
      ok: false,
      code: 'PDF_ENCRYPTED',
      message: 'Este PDF está cifrado o protegido con contraseña. Núcleo no puede extraer su texto.',
    };
  }

  return {
    ok: true,
    byteLength: buf.length,
    declaredMime: declared,
    sniffedMime: 'application/pdf',
    pdfVersion: readPdfVersionToken(buf),
    looksEncrypted: false,
  };
}

export function pdfErrorHttpStatus(code: PdfErrorCode): number {
  switch (code) {
    case 'PDF_TOO_LARGE':
    case 'PDF_TOO_MANY_PAGES':
      return 413;
    case 'PDF_CANCELLED':
      return 499;
    default:
      return 422;
  }
}

export { MAX_PDF_PAGES };

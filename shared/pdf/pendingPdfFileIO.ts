/**
 * Platform file IO for durable pending PDF bytes (not base64 in KV storage).
 */

export type PendingPdfFileIO = {
  /** Write bytes; returns durable URI or throws. */
  write: (args: {
    userId: string;
    sourceRequestId: string;
    bytes: Uint8Array;
  }) => Promise<string>;
  read: (uri: string) => Promise<Uint8Array>;
  remove: (uri: string) => Promise<void>;
};

let io: PendingPdfFileIO | null = null;

export function configurePendingPdfFileIO(next: PendingPdfFileIO | null): void {
  io = next;
}

export function getPendingPdfFileIO(): PendingPdfFileIO | null {
  return io;
}

export async function writePendingPdfFile(args: {
  userId: string;
  sourceRequestId: string;
  bytes: Uint8Array;
}): Promise<{ ok: true; uri: string } | { ok: false; error: string }> {
  if (!io) return { ok: false, error: 'pending_pdf_file_io_unconfigured' };
  try {
    const uri = await io.write(args);
    if (!uri) return { ok: false, error: 'pending_pdf_write_empty_uri' };
    return { ok: true, uri };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'pending_pdf_write_failed',
    };
  }
}

export async function readPendingPdfFile(
  uri: string
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  if (!io) return { ok: false, error: 'pending_pdf_file_io_unconfigured' };
  try {
    const bytes = await io.read(uri);
    return { ok: true, bytes };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'pending_pdf_read_failed',
    };
  }
}

export async function removePendingPdfFile(uri: string): Promise<void> {
  if (!io || !uri) return;
  try {
    await io.remove(uri);
  } catch {
    /* ignore */
  }
}

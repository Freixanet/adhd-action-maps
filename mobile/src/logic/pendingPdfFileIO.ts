/**
 * Mobile durable IO for pending PDF bytes (documentDirectory).
 */

import {
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
} from 'expo-file-system/legacy';
import { configurePendingPdfFileIO } from '@shared/pdf/pendingPdfFileIO';

function dirForUser(userId: string): string {
  const root = documentDirectory || '';
  return `${root}nucleo-pending-pdf/${userId.trim()}/`;
}

function bytesToBase64(bytes: Uint8Array): string {
  // Avoid huge spreads — chunk encode.
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(binary);
  return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

let configured = false;

export function ensureMobilePendingPdfFileIO(): void {
  if (configured) return;
  configurePendingPdfFileIO({
    write: async ({ userId, sourceRequestId, bytes }) => {
      const dir = dirForUser(userId);
      const info = await getInfoAsync(dir);
      if (!info.exists) {
        await makeDirectoryAsync(dir, { intermediates: true });
      }
      const uri = `${dir}${sourceRequestId}.pdf`;
      await writeAsStringAsync(uri, bytesToBase64(bytes), {
        encoding: EncodingType.Base64,
      });
      return uri;
    },
    read: async (uri) => {
      const b64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
      return base64ToBytes(b64);
    },
    remove: async (uri) => {
      await deleteAsync(uri, { idempotent: true });
    },
  });
  configured = true;
}

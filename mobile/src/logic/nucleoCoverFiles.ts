import {
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

const COVER_DIR = `${documentDirectory ?? ''}nucleo-covers/`;

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'jpg';
}

export function nucleoCoverFileUri(entryId: string, mimeType: string): string {
  const safeId = entryId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${COVER_DIR}${safeId}.${extensionForMime(mimeType)}`;
}

export async function writeNucleoCoverFile(
  entryId: string,
  mimeType: string,
  base64: string
): Promise<string> {
  await makeDirectoryAsync(COVER_DIR, { intermediates: true });
  const uri = nucleoCoverFileUri(entryId, mimeType);
  await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
  return uri;
}

export async function nucleoCoverFileExists(uri: string | null | undefined): Promise<boolean> {
  if (!uri) return false;
  const info = await getInfoAsync(uri);
  return Boolean(info.exists);
}

export async function readNucleoCoverSvgXml(uri: string): Promise<string | null> {
  try {
    const exists = await nucleoCoverFileExists(uri);
    if (!exists) return null;
    const xml = await readAsStringAsync(uri, { encoding: EncodingType.UTF8 });
    return xml?.includes('<svg') ? xml : null;
  } catch {
    return null;
  }
}

export async function readNucleoCoverDataUri(
  uri: string,
  mimeType: string
): Promise<string | null> {
  try {
    const exists = await nucleoCoverFileExists(uri);
    if (!exists) return null;
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    if (!base64) return null;
    return `data:${mimeType};base64,${base64}`;
  } catch {
    return null;
  }
}

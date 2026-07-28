import * as DocumentPicker from 'expo-document-picker';
import {
  getInfoAsync,
  readAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
// NOTE: do NOT use expo-image-manipulator here. Its native renderAsync
// throws "Image context has been lost" on large iOS photos (HEIC/8MB+).

export type UploadedFile = {
  name: string;
  size: number;
  isPdf?: boolean;
  isImage?: boolean;
  isVideo?: boolean;
  isEpub?: boolean;
  isDocx?: boolean;
  fileData?: string;
  mimeType?: string;
  previewUri?: string;
};

/** Photos / camera (ADR-002 image limit). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** PDF / EPUB / DOCX / text docs. */
export const MAX_BOOK_BYTES = 20 * 1024 * 1024;
/** @deprecated Prefer MAX_IMAGE_BYTES / MAX_BOOK_BYTES; kept for older call sites. */
export const MAX_UPLOAD_BYTES = MAX_BOOK_BYTES;

export const MAX_UPLOAD_SIZE_MESSAGE =
  'Máx 10MB para fotos, 20MB para libros';
export const LOCAL_FILE_READ_ERROR_MESSAGE =
  'No se pudo leer el archivo en el dispositivo. Prueba con otro archivo.';
export const UNSUPPORTED_IMAGE_MESSAGE = 'El archivo seleccionado no es una imagen.';
export const UNSUPPORTED_FILE_MESSAGE =
  'Formato no soportado. Usa PDF, EPUB, DOCX, TXT o Markdown.';

/** Picker compresses on iOS when quality < 1 — no ImageManipulator (renderAsync OOM). */
const IMAGE_COMPRESS = 0.7;

const IMAGE_PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: IMAGE_COMPRESS,
  allowsEditing: false,
  exif: false,
};

function assertImageSize(size: number | undefined | null): void {
  if (size != null && size > MAX_IMAGE_BYTES) {
    throw new Error(MAX_UPLOAD_SIZE_MESSAGE);
  }
}

function assertBookSize(size: number | undefined | null): void {
  if (size != null && size > MAX_BOOK_BYTES) {
    throw new Error(MAX_UPLOAD_SIZE_MESSAGE);
  }
}

async function resolveLocalFileSize(
  uri: string,
  fallback?: number | null
): Promise<number | null> {
  try {
    const info = await getInfoAsync(uri);
    if (info.exists && typeof info.size === 'number') return info.size;
  } catch {
    // fall through
  }
  return fallback ?? null;
}

/**
 * Safe image path (no expo-image-manipulator):
 * Picker quality 0.7 re-encodes on device; we only size-check + read base64 for upload.
 * Preview uses the local file URI — never a manipulator renderAsync context.
 */
async function processImageAsset(
  asset: ImagePicker.ImagePickerAsset
): Promise<UploadedFile> {
  const size = await resolveLocalFileSize(asset.uri, asset.fileSize);
  assertImageSize(size);

  if (!asset.uri) {
    throw new Error('No se pudo procesar la imagen.');
  }

  let base64: string;
  try {
    base64 = await readAsStringAsync(asset.uri, {
      encoding: EncodingType.Base64,
    });
  } catch {
    throw new Error(LOCAL_FILE_READ_ERROR_MESSAGE);
  }
  if (!base64) {
    throw new Error('No se pudo procesar la imagen.');
  }

  const uploadBytes = Math.round(base64.length * 0.75);
  assertImageSize(uploadBytes);

  const mime =
    asset.mimeType && asset.mimeType.startsWith('image/') && asset.mimeType !== 'image/heic'
      ? asset.mimeType
      : 'image/jpeg';

  return {
    name: asset.fileName || 'Imagen.jpg',
    size: size ?? uploadBytes,
    isImage: true,
    fileData: base64,
    mimeType: mime,
    previewUri: asset.uri,
  };
}

async function readBinaryAttachment(params: {
  uri: string;
  name: string;
  size: number | undefined | null;
  mimeType: string;
  flags: Pick<UploadedFile, 'isPdf' | 'isEpub' | 'isDocx' | 'isVideo'>;
  previewUri?: string;
  maxBytes?: number;
}): Promise<UploadedFile> {
  const { uri, name, size, mimeType, flags, previewUri, maxBytes = MAX_BOOK_BYTES } =
    params;
  if (size != null && size > maxBytes) {
    throw new Error(MAX_UPLOAD_SIZE_MESSAGE);
  }

  try {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    const resolvedSize = size ?? Math.round(base64.length * 0.75);
    if (resolvedSize > maxBytes) {
      throw new Error(MAX_UPLOAD_SIZE_MESSAGE);
    }
    return {
      name,
      size: resolvedSize,
      fileData: base64,
      mimeType,
      previewUri,
      ...flags,
    };
  } catch (err) {
    if (err instanceof Error && err.message === MAX_UPLOAD_SIZE_MESSAGE) throw err;
    throw new Error(LOCAL_FILE_READ_ERROR_MESSAGE);
  }
}

async function readPdfAttachment(
  uri: string,
  name: string,
  size: number | undefined | null
): Promise<UploadedFile> {
  return readBinaryAttachment({
    uri,
    name,
    size,
    mimeType: 'application/pdf',
    flags: { isPdf: true },
  });
}

async function readEpubAttachment(
  uri: string,
  name: string,
  size: number | undefined | null
): Promise<UploadedFile> {
  return readBinaryAttachment({
    uri,
    name,
    size,
    mimeType: 'application/epub+zip',
    flags: { isEpub: true },
  });
}

async function readDocxAttachment(
  uri: string,
  name: string,
  size: number | undefined | null
): Promise<UploadedFile> {
  return readBinaryAttachment({
    uri,
    name,
    size,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    flags: { isDocx: true },
  });
}

async function readVideoAttachment(
  uri: string,
  name: string,
  size: number | undefined | null,
  mimeType?: string | null,
  previewUri?: string
): Promise<UploadedFile> {
  return readBinaryAttachment({
    uri,
    name,
    size,
    mimeType: mimeType || 'video/mp4',
    flags: { isVideo: true },
    previewUri,
  });
}

export type PickFileAttachmentResult =
  | UploadedFile
  | { file: UploadedFile; textContent: string };

const FILE_PICKER_TYPES = [
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
] as const;

export function isBookAttachment(file: UploadedFile | null | undefined): boolean {
  if (!file) return false;
  return Boolean(file.isPdf || file.isEpub || file.isDocx);
}

export async function pickFileAttachment(): Promise<PickFileAttachmentResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...FILE_PICKER_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const name = asset.name || 'Archivo';
  const mimeType = asset.mimeType || '';
  const lowerName = name.toLowerCase();

  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return readPdfAttachment(asset.uri, name, asset.size);
  }

  if (
    mimeType === 'application/epub+zip' ||
    mimeType === 'application/epub' ||
    lowerName.endsWith('.epub')
  ) {
    return readEpubAttachment(asset.uri, name, asset.size);
  }

  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  ) {
    return readDocxAttachment(asset.uri, name, asset.size);
  }

  if (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md') ||
    lowerName.endsWith('.markdown')
  ) {
    assertBookSize(asset.size);
    try {
      const textContent = await readAsStringAsync(asset.uri, {
        encoding: EncodingType.UTF8,
      });
      return {
        file: {
          name,
          size: asset.size ?? textContent.length,
          mimeType: mimeType || 'text/plain',
        },
        textContent,
      };
    } catch {
      throw new Error(LOCAL_FILE_READ_ERROR_MESSAGE);
    }
  }

  throw new Error(UNSUPPORTED_FILE_MESSAGE);
}

export async function pickPdfAttachment(): Promise<UploadedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const name = asset.name || 'Documento.pdf';
  const isPdf =
    asset.mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    throw new Error('Solo se admiten archivos PDF.');
  }

  return readPdfAttachment(asset.uri, name, asset.size);
}

export async function pickImageFromLibrary(): Promise<UploadedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos acceso a la galería para adjuntar imágenes.');
  }

  const result = await ImagePicker.launchImageLibraryAsync(IMAGE_PICKER_OPTIONS);

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
    throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  }

  return processImageAsset(asset);
}

export async function pickImageFromCamera(): Promise<UploadedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos acceso a la cámara para tomar una foto.');
  }

  const result = await ImagePicker.launchCameraAsync(IMAGE_PICKER_OPTIONS);

  if (result.canceled || !result.assets?.[0]) return null;

  return processImageAsset(result.assets[0]);
}

export async function pickVideoFromLibrary(): Promise<UploadedFile | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos acceso a la galería para adjuntar videos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  assertBookSize(asset.fileSize);

  return readVideoAttachment(
    asset.uri,
    asset.fileName || 'Video',
    asset.fileSize,
    asset.mimeType || 'video/mp4',
    asset.uri
  );
}

import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

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

const IMAGE_MAX_DIMENSION = 1024;
const CAMERA_COMPRESS = 0.7;
const LIBRARY_COMPRESS = 0.82;

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

async function processImageAsset(
  asset: ImagePicker.ImagePickerAsset,
  compress: number
): Promise<UploadedFile> {
  assertImageSize(asset.fileSize);

  const width = asset.width ?? IMAGE_MAX_DIMENSION;
  const height = asset.height ?? IMAGE_MAX_DIMENSION;
  const maxDim = Math.max(width, height);
  const actions =
    maxDim > IMAGE_MAX_DIMENSION
      ? [
          {
            resize: {
              width: Math.round(width * (IMAGE_MAX_DIMENSION / maxDim)),
              height: Math.round(height * (IMAGE_MAX_DIMENSION / maxDim)),
            },
          },
        ]
      : [];

  const processed = await manipulateAsync(asset.uri, actions, {
    compress,
    format: SaveFormat.JPEG,
    base64: true,
  });

  const base64 = processed.base64;
  if (!base64) {
    throw new Error('No se pudo procesar la imagen.');
  }

  const size = asset.fileSize ?? Math.round(base64.length * 0.75);
  assertImageSize(size);

  return {
    name: asset.fileName || 'Imagen.jpg',
    size,
    isImage: true,
    fileData: base64,
    mimeType: 'image/jpeg',
    previewUri: processed.uri,
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
  const { uri, name, size, mimeType, flags, previewUri, maxBytes = MAX_BOOK_BYTES } = params;
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

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
    throw new Error(UNSUPPORTED_IMAGE_MESSAGE);
  }

  return processImageAsset(asset, LIBRARY_COMPRESS);
}

export async function pickImageFromCamera(): Promise<UploadedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos acceso a la cámara para tomar una foto.');
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: CAMERA_COMPRESS,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  return processImageAsset(result.assets[0], CAMERA_COMPRESS);
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

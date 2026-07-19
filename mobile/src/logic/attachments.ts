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
  fileData?: string;
  mimeType?: string;
  previewUri?: string;
};

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_SIZE_MESSAGE =
  'El archivo supera el límite de 15 MB. Prueba con un archivo más pequeño.';
export const LOCAL_FILE_READ_ERROR_MESSAGE =
  'No se pudo leer el archivo en el dispositivo. Prueba con otro archivo.';
export const UNSUPPORTED_IMAGE_MESSAGE = 'El archivo seleccionado no es una imagen.';

const IMAGE_MAX_DIMENSION = 1024;

function assertFileSize(size: number | undefined | null): void {
  if (size != null && size > MAX_UPLOAD_BYTES) {
    throw new Error(MAX_UPLOAD_SIZE_MESSAGE);
  }
}

async function processImageAsset(
  asset: ImagePicker.ImagePickerAsset
): Promise<UploadedFile> {
  assertFileSize(asset.fileSize);

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
    compress: 0.82,
    format: SaveFormat.JPEG,
    base64: true,
  });

  const base64 = processed.base64;
  if (!base64) {
    throw new Error('No se pudo procesar la imagen.');
  }

  return {
    name: asset.fileName || 'Imagen',
    size: asset.fileSize ?? Math.round(base64.length * 0.75),
    isImage: true,
    fileData: base64,
    mimeType: 'image/jpeg',
    previewUri: processed.uri,
  };
}

async function readPdfAttachment(
  uri: string,
  name: string,
  size: number | undefined | null
): Promise<UploadedFile> {
  assertFileSize(size);

  try {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    return {
      name,
      size: size ?? Math.round(base64.length * 0.75),
      isPdf: true,
      fileData: base64,
      mimeType: 'application/pdf',
    };
  } catch {
    throw new Error(LOCAL_FILE_READ_ERROR_MESSAGE);
  }
}

async function readVideoAttachment(
  uri: string,
  name: string,
  size: number | undefined | null,
  mimeType?: string | null,
  previewUri?: string,
): Promise<UploadedFile> {
  assertFileSize(size);

  try {
    const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
    return {
      name,
      size: size ?? Math.round(base64.length * 0.75),
      isVideo: true,
      fileData: base64,
      mimeType: mimeType || 'video/mp4',
      previewUri,
    };
  } catch {
    throw new Error(LOCAL_FILE_READ_ERROR_MESSAGE);
  }
}

export type PickFileAttachmentResult =
  | UploadedFile
  | { file: UploadedFile; textContent: string };

const FILE_PICKER_TYPES = [
  'application/pdf',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/html',
  'text/xml',
  'application/rtf',
] as const;

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
    mimeType.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v|mkv)$/.test(lowerName)
  ) {
    return readVideoAttachment(asset.uri, name, asset.size, mimeType, asset.uri);
  }

  assertFileSize(asset.size);
  try {
    const textContent = await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
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

  return processImageAsset(asset);
}

export async function pickImageFromCamera(): Promise<UploadedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Necesitamos acceso a la cámara para tomar una foto.');
  }

  const result = await ImagePicker.launchCameraAsync({
    quality: 1,
    allowsEditing: false,
  });

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
  assertFileSize(asset.fileSize);

  return readVideoAttachment(
    asset.uri,
    asset.fileName || 'Video',
    asset.fileSize,
    asset.mimeType || 'video/mp4',
    asset.uri,
  );
}
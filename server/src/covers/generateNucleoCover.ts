import type { GoogleGenAI } from '@google/genai';
import {
  buildNucleoCoverPrompt,
  buildNucleoCoverSvgPrompt,
} from '../../../shared/generatedCover';
import { GEMINI_FLASH, GEMINI_FLASH_LITE } from '../../../shared/geminiModelChain';
import { sanitizeSvgMarkup } from '../illustrations/sanitizeSvg';

export const DEFAULT_COVER_IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
] as const;

const SVG_TEXT_MODELS = [GEMINI_FLASH_LITE, GEMINI_FLASH] as const;

export type NucleoCoverImage = {
  mimeType: string;
  base64: string;
};

type InlinePart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

type GenerateContentResponse = {
  text?: string;
  candidates?: Array<{ content?: { parts?: InlinePart[] } }>;
};

export function coverImageModelChain(envValue?: string): string[] {
  const extra = (envValue ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return [...new Set([...extra, ...DEFAULT_COVER_IMAGE_MODELS])];
}

export function extractCoverInlineImage(response: GenerateContentResponse): NucleoCoverImage | null {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const data = part.inlineData?.data?.trim();
    const mimeType = part.inlineData?.mimeType?.trim() || 'image/png';
    if (!data) continue;
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png' && mimeType !== 'image/webp') continue;
    return { mimeType, base64: data };
  }
  return null;
}

export function extractSvgMarkup(raw: string): string | null {
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return null;
  return sanitizeSvgMarkup(match[0]);
}

function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /"code"\s*:\s*429\b/.test(message) || /\b429\b/.test(message) && /quota|resource.?exhausted/i.test(message);
}

function responseText(response: GenerateContentResponse): string {
  if (typeof response.text === 'string' && response.text.trim()) return response.text;
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts.map((part) => part.text ?? '').join('');
}

async function generateRasterCover(
  client: GoogleGenAI,
  prompt: string,
  models: string[],
  timeoutMs: number
): Promise<NucleoCoverImage | null> {
  for (const model of models) {
    try {
      const response = (await Promise.race([
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseModalities: ['TEXT', 'IMAGE'],
          },
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('cover_timeout')), timeoutMs);
        }),
      ])) as GenerateContentResponse;
      const image = extractCoverInlineImage(response);
      if (image) return image;
    } catch (error) {
      if (isQuotaError(error)) return null;
    }
  }
  return null;
}

async function generateSvgCover(
  client: GoogleGenAI,
  prompt: string,
  timeoutMs: number
): Promise<NucleoCoverImage> {
  let lastError: unknown;
  for (const model of SVG_TEXT_MODELS) {
    try {
      const response = (await Promise.race([
        client.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: 0.4,
            maxOutputTokens: 4096,
          },
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('cover_timeout')), timeoutMs);
        }),
      ])) as GenerateContentResponse;
      const svg = extractSvgMarkup(responseText(response));
      if (svg) {
        return {
          mimeType: 'image/svg+xml',
          base64: Buffer.from(svg, 'utf8').toString('base64'),
        };
      }
      lastError = new Error('cover_empty');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('cover_failed');
}

export async function generateNucleoCoverImage(
  client: GoogleGenAI,
  input: { title: string; thesis: string },
  options?: { models?: string[]; timeoutMs?: number }
): Promise<NucleoCoverImage> {
  const timeoutMs = options?.timeoutMs ?? 45_000;
  const raster = await generateRasterCover(
    client,
    buildNucleoCoverPrompt(input.title, input.thesis),
    options?.models?.length ? options.models : coverImageModelChain(process.env.GEMINI_IMAGE_MODEL),
    timeoutMs
  );
  if (raster) return raster;
  return generateSvgCover(client, buildNucleoCoverSvgPrompt(input.title, input.thesis), timeoutMs);
}

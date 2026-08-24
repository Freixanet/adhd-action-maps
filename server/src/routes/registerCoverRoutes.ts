import type { Express, Request, Response } from 'express';
import {
  clipCoverText,
  GENERATED_COVER_THESIS_MAX,
  GENERATED_COVER_TITLE_MAX,
} from '../../../shared/generatedCover';
import type { AuthenticatedRequest } from '../../llmAccess';
import type { NucleoCoverImage } from '../covers/generateNucleoCover';

type CoverRouteDeps = {
  isWithinRateLimit: (ip: string) => boolean;
  requireLlmAccess: (req: AuthenticatedRequest, res: Response) => Promise<boolean>;
  generateCover: (input: { title: string; thesis: string }) => Promise<NucleoCoverImage>;
};

/**
 * POST /api/nucleo-cover — Gemini image, locked style.
 * Body is title + short thesis only. Never logs subject text or image bytes.
 */
export function registerCoverRoutes(app: Express, deps: CoverRouteDeps): void {
  app.post('/api/nucleo-cover', async (req: Request, res: Response) => {
    const authReq = req as AuthenticatedRequest;
    try {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      if (!deps.isWithinRateLimit(ip)) {
        res.status(429).json({ error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' });
        return;
      }
      if (!(await deps.requireLlmAccess(authReq, res))) return;

      const title = clipCoverText(String(req.body?.title ?? ''), GENERATED_COVER_TITLE_MAX);
      const thesis = clipCoverText(String(req.body?.thesis ?? ''), GENERATED_COVER_THESIS_MAX);
      if (!title) {
        res.status(400).json({ error: 'title required' });
        return;
      }

      const image = await deps.generateCover({ title, thesis });
      res.json({ mimeType: image.mimeType, base64: image.base64 });
    } catch (err) {
      console.warn('[nucleo-cover]', err instanceof Error ? err.message.slice(0, 120) : 'failed');
      res.status(502).json({ error: 'cover_failed' });
    }
  });
}

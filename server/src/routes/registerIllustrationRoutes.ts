import type { Express, Request, Response } from 'express';
import type { IllustrationSpec } from '../../../shared/editorial';
import { EDITORIAL_STYLE_ID, STREAMLINE_LOCKED_FAMILY_SLUG } from '../../../shared/editorial';
import { resolveIllustrationDelivery } from '../illustrations/resolveIllustration';

/**
 * DEV/product illustration resolve — server holds STREAMLINE_API_KEY.
 * Returns ephemeral SVG when Streamline free UX Line hit succeeds.
 */
export function registerIllustrationRoutes(app: Express): void {
  app.post('/api/illustrations/resolve', async (req: Request, res: Response) => {
    try {
      const spec = req.body?.spec as IllustrationSpec | undefined;
      if (!spec || typeof spec !== 'object') {
        res.status(400).json({ error: 'spec required' });
        return;
      }
      if (spec.styleId !== EDITORIAL_STYLE_ID) {
        res.status(400).json({ error: 'styleId must be nucleo-editorial-v1' });
        return;
      }

      const apiKey = process.env.STREAMLINE_API_KEY;
      const delivery = await resolveIllustrationDelivery(spec, apiKey);

      res.json({
        ...delivery,
        // Never echo the API key or raw remote URLs for download.
        lockedFamilySlug: STREAMLINE_LOCKED_FAMILY_SLUG,
        keyConfigured: Boolean(apiKey?.trim()),
      });
    } catch (err) {
      console.warn('[illustrations/resolve]', err instanceof Error ? err.message : err);
      res.status(500).json({ error: 'illustration_resolve_failed' });
    }
  });
}

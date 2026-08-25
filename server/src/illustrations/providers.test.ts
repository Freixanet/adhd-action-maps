import { describe, expect, it } from 'vitest';
import {
  createStreamlineProvider,
  searchIllustrationProviders,
  downloadStreamlineSvg,
} from './providers';
import { sanitizeSvgMarkup } from './sanitizeSvg';
import { STREAMLINE_LOCKED_FAMILY_SLUG } from '../../../shared/editorial';

describe('illustration providers', () => {
  it('streamline without key returns empty (local path stays available)', async () => {
    const provider = createStreamlineProvider(undefined);
    const rows = await provider.search(['peak', 'sunrise', 'path']);
    expect(rows).toEqual([]);
  });

  it('searchIllustrationProviders tolerates empty providers', async () => {
    const rows = await searchIllustrationProviders(['tool'], [createStreamlineProvider('')], {
      timeoutMs: 50,
    });
    expect(rows).toEqual([]);
  });

  it('download without key returns null', async () => {
    const out = await downloadStreamlineSvg(undefined, 'ico_test');
    expect(out).toBeNull();
  });

  it('sanitizeSvgMarkup strips scripts and rejects non-svg', () => {
    expect(sanitizeSvgMarkup('<div>x</div>')).toBeNull();
    const clean = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0"/></svg>'
    );
    expect(clean).toBeTruthy();
    expect(clean).not.toMatch(/script/i);
  });

  it('provider module locks UX Line family and does not embed secrets', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(path.join(__dirname, 'providers.ts'), 'utf8');
    expect(src).not.toMatch(/x-api-key:\s*['"][a-zA-Z0-9_-]{10,}/);
    expect(src).toContain('apiKey.trim()');
    expect(src).toContain('STREAMLINE_LOCKED_FAMILY_SLUG');
    expect(src).toContain('/v1/search/family/');
    expect(src).toContain('/download/svg');
    expect(STREAMLINE_LOCKED_FAMILY_SLUG).toBe('ux-line');
  });
});

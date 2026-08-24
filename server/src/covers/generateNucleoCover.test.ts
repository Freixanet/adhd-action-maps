import { describe, expect, it } from 'vitest';
import { coverImageModelChain, extractCoverInlineImage, extractSvgMarkup } from './generateNucleoCover';

describe('generateNucleoCover helpers', () => {
  it('prefers an env model then the locked fallbacks', () => {
    const chain = coverImageModelChain('gemini-3.1-flash-image, gemini-3.1-flash-image');
    expect(chain[0]).toBe('gemini-3.1-flash-image');
    expect(chain.filter((item) => item === 'gemini-3.1-flash-image')).toHaveLength(1);
    expect(chain).toContain('gemini-2.5-flash-image');
  });

  it('reads the first allowed inline image', () => {
    const image = extractCoverInlineImage({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: 'abc' } },
            ],
          },
        },
      ],
    });
    expect(image).toEqual({ mimeType: 'image/jpeg', base64: 'abc' });
    expect(extractCoverInlineImage({ candidates: [{ content: { parts: [] } }] })).toBeNull();
  });

  it('extracts a sanitized svg document from model text', () => {
    const svg = extractSvgMarkup(
      'Here:\n```svg\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>x</script><circle cx="5" cy="5" r="4"/></svg>\n```'
    );
    expect(svg).toContain('<svg');
    expect(svg).toContain('<circle');
    expect(svg).not.toContain('<script');
  });
});

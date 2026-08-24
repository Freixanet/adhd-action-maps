import { describe, expect, it } from 'vitest';
import { buildCopyHtml } from './copyHtml';

describe('buildCopyHtml', () => {
  it('embeds the payload and copies via execCommand', () => {
    const html = buildCopyHtml('Hola <script>');
    expect(html).toContain('execCommand');
    expect(html).toContain('Hola');
    expect(html).toContain('\\u003c');
  });
});

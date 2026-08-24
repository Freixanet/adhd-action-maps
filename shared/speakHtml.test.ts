import { describe, expect, it } from 'vitest';
import { buildSpeakHtml } from './speakHtml';

describe('buildSpeakHtml', () => {
  it('injects the text as a JSON string so markup cannot run as HTML', () => {
    const html = buildSpeakHtml('Hola <script>alert(1)</script> "mundo"');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('\\u003cscript>alert(1)\\u003c/script>');
    expect(html).toContain('speechSynthesis.speak');
  });

  it('signals when speech is unavailable', () => {
    expect(buildSpeakHtml('')).toContain("postMessage('unavailable')");
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildPdfFabThumbnailBootModule,
  buildPdfFabThumbnailHtml,
} from './buildPdfFabThumbnailHtml';
import {
  viewerArtifactsForbidRemoteAndEval,
  viewerHtmlHasEvalSupportDisabled,
} from './buildPdfPageViewerHtml';

describe('pdf fab thumbnail shell', () => {
  it('fits the full first page into a rounded PNG', () => {
    const boot = buildPdfFabThumbnailBootModule({
      width: 62,
      height: 80,
      radius: 12,
      pixelRatio: 2,
    });
    expect(boot).toContain("getElementById('c')");
    expect(boot).toContain("type: 'ready'");
    expect(boot).toContain("toDataURL('image/png')");
    expect(boot).toContain('ctx.clip()');
    expect(boot).toContain('arcTo');
    expect(boot).toContain('Math.min(targetW / base.width, targetH / base.height)');
    expect(boot).toContain("type: 'boot-start'");
    expect(boot).toContain('from "./pdf.min.mjs"');
    expect(boot).toContain('isOffscreenCanvasSupported: false');
    expect(viewerHtmlHasEvalSupportDisabled(boot)).toBe(true);
    viewerArtifactsForbidRemoteAndEval([boot]);
  });

  it('keeps HTML offline, chrome-free, and sized to the chip', () => {
    const html = buildPdfFabThumbnailHtml({ width: 62, height: 80, radius: 12 });
    expect(html).not.toMatch(/https?:\/\//i);
    expect(html).toContain('id="c"');
    expect(html).toContain('width:62px');
    expect(html).toContain('height:80px');
    expect(html).toContain('width=62');
    expect(html).not.toContain('pageCount');
    expect(html).toContain('script type="module"');
    expect(html).toContain('src="probe.js"');
    viewerArtifactsForbidRemoteAndEval([html]);
  });
});

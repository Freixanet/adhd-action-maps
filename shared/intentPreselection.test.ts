import { describe, expect, it } from 'vitest';
import {
  QA_MULTIPAGE_PDF_APPLY_LABEL,
  QA_MULTIPAGE_PDF_UNDERSTAND_LABEL,
  intentDisplayLabel,
  planQaMultipagePdfAttach,
  resolveComposerIntent,
  suggestIntentFromSource,
} from './intentPreselection';

describe('QA multipage PDF intent', () => {
  it('QA Entender pins and sends intent: understand', () => {
    const plan = planQaMultipagePdfAttach('understand');
    expect(plan.menuLabel).toBe(QA_MULTIPAGE_PDF_UNDERSTAND_LABEL);
    expect(plan.intent).toBe('understand');

    const pdf = { isPdf: true };
    // Passive documents default to understanding; an explicit pin still wins.
    expect(suggestIntentFromSource('', pdf, null)).toBe('understand');
    expect(
      resolveComposerIntent({
        pinnedIntent: plan.pinnedIntent,
        text: '',
        uploadedFile: pdf,
        urlDetection: null,
      })
    ).toBe('understand');
    expect(intentDisplayLabel(plan.intent)).toBe('Entender');
  });

  it('QA Aplicar pins and sends intent: apply', () => {
    const plan = planQaMultipagePdfAttach('apply');
    expect(plan.menuLabel).toBe(QA_MULTIPAGE_PDF_APPLY_LABEL);
    expect(plan.intent).toBe('apply');

    expect(
      resolveComposerIntent({
        pinnedIntent: plan.pinnedIntent,
        text: '',
        uploadedFile: { isPdf: true },
        urlDetection: null,
      })
    ).toBe('apply');
    expect(intentDisplayLabel(plan.intent)).toBe('Aplicar');
  });

  it('normal PDF defaults to understanding when nothing is pinned', () => {
    expect(
      resolveComposerIntent({
        pinnedIntent: null,
        text: '',
        uploadedFile: { isPdf: true },
        urlDetection: null,
      })
    ).toBe('understand');
    expect(suggestIntentFromSource('', { isPdf: true }, null)).toBe('understand');
  });

  it('an explicit application instruction still selects apply for a PDF', () => {
    expect(
      resolveComposerIntent({
        pinnedIntent: null,
        text: 'Quiero aplicar este manual paso a paso',
        uploadedFile: { isPdf: true },
        urlDetection: null,
      })
    ).toBe('apply');
  });
});

import { describe, expect, it } from 'vitest';
import {
  reduceSourceViewerDocStatus,
  type SourceViewerDocStatus,
} from './sourceViewerDocStatus';

describe('sourceViewerDocStatus', () => {
  it('onHttpError then onLoadEnd stays error', () => {
    let s: SourceViewerDocStatus = 'idle';
    s = reduceSourceViewerDocStatus(s, { type: 'loadStart' });
    expect(s).toBe('loading');
    s = reduceSourceViewerDocStatus(s, { type: 'error' });
    expect(s).toBe('error');
    s = reduceSourceViewerDocStatus(s, { type: 'loadEnd' });
    expect(s).toBe('error');
    s = reduceSourceViewerDocStatus(s, { type: 'load' });
    expect(s).toBe('error');
  });

  it('successful load uses onLoad → ready; loadEnd does not regress', () => {
    let s: SourceViewerDocStatus = 'idle';
    s = reduceSourceViewerDocStatus(s, { type: 'loadStart' });
    s = reduceSourceViewerDocStatus(s, { type: 'load' });
    expect(s).toBe('ready');
    s = reduceSourceViewerDocStatus(s, { type: 'loadEnd' });
    expect(s).toBe('ready');
  });

  it('reset returns idle', () => {
    expect(reduceSourceViewerDocStatus('error', { type: 'reset' })).toBe('idle');
  });
});

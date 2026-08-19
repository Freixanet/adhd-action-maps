/**
 * Evidence viewer document load state machine (S08).
 * onLoadEnd must never clear error after onError/onHttpError.
 */

export type SourceViewerDocStatus = 'idle' | 'loading' | 'ready' | 'error';

export type SourceViewerDocEvent =
  | { type: 'reset' }
  | { type: 'loadStart' }
  | { type: 'load' }
  | { type: 'loadEnd' }
  | { type: 'error' };

export function reduceSourceViewerDocStatus(
  state: SourceViewerDocStatus,
  event: SourceViewerDocEvent
): SourceViewerDocStatus {
  switch (event.type) {
    case 'reset':
      return 'idle';
    case 'loadStart':
      return 'loading';
    case 'load':
      return state === 'error' ? 'error' : 'ready';
    case 'error':
      return 'error';
    case 'loadEnd':
      // Never promote error → ready. Ready only comes from onLoad.
      if (state === 'error') return 'error';
      if (state === 'ready') return 'ready';
      return state === 'loading' ? 'loading' : state;
    default:
      return state;
  }
}

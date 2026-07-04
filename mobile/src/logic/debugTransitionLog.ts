const DEBUG_ENDPOINT = 'http://127.0.0.1:7591/ingest/b8e389d1-6af3-4e0d-a326-0694110ac84c';
const DEBUG_SESSION_ID = 'f5b05d';

export function debugTransitionLog(
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
  runId = 'continue-transform-v1'
) {
  if (!__DEV__) return;

  const payload = {
    sessionId: DEBUG_SESSION_ID,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  console.warn('[debug-f5b05d]', JSON.stringify(payload));
  // #endregion

  fetch(DEBUG_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': DEBUG_SESSION_ID,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

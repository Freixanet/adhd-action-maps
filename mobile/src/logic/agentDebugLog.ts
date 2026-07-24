import { Platform } from 'react-native';

/** Debug-mode NDJSON logger. Prefer Metro (phone already reaches it). */
const SESSION = '7b73da';

function metroIngestUrl() {
  // Expo sets scriptURL like http://192.168.1.16:8081/index.bundle?...
  const scriptURL =
    typeof NativeModulesMaybeGetScriptURL === 'function'
      ? NativeModulesMaybeGetScriptURL()
      : null;
  if (scriptURL) {
    try {
      const u = new URL(scriptURL);
      return `${u.protocol}//${u.host}/agent-debug-log`;
    } catch (_) {}
  }
  // Fallbacks
  return 'http://192.168.1.16:8081/agent-debug-log';
}

// Avoid importing SourceCode on web; resolve lazily.
function NativeModulesMaybeGetScriptURL(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native');
    return NativeModules?.SourceCode?.scriptURL ?? null;
  } catch {
    return null;
  }
}

export function agentLog(
  hypothesisId: string,
  location: string,
  message: string,
  data?: Record<string, unknown>,
  runId = 'pre-fix'
) {
  const payload = {
    sessionId: SESSION,
    runId,
    hypothesisId,
    location,
    message,
    data: data ?? {},
    timestamp: Date.now(),
    platform: Platform.OS,
  };
  // #region agent log
  console.log(`[agent:${SESSION}]`, message, data ?? {});
  const body = JSON.stringify(payload);
  const urls = [
    metroIngestUrl(),
    'http://192.168.1.16:7898/ingest/bbc9ecbc-e71f-48f5-9d31-de7ddf27db67',
  ];
  for (const url of urls) {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': SESSION,
      },
      body,
    }).catch(() => {});
  }
  // #endregion
}

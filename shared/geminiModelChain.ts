export const GEMINI_FLASH = 'gemini-3.7-flash';
export const GEMINI_FLASH_LITE = 'gemini-3.5-flash-lite';

export type GeminiThinkingLevel = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH';

export type GeminiModelRoute = {
  model: string;
  thinkingLevel: GeminiThinkingLevel | null;
};

const THINKING_LEVELS = new Set<string>(['MINIMAL', 'LOW', 'MEDIUM', 'HIGH']);

const LEGACY_MODEL_IDS: Record<string, string> = {
  'gemini-3.6-flash': GEMINI_FLASH,
  'gemini-3.5-flash': GEMINI_FLASH,
  'gemini-3-flash-preview': GEMINI_FLASH,
  'gemini-3.1-flash-lite': GEMINI_FLASH_LITE,
  'gemini-3.1-flash-lite-preview': GEMINI_FLASH_LITE,
};

/** Extended thinking first, then the same model with thinking turned down. */
const THINKING_FALLBACKS: Record<string, GeminiThinkingLevel[]> = {
  [GEMINI_FLASH]: ['HIGH', 'LOW'],
  [GEMINI_FLASH_LITE]: ['HIGH', 'MINIMAL'],
};

export function canonicalizeGeminiModelId(value: string | undefined): string {
  const raw = value?.trim() ?? '';
  if (!raw || raw === 'auto') return '';
  return LEGACY_MODEL_IDS[raw] ?? raw;
}

export function formatGeminiModelRoute(route: GeminiModelRoute): string {
  return route.thinkingLevel ? `${route.model}:${route.thinkingLevel}` : route.model;
}

export function parseGeminiModelRoute(entry: string): GeminiModelRoute {
  const idx = entry.lastIndexOf(':');
  if (idx > 0) {
    const level = entry.slice(idx + 1);
    if (THINKING_LEVELS.has(level)) {
      return {
        model: entry.slice(0, idx),
        thinkingLevel: level as GeminiThinkingLevel,
      };
    }
  }
  return { model: entry, thinkingLevel: null };
}

export function expandModelToRoutes(model: string): string[] {
  const levels = THINKING_FALLBACKS[model];
  if (!levels) return [model];
  return levels.map((thinkingLevel) => formatGeminiModelRoute({ model, thinkingLevel }));
}

export function uniqueRoutes(routes: string[]): string[] {
  return [...new Set(routes)];
}

export const DEFAULT_GEMINI_MODEL_CHAIN: string[] = uniqueRoutes([
  ...expandModelToRoutes(GEMINI_FLASH),
  ...expandModelToRoutes(GEMINI_FLASH_LITE),
]);

export function buildGeminiModelChainFromEnv(envValue?: string): string[] {
  const envIds = (envValue ?? '')
    .split(',')
    .map((item) => canonicalizeGeminiModelId(item))
    .filter(Boolean);
  return uniqueRoutes([
    ...envIds.flatMap(expandModelToRoutes),
    ...DEFAULT_GEMINI_MODEL_CHAIN,
  ]);
}

export function resolveGeminiModelChain(preferred?: string): string[] {
  const id = canonicalizeGeminiModelId(preferred);
  if (!id) return DEFAULT_GEMINI_MODEL_CHAIN;
  if (id === GEMINI_FLASH_LITE) return expandModelToRoutes(GEMINI_FLASH_LITE);
  if (id === GEMINI_FLASH) return DEFAULT_GEMINI_MODEL_CHAIN;
  return uniqueRoutes([...expandModelToRoutes(id), ...DEFAULT_GEMINI_MODEL_CHAIN]);
}

export function geminiThinkingConfig(
  thinkingLevel: GeminiThinkingLevel | null
): { thinkingConfig?: { thinkingLevel: GeminiThinkingLevel } } {
  if (!thinkingLevel) return {};
  return { thinkingConfig: { thinkingLevel } };
}

/**
 * Lumen canvas JSON is long. HIGH thinking burns the output budget and times out,
 * then the chain falls to Flash Lite, which picks thin kinds (guide).
 * Match Lumen's low-reasoning pass: Flash LOW, then MINIMAL, Lite last.
 */
export function lumenIlluminateModelChain(
  envChain: string[] = DEFAULT_GEMINI_MODEL_CHAIN
): string[] {
  const seen = new Set<string>();
  const models: string[] = [];
  for (const route of envChain) {
    const { model } = parseGeminiModelRoute(route);
    if (seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return uniqueRoutes(
    models.flatMap((model) => {
      if (model === GEMINI_FLASH) {
        // 3.7 Flash rejects MINIMAL (400). LOW matches Lumen; Lite is the fallback.
        return [formatGeminiModelRoute({ model, thinkingLevel: 'LOW' })];
      }
      if (model === GEMINI_FLASH_LITE) {
        return [formatGeminiModelRoute({ model, thinkingLevel: 'MINIMAL' })];
      }
      return [formatGeminiModelRoute({ model, thinkingLevel: 'LOW' })];
    })
  );
}

/** Ask JSON is short. HIGH thinking consumes maxOutputTokens and truncates the envelope. */
export function withMinimalThinking(routes: string[]): string[] {
  return uniqueRoutes(
    routes.map((route) => {
      const { model, thinkingLevel } = parseGeminiModelRoute(route);
      if (!thinkingLevel) return route;
      return formatGeminiModelRoute({ model, thinkingLevel: 'MINIMAL' });
    })
  );
}

export function isGeminiThinkingConfigError(statusCode: number | undefined, message: string): boolean {
  if (statusCode !== 400) return false;
  return /thinking/i.test(message);
}

function humanizeGeminiModelId(model: string): string {
  if (model === GEMINI_FLASH) return 'Gemini 3.7 Flash';
  if (model === GEMINI_FLASH_LITE) return 'Gemini 3.5 Flash Lite';
  if (model === 'gemini-3-pro-preview') return 'Gemini 3 Pro';
  if (model === 'gemini-3.1-pro-preview') return 'Gemini 3.1 Pro';
  if (model.startsWith('gemini-')) {
    return model
      .replace(/^gemini-/, 'Gemini ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  }
  return model;
}

/** Short DEV label. Extended thinking is marked; lower levels stay the model name. */
export function formatGeminiModelLabel(routeOrId?: string | null): string | null {
  const raw = routeOrId?.trim();
  if (!raw) return null;
  const { model, thinkingLevel } = parseGeminiModelRoute(raw);
  const name = humanizeGeminiModelId(model);
  if (thinkingLevel === 'HIGH' || thinkingLevel === 'MEDIUM') return `${name} · thinking`;
  return name;
}

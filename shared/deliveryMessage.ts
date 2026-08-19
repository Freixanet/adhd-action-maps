import type { ActionMapData, SourceKind } from './contracts';

export const DELIVERY_MESSAGE_MAX_CHARACTERS = 160;

export type ReadyAssistantMessageInput = {
  deliveryMessage?: string | null;
  title?: string | null;
  coreIdea?: string | null;
  sourceKind?: SourceKind | string | null;
  sourceLabel?: string | null;
  contentKind?: string | null;
  stepCount?: number | null;
  stepNames?: string[] | null;
  tldrTitles?: string[] | null;
};

export function softClipDeliveryMessage(
  text: string,
  max = DELIVERY_MESSAGE_MAX_CHARACTERS
): string {
  const cleaned = String(text ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  const slice = cleaned.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.55)) return slice.slice(0, lastSpace).trim();
  return slice.trim();
}

const VAGUE_SOURCE_PHRASES =
  /\b(tu material|tu documento|tu texto|tu fuente|el documento entero|sin releer la fuente|n[uú]cleo corto|preparado para leer|^listo\b)/i;

function distinctiveTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 5)
    .slice(0, 12);
}

/**
 * True when the message could apply to almost any source — reject and rebuild.
 */
export function isGenericDeliveryMessage(
  message: string,
  facts?: Pick<ReadyAssistantMessageInput, 'title' | 'coreIdea' | 'sourceLabel' | 'stepNames'>
): boolean {
  const msg = message.trim();
  if (!msg) return true;
  if (msg.length < 36) return true;
  if (/^listo\b/i.test(msg) || /preparado para leer/i.test(msg)) return true;
  if (VAGUE_SOURCE_PHRASES.test(msg) && !/\d/.test(msg)) {
    const anchors = [
      ...distinctiveTokens(facts?.sourceLabel || ''),
      ...distinctiveTokens(facts?.title || ''),
      ...distinctiveTokens(facts?.coreIdea || ''),
      ...(facts?.stepNames || []).flatMap((n) => distinctiveTokens(n)),
    ];
    const lower = msg.toLowerCase();
    const hit = anchors.some((token) => lower.includes(token));
    if (!hit) return true;
  }
  // Interchangeable template stem with no digits and no quoted proper title.
  if (
    /^he (convertido|condensado|pasado|organizado)\b/i.test(msg) &&
    !/\d/.test(msg) &&
    !/[«"].{4,}[»"]/.test(msg) &&
    /n[uú]cleo centrado|gu[ií]a pr[aá]ctica|pasos claros/i.test(msg)
  ) {
    return true;
  }
  return false;
}

/**
 * Build a handoff from facts already on the map — never kind-based templates.
 */
export function buildDeliveryMessageFallback(input: ReadyAssistantMessageInput): string {
  const title = (input.title || '').trim();
  const idea = (input.coreIdea || '').trim();
  const sourceLabel = (input.sourceLabel || '').trim();
  const steps =
    typeof input.stepCount === 'number' && input.stepCount > 0 ? input.stepCount : null;
  const stepNames = (input.stepNames || []).map((s) => s.trim()).filter(Boolean);
  const tldrTitles = (input.tldrTitles || []).map((s) => s.trim()).filter(Boolean);

  const sourceRef =
    sourceLabel && sourceLabel.toLowerCase() !== title.toLowerCase() ? sourceLabel : title;

  if (sourceRef && idea && steps && steps > 0) {
    const route =
      stepNames.length >= 2
        ? ` Empieza por «${stepNames[0]}» y «${stepNames[1]}».`
        : '';
    return softClipDeliveryMessage(
      `De «${sourceRef}» saqué un Núcleo de ${steps} pasos.${route} Lo que queda: ${idea}`
    );
  }

  if (title && idea && tldrTitles.length >= 2) {
    return softClipDeliveryMessage(
      `En «${title}» dejé ${tldrTitles[0]} y ${tldrTitles[1]} como ejes. Idea central: ${idea}`
    );
  }

  if (title && idea) {
    return softClipDeliveryMessage(`Sobre «${title}», la lectura queda en esto: ${idea}`);
  }

  if (idea) {
    return softClipDeliveryMessage(`La lectura que te dejé gira en torno a esto: ${idea}`);
  }

  if (title) {
    return softClipDeliveryMessage(`Ya tienes el Núcleo de «${title}» listo para abrirlo.`);
  }

  return 'Ya tienes el Núcleo listo para abrirlo.';
}

/** Prefer a specific model note; rebuild if the model wrote a generic line. */
export function pickReadyAssistantMessage(
  input?: ReadyAssistantMessageInput | string | null
): string {
  if (typeof input === 'string' || input == null) {
    return buildDeliveryMessageFallback({ title: input });
  }
  const fromModel = input.deliveryMessage?.trim();
  if (fromModel && !isGenericDeliveryMessage(fromModel, input)) {
    return softClipDeliveryMessage(fromModel);
  }
  return buildDeliveryMessageFallback(input);
}

export function pickReadyAssistantMessageFromMap(map: ActionMapData | null | undefined): string {
  if (!map) return buildDeliveryMessageFallback({});
  return pickReadyAssistantMessage({
    deliveryMessage: map.deliveryMessage,
    title: map.title,
    coreIdea: map.coreIdea,
    sourceKind: map.sourceMetadata?.kind,
    sourceLabel: map.sourceMetadata?.label || map.sourceMetadata?.title,
    contentKind: map.sourceMetadata?.contentKind,
    stepCount: Array.isArray(map.steps) ? map.steps.length : null,
    stepNames: (map.steps || [])
      .slice(0, 4)
      .map((step) => step.shortNav || step.title)
      .filter(Boolean),
    tldrTitles: (map.tldr || []).slice(0, 3).map((item) => item.title).filter(Boolean),
  });
}

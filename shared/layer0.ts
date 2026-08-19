import type { ActionMapData, Layer0, Layer0Action, MapIntent } from './contracts';

const MAX_WHAT_WORDS = 12;
const ACTION_COUNT = 3;

function trimWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  return words.slice(0, maxWords).join(' ');
}

function startsWithVerbHint(text: string): boolean {
  const first = text.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  // Spanish imperatives / infinitives common in action labels — soft check only.
  return Boolean(first) && !/^(el|la|los|las|un|una|esto|esa|ese|lo|la)$/i.test(first);
}

export function isLayer0Complete(layer0: Layer0 | null | undefined): boolean {
  if (!layer0) return false;
  if (!layer0.what?.trim() || !layer0.why?.trim()) return false;
  if (!Array.isArray(layer0.actions) || layer0.actions.length < ACTION_COUNT) return false;
  return layer0.actions.slice(0, ACTION_COUNT).every((a) => Boolean(a?.label?.trim()));
}

export function normalizeLayer0(input: unknown): Layer0 | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Partial<Layer0>;
  const what = typeof raw.what === 'string' ? trimWords(raw.what, MAX_WHAT_WORDS) : '';
  const why = typeof raw.why === 'string' ? raw.why.trim().replace(/\s+/g, ' ') : '';
  const actionsRaw = Array.isArray(raw.actions) ? raw.actions : [];
  const actions: Layer0Action[] = actionsRaw
    .slice(0, ACTION_COUNT)
    .map((item, index) => {
      const label =
        item && typeof item === 'object' && typeof (item as Layer0Action).label === 'string'
          ? String((item as Layer0Action).label).trim().replace(/\s+/g, ' ')
          : '';
      const id =
        item && typeof item === 'object' && typeof (item as Layer0Action).id === 'string'
          ? String((item as Layer0Action).id).trim()
          : `action-${index + 1}`;
      if (!label) return null;
      return { id: id || `action-${index + 1}`, label };
    })
    .filter(Boolean) as Layer0Action[];

  if (!what || !why || actions.length < ACTION_COUNT) return undefined;
  return { what, why, actions: actions.slice(0, ACTION_COUNT) };
}

function intentWhySeed(intent: MapIntent | undefined): string {
  if (intent === 'apply') return 'Aplica esto cuando necesites pasar de idea a movimiento concreto.';
  if (intent === 'study') return 'Ordena el material para estudiarlo sin perder el hilo.';
  return 'Aclara qué estás leyendo antes de entrar en el detalle.';
}

function actionFromTitle(title: string, index: number): Layer0Action {
  const clean = title.trim().replace(/\s+/g, ' ');
  const label = startsWithVerbHint(clean) ? clean : `Revisa ${clean}`;
  return { id: `action-${index + 1}`, label: trimWords(label, 10) };
}

/** Build a usable Capa 0 from existing map fields when the model omitted layer0. */
export function ensureLayer0(map: ActionMapData): Layer0 {
  const normalized = normalizeLayer0(map.layer0);
  if (normalized) return normalized;

  const what = trimWords(map.coreIdea || map.title || 'Un Núcleo de lectura', MAX_WHAT_WORDS);
  const whySeed = map.tldr?.[0]?.desc?.trim();
  const why =
    whySeed && startsWithVerbHint(whySeed)
      ? whySeed
      : intentWhySeed(map.intent);

  const fromTldr = (map.tldr ?? [])
    .slice(0, ACTION_COUNT)
    .map((item, i) => actionFromTitle(item.title || item.desc, i));
  const fromSteps = (map.steps ?? [])
    .slice(0, ACTION_COUNT)
    .map((step, i) => actionFromTitle(step.shortNav || step.title, i));

  const actions = [...fromTldr, ...fromSteps].slice(0, ACTION_COUNT);
  while (actions.length < ACTION_COUNT) {
    const n = actions.length + 1;
    actions.push({
      id: `action-${n}`,
      label: n === 1 ? 'Abre el núcleo completo' : n === 2 ? 'Lee la idea central' : 'Sigue el primer paso',
    });
  }

  return { what, why, actions };
}

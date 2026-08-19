/** Synonym / tag normalization for illustration search. */

const SYNONYMS: Record<string, string> = {
  procrastination: 'procrastinate',
  procrastinar: 'procrastinate',
  willpower: 'will',
  voluntad: 'will',
  mountain: 'peak',
  montaña: 'peak',
  summit: 'peak',
  brain: 'mind',
  cerebro: 'mind',
  target: 'target',
  diana: 'target',
  meta: 'goal',
  objetivo: 'goal',
  checklist: 'checklist',
  lista: 'list',
  clock: 'clock',
  reloj: 'clock',
  hiker: 'hiker',
  caminante: 'hiker',
  choice: 'choice',
  eleccion: 'choice',
  lock: 'padlock',
  candado: 'padlock',
  shoe: 'run',
  zapatilla: 'run',
  eye: 'vision',
  ojo: 'vision',
  people: 'group',
  gente: 'group',
  entorno: 'environment',
  experimento: 'experiment',
  evidencia: 'evidence',
  herramienta: 'tool',
  tools: 'tool',
  camino: 'path',
  progress: 'path',
  progreso: 'path',
  flag: 'peak',
  bandera: 'peak',
  sun: 'sunrise',
  sol: 'sunrise',
  lightning: 'insight',
  rayo: 'insight',
  belief: 'mind',
  creencia: 'mind',
};

export function normalizeIllustrationTag(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const first = cleaned.split(' ')[0] ?? cleaned;
  if (SYNONYMS[first]) return SYNONYMS[first];
  // Fold accents only after synonym lookup so "montaña" still maps.
  const folded = first.normalize('NFD').replace(/\p{M}/gu, '');
  return SYNONYMS[folded] ?? folded;
}

export function normalizeIllustrationTags(tags: readonly string[] | undefined | null): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags ?? []) {
    const n = normalizeIllustrationTag(tag);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 6) break;
  }
  return out;
}

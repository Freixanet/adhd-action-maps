import {
  ArrowTransfer,
  BatteryLow,
  BookOpen,
  Briefcase,
  CircleAlert,
  Clock,
  Cpu,
  HeartPulse,
  Home,
  Notification,
  Sparkles,
  Target,
  Wallet,
  type AppIconComponent,
} from '../icons';

type TldrIconRule = {
  icon: AppIconComponent;
  /** Matched against title with higher weight. */
  titleKeywords: string[];
  /** Matched against title+desc; weaker than title hits. */
  bodyKeywords: string[];
};

/**
 * Theme icons for “En 60 segundos”. Scored so title beats body and
 * specific themes beat broad words like “interrupciones”.
 */
const RULES: TldrIconRule[] = [
  {
    icon: BatteryLow,
    titleKeywords: ['foco', 'finito', 'atención', 'energía', 'agot', 'límite', 'limitad'],
    bodyKeywords: ['atención sostenida', 'recurso', 'consume energía', 'no es infinita'],
  },
  {
    icon: Target,
    titleKeywords: ['meta', 'objetivo', 'prioridad', 'dirección'],
    bodyKeywords: ['prioridad', 'objetivo claro', 'apuntar'],
  },
  {
    icon: ArrowTransfer,
    titleKeywords: ['cambio', 'salto', 'switch', 'multitarea', 'reorient'],
    bodyKeywords: ['saltar entre', 'entre tareas', 'cambio de', 'residuo', 'reorient'],
  },
  {
    icon: Home,
    titleKeywords: ['entorno', 'ambiente', 'espacio', 'diseño'],
    bodyKeywords: ['entorno', 'ambiente', 'espacio de trabajo', 'fuera de la vista'],
  },
  {
    icon: Notification,
    titleKeywords: ['aviso', 'notific', 'alerta', 'interrup'],
    bodyKeywords: ['notificaci', 'avisos', 'alerta', 'interrupción', 'interrupciones'],
  },
  {
    icon: Clock,
    titleKeywords: ['tiempo', 'minuto', 'ritmo', 'duración', 'reloj'],
    bodyKeywords: ['minutos', 'tarda', 'duración', 'ritmo'],
  },
  {
    icon: CircleAlert,
    titleKeywords: ['riesgo', 'precaución', 'peligro', 'cuidado'],
    bodyKeywords: ['riesgo', 'precaución', 'peligro'],
  },
  {
    icon: BookOpen,
    titleKeywords: ['leer', 'lectura', 'aprendizaje', 'estudi'],
    bodyKeywords: ['lectura', 'leer', 'aprendizaje', 'artículo'],
  },
  {
    icon: HeartPulse,
    titleKeywords: ['salud', 'sueño', 'estrés', 'cuerpo'],
    bodyKeywords: ['salud', 'sueño', 'estrés', 'fatiga'],
  },
  {
    icon: Cpu,
    titleKeywords: ['ia', 'tecnolog', 'digital', 'modelo'],
    bodyKeywords: ['inteligencia artificial', 'algoritmo', 'software'],
  },
  {
    icon: Briefcase,
    titleKeywords: ['negocio', 'trabajo', 'empresa', 'equipo'],
    bodyKeywords: ['negocio', 'empresa', 'productividad laboral'],
  },
  {
    icon: Wallet,
    titleKeywords: ['dinero', 'finanza', 'precio', 'ahorro', 'euro'],
    bodyKeywords: ['dinero', 'finanza', 'presupuesto', 'ahorro'],
  },
  {
    icon: Sparkles,
    titleKeywords: ['idea', 'clave', 'síntesis', 'resumen'],
    bodyKeywords: ['idea clave', 'en síntesis'],
  },
];

const FALLBACKS: AppIconComponent[] = [
  BatteryLow,
  ArrowTransfer,
  Home,
  Clock,
  BookOpen,
  Target,
];

function scoreRule(rule: TldrIconRule, title: string, body: string): number {
  let score = 0;
  for (const keyword of rule.titleKeywords) {
    if (title.includes(keyword)) score += 4;
  }
  for (const keyword of rule.bodyKeywords) {
    if (title.includes(keyword) || body.includes(keyword)) score += 1;
  }
  return score;
}

/** Pick a theme icon from TLDR title/desc; fall back by index so tiles stay distinct. */
export function resolveTldrBentoIcon(title: string, desc: string, index: number): AppIconComponent {
  const titleNorm = title.toLowerCase();
  const bodyNorm = `${title} ${desc}`.toLowerCase();

  let best: { icon: AppIconComponent; score: number } | null = null;
  for (const rule of RULES) {
    const score = scoreRule(rule, titleNorm, bodyNorm);
    if (score <= 0) continue;
    if (!best || score > best.score) {
      best = { icon: rule.icon, score };
    }
  }

  if (best) return best.icon;
  return FALLBACKS[index % FALLBACKS.length] ?? Sparkles;
}

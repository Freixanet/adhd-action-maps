import type { Canvas } from './types';
import { lumenCanvasToMap } from './toMap';
import type { ActionMapData } from '../contracts';
import type { HistoryStore } from '../history';
import { sessionWithSemanticProgress } from '../progress/deriveProgress';
import { resolveMapCategory, normalizeTags, deriveMapStatus } from '../categories';

/** Replaces the previous format-example Jump Back card in place. */
export const LUMEN_SAMPLE_NUCLEO_ID = 'nucleo-formato-ejemplo';

export const LUMEN_SAMPLE_CANVAS: Canvas = {
  id: 'sample-relatividad',
  createdAt: 0,
  source: { kind: 'sample', raw: 'Relatividad especial', title: 'Relatividad especial' },
  kind: 'explain',
  title: 'Relatividad especial',
  hook: 'El tiempo no es un reloj universal: es algo que te pasa a ti, a tu ritmo, según cómo te mueves.',
  essence:
    'La luz va siempre a c. Para que eso sea cierto, el espacio y el tiempo ceden: no hay un «ahora» compartido.',
  readMinutes: 4,
  insights: [
    {
      title: 'La luz no negocia',
      body: 'En el vacío, la luz siempre marca c. Nadie la alcanza sumando velocidades.',
      analogy: 'Un límite de carretera absoluto: el radar no cambia aunque el coche corra más.',
    },
    {
      title: 'No hay un ahora compartido',
      body: 'Dos eventos «a la vez» para ti no lo son para quien se mueve.',
      analogy: 'Aplaudir a la vez en un andén móvil: cada uno ve su mano primero.',
    },
    {
      title: 'Masa y energía, misma cuenta',
      body: 'E = mc²: la inercia es energía concentrada. Al moverte, esa energía sube.',
      analogy: 'Una batería llena pesa un pelo más que una vacía.',
    },
  ],
  layers: {
    surface: 'Nadie supera a la luz. Quien se mueve rápido ve el tiempo más lento y el metro más corto.',
    core: 'Leyes iguales en todo sistema inercial y c constante. De ahí dilatación, contracción y E = mc².',
    depth: 'El intervalo de Minkowski es lo invariante. El gemelo viajero acelera: su tiempo propio es menor.',
  },
  map: {
    nodes: [
      { id: 'c', label: 'c constante', kind: 'core', blurb: 'La velocidad de la luz no depende de quién la mida. Es el ancla de toda la teoría.' },
      { id: 'inercial', label: 'Sistemas inerciales', kind: 'core', blurb: 'Laboratorios en línea recta a velocidad constante. En todos, las mismas leyes.' },
      { id: 'tiempo', label: 'Dilatación del tiempo', kind: 'idea', blurb: 'Un reloj en movimiento, visto desde fuera, marca más lento.' },
      { id: 'longitud', label: 'Contracción de longitud', kind: 'idea', blurb: 'Las distancias se encogen solo en la dirección del movimiento.' },
      { id: 'simultaneidad', label: 'Simultaneidad relativa', kind: 'idea', blurb: 'Dos eventos distantes no tienen un orden temporal absoluto.' },
      { id: 'emc2', label: 'E = mc²', kind: 'detail', blurb: 'La energía en reposo de un cuerpo es su masa por c al cuadrado.' },
      { id: 'minkowski', label: 'Espacio-tiempo', kind: 'detail', blurb: 'Geometría de 4 dimensiones. Los intervalos, no los instantes, son lo real.' },
    ],
    edges: [
      { from: 'c', to: 'tiempo', label: 'obliga' },
      { from: 'c', to: 'longitud', label: 'obliga' },
      { from: 'inercial', to: 'simultaneidad', label: 'rompe' },
      { from: 'tiempo', to: 'minkowski', label: 'geometría' },
      { from: 'c', to: 'emc2', label: 'implica' },
    ],
  },
  cards: [
    { term: 'Tiempo propio', meaning: 'El tiempo que marca un reloj que viaja con el objeto. Es el intervalo más corto entre dos eventos en su línea de universo.', analogy: 'Tu edad no es la del calendario de la Tierra si te has estado moviendo muy, muy rápido respecto a ella.' },
    { term: 'Sistema inercial', meaning: 'Un marco que no acelera: línea recta, velocidad constante. En todos ellos las leyes tienen la misma forma.', analogy: 'Un café en una mesa de tren que no frena. El café no se entera de que el tren se mueve.' },
    { term: 'Transformación de Lorentz', meaning: 'Las fórmulas que convierten las coordenadas de un observador en las de otro. Sustituyen a Galileo cuando las velocidades no son despreciables frente a c.', analogy: 'El diccionario entre dos idiomas del espacio-tiempo.' },
    { term: 'Intervalo de Minkowski', meaning: 'Una cantidad invariante que combina tiempo y espacio. Todos coinciden en su valor, aunque no coincidan en dt ni en dx.', analogy: 'La hipotenusa de un triángulo: los catetos cambian si rotas el papel, la hipotenusa no.' },
  ],
  walk: [
    { kicker: 'El problema', title: 'Maxwell no encajaba con Galileo', body: 'Las ecuaciones de Maxwell decían que la luz viaja a una velocidad fija. ¿Fija respecto a qué? El éter debía ser ese medio. Los experimentos no lo encontraron.', why: 'Sin este conflicto no hay relatividad. Einstein partió de una física que se contradecía.' },
    { kicker: 'La apuesta', title: 'Dos postulados, nada más', body: 'Las leyes son las mismas para todo observador inercial. Y c es la misma para todos. El éter sobra. Aceptar las dos cosas obliga a abandonar el tiempo absoluto de Newton.', why: 'Casi toda la extrañeza posterior es álgebra: consecuencias de no traicionar esos dos puntos.' },
    { kicker: 'La primera herida', title: 'El ahora se parte', body: 'Si la luz tarda lo mismo para todos, dos relámpagos que un observador ve simultáneos no lo son para otro que se mueve.', why: 'Es el golpe conceptual más duro. Una vez lo aceptas, dilatación y contracción ya no sorprenden.' },
    { kicker: 'Los relojes', title: 'Moverse es envejecer más despacio', body: 'Un reloj de luz tarda más, visto desde fuera, si el aparato se mueve: el fotón recorre una diagonal. Ese «más» es dilatación temporal.', why: 'No es que el reloj se rompa. Es que el camino en el espacio-tiempo es distinto.' },
  ],
  quiz: [
    { question: 'Si un tren se mueve hacia un rayo de luz, ¿a qué velocidad mide el conductor ese rayo?', options: ['c más la velocidad del tren', 'Siempre c', 'c menos la velocidad del tren', 'Depende de si es de día'], answer: 1, why: 'c no se suma a la velocidad del observador. Por eso el tiempo y el espacio tienen que ajustarse.' },
    { question: '¿Qué es el tiempo propio?', options: ['El tiempo del centro del universo', 'El que marca un reloj en reposo respecto al objeto', 'El tiempo medio entre dos observadores', 'El huso de Greenwich'], answer: 1, why: 'Tiempo propio = el reloj que viaja con el sistema.' },
    { question: '¿Por qué la paradoja de los gemelos no es simétrica?', options: ['Porque el que viaja acelera y deja de ser inercial', 'Porque el gemelo de la Tierra es más joven', 'Porque el espacio se curva solo para uno', 'Porque la luz viaja más rápido de vuelta'], answer: 0, why: 'El viajero, al dar la vuelta, acelera. Sus líneas de universo no son equivalentes.' },
  ],
  prompts: [
    '¿Qué pasaría si viajara al 99% de c durante un año mío?',
    'Explícame la simultaneidad con un dibujo mental más simple.',
    '¿La relatividad general cambia esto o lo envuelve?',
  ],
};

export const LUMEN_SAMPLE_NUCLEO_DATA: ActionMapData = lumenCanvasToMap(LUMEN_SAMPLE_CANVAS, {
  modelUsed: 'lumen-sample.v1',
});

export function upsertLumenSampleNucleo(store: HistoryStore): HistoryStore {
  const map = LUMEN_SAMPLE_NUCLEO_DATA;
  const now = Date.now();
  const existing = store.entries.find((entry) => entry.id === LUMEN_SAMPLE_NUCLEO_ID);
  const baseSession = {
    data: map,
    currentStep: existing?.session.currentStep ?? 0,
    isComplete: existing?.session.isComplete ?? false,
    viewAll: existing?.session.viewAll ?? false,
  };
  const session = sessionWithSemanticProgress(baseSession, map, now);
  const intent = map.intent === 'apply' || map.intent === 'study' ? map.intent : 'understand';
  const meta = {
    category: resolveMapCategory(map.category),
    tags: normalizeTags(map.tags),
    intent,
    status: deriveMapStatus(session, intent),
  };

  if (existing) {
    const prev = existing.session.data;
    if (prev?.modelUsed === map.modelUsed && prev?.title === map.title && prev?.generationMode === 'lumen-v1') {
      return store;
    }
    return {
      ...store,
      entries: store.entries.map((entry) =>
        entry.id === LUMEN_SAMPLE_NUCLEO_ID
          ? {
              ...entry,
              title: map.title,
              session,
              ...meta,
            }
          : entry
      ),
    };
  }

  return {
    ...store,
    entries: [
      {
        id: LUMEN_SAMPLE_NUCLEO_ID,
        title: map.title,
        createdAt: now,
        updatedAt: now,
        sourceType: 'text',
        session,
        ...meta,
      },
      ...store.entries,
    ],
    activeId: store.activeId,
  };
}

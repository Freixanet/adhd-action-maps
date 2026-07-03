import type { ActionMapData } from '../logic/contracts';

export const DEMO_NUCLEO_ID = 'nucleo-demo-included';

export const DEMO_NUCLEO_DATA: ActionMapData = {
  title: 'La atención como recurso limitado',
  category: 'Aprendizaje',
  intent: 'understand',
  coreIdea: 'Tu atención no falla por flojera: se agota cuando el entorno exige cambios de foco sin pausa.',
  coreSupport:
    'Cada interrupción obliga al cerebro a reorientarse, y ese coste acumulado es lo que deja las lecturas largas a medias.',
  tldr: [
    {
      title: 'Foco finito',
      desc: 'La atención sostenida consume energía cognitiva; no es infinita en una misma sesión.',
    },
    {
      title: 'Coste del cambio',
      desc: 'Saltar entre tareas deja un rastro que tarda minutos en disiparse.',
    },
    {
      title: 'Diseño del entorno',
      desc: 'Reducir interrupciones recupera más rendimiento que forzar la voluntad.',
    },
  ],
  sourceMetadata: {
    kind: 'text',
    label: 'Artículo empaquetado',
    detected: ['Artículo breve sobre atención y hábitos de lectura.'],
    limitations: ['Contenido pedagógico empaquetado con la app; no sustituye la fuente original.'],
  },
  steps: [
    {
      id: 'demo-step-1',
      shortNav: 'Foco',
      title: 'La atención se gasta, no se pierde por capricho',
      time: '~2 min',
      content: [
        {
          type: 'prose',
          text: 'Mantener el foco en una sola línea de lectura exige inhibir estímulos competidores. Ese filtrado continuo consume recursos que no se regeneran al instante.',
        },
        {
          type: 'callout',
          kind: 'info',
          label: 'Idea clave',
          text: 'La fatiga atencional es un límite fisiológico, no un fallo de carácter.',
        },
      ],
    },
    {
      id: 'demo-step-2',
      shortNav: 'Cambio',
      title: 'Cada cambio de tarea deja residuo cognitivo',
      time: '~2 min',
      content: [
        {
          type: 'prose',
          text: 'Al saltar de una lectura a una notificación, el cerebro tarda varios minutos en volver al mismo nivel de comprensión. Ese residuo se acumula si el entorno interrumpe a menudo.',
        },
        {
          type: 'callout',
          kind: 'alert',
          label: 'Precaución',
          text: 'Multitarea en lectura no reparte el foco: lo fragmenta y alarga el tiempo total.',
        },
      ],
    },
    {
      id: 'demo-step-3',
      shortNav: 'Entorno',
      title: 'Proteger el contexto vale más que empujar la voluntad',
      time: '~2 min',
      content: [
        {
          type: 'prose',
          text: 'Silenciar avisos, agrupar lecturas y cerrar pestañas reduce el número de reorientaciones. El entorno estable hace predecible el retorno al texto.',
        },
        {
          type: 'callout',
          kind: 'action',
          label: 'Para aplicarlo',
          text: 'Antes de leer, deja el móvil fuera de la vista y abre solo la fuente que vas a terminar.',
        },
      ],
    },
    {
      id: 'demo-step-4',
      shortNav: 'Cierre',
      title: 'Leer hasta el final es un diseño, no un impulso',
      time: '~1 min',
      content: [
        {
          type: 'prose',
          text: 'Un Núcleo acabable funciona porque delimita alcance y tiempo. La misma lógica aplica a tu sesión: un bloque corto, sin interrupciones, con un final claro.',
        },
      ],
    },
  ],
  completionCard: {
    title: 'Has terminado el ejemplo',
    summary: 'La atención mejora cuando reduces cambios de foco, no cuando te exiges más fuerza de voluntad.',
    takeaways: [
      'La atención sostenida se agota con el filtrado constante de estímulos.',
      'Cada interrupción deja un coste de reorientación de varios minutos.',
      'Diseñar el entorno protege el foco mejor que la presión interna.',
    ],
  },
};

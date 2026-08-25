import type { Canvas } from './types';

/** Lumen home chips besides Relatividad — same canvases as the Lumen workspace. */

export const LUMEN_GALLETAS_CANVAS: Canvas = {
  id: 'sample-galletas',
  createdAt: 0,
  source: { kind: 'sample', raw: 'Galletas de chocolate extra chewy', title: 'Galletas extra chewy' },
  kind: 'recipe',
  title: 'Galletas extra chewy',
  hook: 'Lo chewy es agua atrapada, azúcar que no cristaliza y no pasarte de horno.',
  readMinutes: 6,
  servings: 16,
  prepMinutes: 20,
  cookMinutes: 11,
  difficulty: 'Fácil',
  yieldNote: '16 galletas de 7 cm, centro tierno al día siguiente.',
  ingredients: [
    { amount: 170, unit: 'g', item: 'mantequilla sin sal', note: 'derretida y tibia, no caliente' },
    { amount: 180, unit: 'g', item: 'azúcar moreno oscuro' },
    { amount: 50, unit: 'g', item: 'azúcar blanco' },
    { amount: 1, unit: '', item: 'huevo grande' },
    { amount: 1, unit: 'yema', item: 'yema extra' },
    { amount: 2, unit: 'cdta', item: 'vainilla' },
    { amount: 280, unit: 'g', item: 'harina todo uso' },
    { amount: 3, unit: 'g', item: 'bicarbonato' },
    { amount: 5, unit: 'g', item: 'sal fina' },
    { amount: 200, unit: 'g', item: 'chocolate negro en trozos', note: '70%, no pepitas' },
  ],
  steps: [
    { n: 1, title: 'Derrite y espera', body: 'Derrite la mantequilla. Déjala tibia: si está caliente, cuece el huevo y la masa queda grasienta.', minutes: 5, tip: 'El punto es poder tocarla un segundo sin quemarte.' },
    { n: 2, title: 'Azúcares primero', body: 'Bate mantequilla con ambos azúcares un minuto. El moreno aporta melaza (humedad). El blanco, un poco de borde.', minutes: 2 },
    { n: 3, title: 'Huevo, yema, vainilla', body: 'Incorpora el huevo, la yema extra y la vainilla. La yema es grasa y emulsionante: más morder, menos galleta seca.', minutes: 1 },
    { n: 4, title: 'Secos, apenas', body: 'Mezcla harina, bicarbonato y sal. Añade a la masa y para en cuanto desaparezca el blanco. El gluten de más es el enemigo de lo chewy.', minutes: 2, tip: 'Si ves rastros de harina, dos vueltas más. Nunca diez.' },
    { n: 5, title: 'Chocolate y frío', body: 'Pliega los trozos. Enfría la masa 30 minutos en la nevera. La grasa se solidifica: menos extensión, centro más alto.', minutes: 30 },
    { n: 6, title: 'Horno corto', body: '180 °C. Bolas de 50 g, 11 minutos. Los bordes se marcan; el centro parece crudo. Eso es el punto. En la bandeja siguen cuajando.', minutes: 11, tip: 'Si esperas a que se vean «hechas», ya las pasaste.' },
  ],
  science:
    'El moreno sujeta agua. La yema extra envuelve el almidón y evita miga seca. Mantequilla derretida: menos aire, más densidad. El frío limita el spread. Subhornear deja el centro tierno al enfriar.',
  swaps: [
    { from: 'Harina todo uso', to: '70% todo uso + 30% panadera', note: 'Un poco más de gluten da goma extra, no pan. No pases de ahí.' },
    { from: 'Chocolate negro', to: 'Mezcla 70% y 40%', note: 'El más dulce se funde más y moja el entorno.' },
    { from: 'Mantequilla', to: '85% mantequilla + 15% sebo o shortening', note: 'Más punto de fusión, galleta más alta. Cambia el sabor.' },
  ],
  prompts: [
    'Quiero que queden más gruesas.',
    '¿Cómo las hago sin huevo?',
    '¿Por qué al día siguiente están mejores?',
    'Adáptalas a sartén, sin horno.',
  ],
};

export const LUMEN_EV_CANVAS: Canvas = {
  id: 'sample-ev',
  createdAt: 0,
  source: { kind: 'sample', raw: 'Comparar Tesla Model 3 y Hyundai Ioniq 6', title: 'Model 3 vs Ioniq 6' },
  kind: 'compare',
  title: 'Model 3 vs Ioniq 6',
  hook: 'Uno es un ordenador con ruedas. El otro es un coche que pasó por un túnel de viento. Eliges software o eficiencia.',
  readMinutes: 4,
  items: [
    {
      id: 'm3',
      name: 'Tesla Model 3',
      tagline: 'El estándar de software y recarga Tesla.',
      stats: [
        { label: 'Autonomía WLTP', value: 'hasta 629 km' },
        { label: '0–100', value: '4,4 s (LR)' },
        { label: 'Maletero', value: '594 L' },
      ],
    },
    {
      id: 'ioniq',
      name: 'Hyundai Ioniq 6',
      tagline: 'La gota de agua: menos drag, más km por kWh.',
      stats: [
        { label: 'Autonomía WLTP', value: 'hasta 614 km' },
        { label: '0–100', value: '5,1 s (AWD)' },
        { label: 'Maletero', value: '401 L' },
      ],
    },
  ],
  criteria: [
    { id: 'eff', label: 'Eficiencia', hint: 'km reales por kWh, no la cifra del folleto.' },
    { id: 'soft', label: 'Software y OTA', hint: 'El coche como producto que sigue saliendo.' },
    { id: 'charge', label: 'Recarga en viaje', hint: 'Picos, curva y densidad de red.' },
    { id: 'ride', label: 'Conducir cada día', hint: 'Dirección, ruido, visibilidad, asientos.' },
    { id: 'space', label: 'Espacio útil', hint: 'Maletero, plaza trasera, frunk.' },
    { id: 'cost', label: 'Coste de poseer', hint: 'Precio, seguro, ruedas, pérdida de valor.' },
  ],
  scores: [
    { criterionId: 'eff', values: [
      { itemId: 'm3', score: 4, note: 'Muy buena. Highland mejoró consumo; aún no es la reina del Cx.' },
      { itemId: 'ioniq', score: 5, note: 'Cx 0,21. En carretera rápida, gana km reales.' },
    ]},
    { criterionId: 'soft', values: [
      { itemId: 'm3', score: 5, note: 'Autopilot, teatro, OTA de verdad. El salpicadero es el producto.' },
      { itemId: 'ioniq', score: 3, note: 'ccNC competente, mapa y tienda correctos. No es un tesla.' },
    ]},
    { criterionId: 'charge', values: [
      { itemId: 'm3', score: 5, note: 'Supercharger: enchufar y listo. La curva 250 kW aguanta.' },
      { itemId: 'ioniq', score: 4, note: '800 V, picos altos en Ionity. Menos «funciona siempre».' },
    ]},
    { criterionId: 'ride', values: [
      { itemId: 'm3', score: 3, note: 'Rápido y seco. Ruido de rodadura y visibilidad trasera, regular.' },
      { itemId: 'ioniq', score: 4, note: 'Más coche: filtrado, asientos, silencio. La silueta resta visibilidad.' },
    ]},
    { criterionId: 'space', values: [
      { itemId: 'm3', score: 4, note: 'Frunk + maletero generoso. Plaza trasera justa de techo.' },
      { itemId: 'ioniq', score: 3, note: 'El coupé se come el maletero. Detrás, sorprendentemente bien.' },
    ]},
    { criterionId: 'cost', values: [
      { itemId: 'm3', score: 3, note: 'Seguro y neumáticos caros. Reventa, aún fuerte.' },
      { itemId: 'ioniq', score: 4, note: 'Suele salir mejor de precio. Garantía de batería larga.' },
    ]},
  ],
  verdict:
    'Si tu vida es carretera y odias pensar en el cargador, Model 3. Si mides el coche por cómo se siente el asiento y por cuántos kWh gastas de verdad, Ioniq 6. Nadie «gana»: uno compra ecosistema, el otro compra física.',
  winnerId: 'm3',
  prompts: [
    '¿Y si recargo casi siempre en casa?',
    'Incluye el BMW i4 en la comparación.',
    '¿Cuál pierde menos valor a 4 años?',
    'Hazme la versión para familia con un perro.',
  ],
};

export const LUMEN_CUMPLE_CANVAS: Canvas = {
  id: 'sample-cumple',
  createdAt: 0,
  source: { kind: 'sample', raw: 'Planear un cumpleaños de 8 años en casa', title: 'Cumple de 8 años' },
  kind: 'plan',
  title: 'Cumple de 8 años',
  hook: 'Un buen cumple infantil no es más cosas: es un arco de 2,5 horas con un pico y un final limpio.',
  readMinutes: 4,
  occasion: 'Fiesta en casa, 8–10 niños, 2,5 horas.',
  timeframe: 'Sábado, 16:00–18:30',
  phases: [
    {
      title: 'Antes (esta semana)',
      when: 'T−7 a T−1',
      tasks: [
        { id: 'inv', title: 'Invitar por escrito, con hora de recoger', detail: 'Máximo 10. Incluye alergias y «se acaba a las 18:30».' },
        { id: 'food', title: 'Comida que se come con una mano', detail: 'Mini pizzas, fruta en palitos, tarta. Nada de platos hondo.' },
        { id: 'zone', title: 'Una zona sucia, una zona limpia', detail: 'Salón = juegos. Cocina = tarta. Dormitorios, cerrados.' },
      ],
    },
    {
      title: 'La llegada',
      when: '16:00–16:20',
      tasks: [
        { id: 'hello', title: 'Un rito de entrada de 30 segundos', detail: 'Sello en la mano o pegatina. Evita el amontonamiento en el recibidor.' },
        { id: 'free', title: 'Juego libre acotado', detail: 'Legos grandes o pista de coches ya montada. Cero instrucciones.' },
      ],
    },
    {
      title: 'El pico',
      when: '16:20–17:20',
      tasks: [
        { id: 'game1', title: 'Un juego de equipo, no de eliminación', detail: 'Búsqueda del tesoro por pistas. Los que «pierden» en el pilla-pilla lloran.' },
        { id: 'craft', title: 'Un hacer que se llevan a casa', detail: 'Pintar una maceta o una careta. 15 minutos, materiales ya puestos.' },
      ],
    },
    {
      title: 'El cierre',
      when: '17:20–18:30',
      tasks: [
        { id: 'cake', title: 'Tarta, foto, una canción', detail: 'Antes de que baje el azúcar social. Velas reales, no 24.' },
        { id: 'gift', title: 'Abrir regalos en un círculo corto', detail: 'O posponerlo. Nunca en paralelo al caos de la tarta.' },
        { id: 'out', title: 'Bolsas ya listas junto a la puerta', detail: 'A las 18:20 empiezas a entregarlas. El adiós no se improvisa.' },
      ],
    },
  ],
  options: [
    { title: 'Búsqueda del tesoro', body: '6 pistas, última en el jardín o el balcón. Una pista por pareja.', fit: 'Mezcla de tímidos y explosivos.' },
    { title: 'Taller de caretas', body: 'Cartulina precortada, gomas ya grapadas, 4 botes de pintura.', fit: 'Si llueve o el salón es pequeño.' },
    { title: 'Pista de obstáculos', body: 'Cojines, cinta en el suelo, cronómetro. Por turnos, aplauso obligatorio.', fit: 'Energía alta, vecinos pacientes.' },
  ],
  budget: [
    { label: 'Tarta y vela', amount: '35–50 €' },
    { label: 'Comida salada + fruta', amount: '25–40 €' },
    { label: 'Taller / tesoro', amount: '15–25 €' },
    { label: 'Bolsas de salida', amount: '20–30 €' },
  ],
  risks: [
    { risk: 'Un niño no quiere jugar', ifHappens: 'Rincón de «cuartel general» con papel y un adulto cerca. No se le obliga al pico.' },
    { risk: 'Alergia no anunciada', ifHappens: 'Ingredientes impresos en un papel. Un tupper de fruta limpia de reserva.' },
    { risk: 'Los padres se quedan', ifHappens: 'Café en la cocina, no en el salón. La fiesta es de los niños.' },
  ],
  prompts: [
    'Hazlo para 4 niños, más íntimo.',
    'Presupuesto máximo 80 euros.',
    'Uno de los niños es autista: ajusta el pico.',
    'Versión en un parque, no en casa.',
  ],
};

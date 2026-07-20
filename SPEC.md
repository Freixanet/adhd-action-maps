# NUCLEO — DOCUMENTO MAESTRO DE DESARROLLO

Versión 1.1 · Este documento es la única fuente de verdad. Si el código contradice este documento, el código está mal.

---

## CÓMO USAR ESTE DOCUMENTO (instrucciones para Marc, no para el agente)

1. Pega este documento completo en el contexto del agente (Cursor Composer / Antigravity) al inicio de CADA sesión, o guárdalo como `SPEC.md` en la raíz del repo y referéncialo.
2. Cada sesión ejecuta UNA fase del BACKLOG (sección 9). Instrucción exacta a escribir:
  `Lee SPEC.md completo. Ejecuta la FASE X del backlog. Sigue el PROTOCOLO DE TRABAJO (sección 1) sin excepciones. No toques nada fuera del alcance de la fase.`
3. Al terminar cada fase, verifica los CRITERIOS DE ACEPTACIÓN de esa fase antes de pasar a la siguiente. Si alguno falla, instrucción: `El criterio [N] de la FASE X falla: [describe qué ves]. Corrígelo sin modificar nada más.`
4. Nunca pidas "mejora la app" en genérico. Siempre fase concreta o criterio concreto.

---

## 1. PROTOCOLO DE TRABAJO (obligatorio para el agente en toda sesión)

1. **Antes de escribir código:** lista los archivos del repo relevantes a la fase (`ls` / lectura de árbol). Lee los archivos que vas a modificar COMPLETOS antes de editarlos. No asumas su contenido.
2. **Primera sesión de todas (FASE 0):** genera `ARCHITECTURE.md` en la raíz con: stack detectado, estructura de carpetas, componentes de pantalla existentes y qué archivo corresponde a cada pantalla de la sección 5. Las sesiones futuras leerán este archivo para orientarse.
3. **Diffs mínimos:** modifica solo lo que la fase exige. Prohibido refactorizar, renombrar o "limpiar" código fuera del alcance de la fase.
4. **Prohibido inventar:** si falta información (una API key, un endpoint, un asset), DETENTE y pregunta. No crees placeholders silenciosos ni datos falsos.
5. **Prohibido:** comentarios explicativos en código, `console.log` residuales, TODOs, código muerto, dependencias nuevas no listadas en la fase.
6. **Un commit lógico por fase.** Mensaje: `feat(faseN): descripción corta`.
7. **Verificación:** al terminar, ejecuta build/compilación (`npm run lint` en `mobile/` y en la raíz; build de web si la fase toca `src/`). Si falla, corrige antes de reportar. Reporta: archivos tocados + qué criterio de aceptación cumple cada cambio. Nada más.
8. **Todos los strings de UI en español de España.** Tono: directo, sin exclamaciones, sin emojis en la UI.



### 1.5 Dependencias aprobadas (excepciones al punto 5)

El punto 5 prohíbe dependencias nuevas no listadas en la fase. Las siguientes están aprobadas explícitamente como excepción y pueden usarse en cualquier fase:

- **Menús nativos (**`@react-native-menu/menu`**):** para selectores que abren menú contextual/desplegable nativo anclado al disparador (estilo Grok/Gemini), con blur del sistema, títulos + subtítulos (iOS 15+) e indicador de selección nativo (`state`). Usa `UIMenu` de UIKit (sin SwiftUI). Uso actual: chip de profundidad en el composer (`DepthMenu.tsx`). Requiere dev client (no Expo Go) y rebuild nativo tras instalar. 

---



## 2. CONTEXTO DE PRODUCTO (leer, no implementar)

nucleo convierte fuentes densas (texto, URL, YouTube, PDF, imagen) en **Núcleos**: lecturas estructuradas, guiadas y acabables. Usuario objetivo: personas con sobrecarga de información, diseño nacido de necesidades TDAH (chunking, poco ruido, progresión visible, finales claros).

Principios de producto que gobiernan toda decisión:

- **P1 Fidelidad:** la app nunca inventa contenido que la fuente no dice. Los límites se declaran (bloque "Síntesis por brevedad", etc.).
- **P2 Estructura fija:** todo Núcleo tiene: Idea central → En 60 segundos → Pasos guiados → Cierre "Para recordar". Sin variaciones.
- **P3 Acabable:** tiempo estimado siempre visible, progreso siempre visible, final claro siempre alcanzable.
- **P4 Cero fricción de entrada:** máximo 0 decisiones obligatorias antes del primer resultado. Todo tiene default.
- **P5 Una acción primaria por pantalla.** Nunca dos botones con el mismo peso visual.

Renombrado global: el término "mapa" se sustituye por **"Núcleo"** (plural "Núcleos") en TODA la UI, notificaciones y exports. "Nuevo mapa" → "Nuevo Núcleo". "Mapa completado" → "Núcleo completado". "Completar mapa" → "Completar".

La variante **Clásica** (`mobile/src/screens/classic/`, `src/ClassicApp.tsx`) está descatalogada: se retira del selector de Ajustes y no recibe ningún trabajo de este backlog.

---



## 3. DESIGN SYSTEM (valores exactos, sin desviación)



### 3.1 Color


| Token            | Hex     | Uso                                        |
| ---------------- | ------- | ------------------------------------------ |
| `bg-base`        | #181A1F | Fondo global                               |
| `bg-surface`     | #24262D | Cards, sidebar, input                      |
| `bg-surface-2`   | #2C2E37 | Cards anidadas, chips inactivos            |
| `text-primary`   | #FAFAFA | Títulos, idea central                      |
| `text-body`      | #D4D4DC | Cuerpo de texto                            |
| `text-secondary` | #9CA0AB | Metadata, labels, placeholders             |
| `accent`         | #8B8FF5 | CTA primario, progreso, links, paso activo |
| `accent-pressed` | #7A7EE0 | Estado pressed del CTA                     |
| `sem-clave`      | #8B8FF5 | Acento bloque IDEA CLAVE                   |
| `sem-matiz`      | #E0B45C | Acento bloque MATIZ                        |
| `sem-ejemplo`    | #6FBF8F | Acento bloque EJEMPLO                      |
| `sem-alerta`     | #E07A6B | Acento bloque LÍMITE/ALERTA                |


Reglas: los acentos semánticos SOLO se usan en (a) el label del bloque y (b) un tinte de fondo del 5%. El fondo base del bloque es siempre `bg-surface`. Ningún color fuera de esta tabla en toda la app. Contraste mínimo: `text-secondary` sobre `bg-base` debe pasar WCAG AA (4.5:1) — los valores dados ya lo cumplen, no los oscurezcas.

### 3.2 Tipografía

Familia: la del sistema (SF Pro en iOS / Roboto en Android / Inter en web). Escala única:


| Rol       | Tamaño/peso                                          | Uso                                       |
| --------- | ---------------------------------------------------- | ----------------------------------------- |
| `display` | 28px / bold                                          | Idea central, título de Núcleo completado |
| `title`   | 22px / semibold                                      | Título de paso                            |
| `body`    | 17px / regular / line-height 1.55                    | Todo el cuerpo                            |
| `label`   | 13px / semibold / letter-spacing 0.08em / MAYÚSCULAS | IDEA CLAVE, PASO 1 DE 3, categorías       |
| `meta`    | 14px / regular                                       | Tiempos, fuente, fechas                   |


Toda la escala tipográfica escala con Dynamic Type hasta XL.

### 3.3 Espaciado y forma

- Escala de espaciado: 4, 8, 16, 24, 32. Ningún valor fuera de escala.
- Radius: 16px cards, 12px chips, 24px botones de paso (primario y secundario glass), CTA primario e input.
- Padding horizontal global de pantalla: 20px.
- CTA primario de paso: alto 52px, ancho completo menos padding, radius 24px, fondo `#6A6FE0`, texto `#FFFFFF` semibold. Secundario de paso: mismo alto y radius 24, material glass.
- Safe areas: todo elemento fijo inferior respeta `safe-area-inset-bottom` + 8px. **Bug conocido: el CTA "Empezar a leer" queda cortado — corregir.**



### 3.4 Marca

- El glifo actual (átomo con órbitas) es el logo de React. Sustituir en icono de app, sidebar y splash por: **círculo exterior de trazo fino (1.5px) con un disco central sólido pequeño** (metáfora núcleo). Sin órbitas.
- El orbe animado de la pantalla de carga se mantiene, pero su interior usa el nuevo glifo.
- Wordmark: "nucleo" en minúsculas, tracking amplio (0.35em), `text-secondary`. Se mantiene.



### 3.5 Movimiento

- Transición entre pasos: slide horizontal 250ms ease-out.
- Check de paso completado: scale 0.8→1 con haptic `light`.
- Núcleo completado: haptic `success` + fade-in del título.
- Cierre de sección (Núcleos de ≥6 pasos, ver §4 y §6.1): check de mini-completado + haptic `light`.
- Respetar `prefers-reduced-motion`: si activo, sustituir todo por fades de 150ms.
- Nada más se anima. Prohibidas animaciones decorativas adicionales.

---



## 4. MODELO DE DATOS (referencia para todas las fases)

```
Nucleo {
  id: string
  titulo: string
  categoria: enum Categoria
  tipoFuente: enum { texto, enlace, youtube, pdf, imagen }
  urlFuente: string | null
  modo: enum { entender, aplicar }
  profundidad: enum { rapido, estandar, profundo }
  ideaCentral: { titulo: string, subtitulo: string, minutosEstimados: number }
  fuenteDetectada: { descripcion: string, limites: string[] }   // P1 Fidelidad
  en60segundos: { titulo: string, texto: string }[]              // 3 items exactos
  visualizacion: {
    tipo: enum { flujo, ciclo, comparacion, jerarquia }
    titulo: string
    items: { id: string, etiqueta: string, detalle: string }[]   // 3-5 nodos
  }
  pasos: Paso[]                                                  // máximo 9 en toda profundidad
  secciones: { titulo: string, desdePaso: number, hastaPaso: number }[] | null
                                                                 // solo si pasos.length >= 6: 2-3 secciones
  paraRecordar: string[]                                          // 3-4 bullets
  progreso: { pasoActual: number, completado: boolean, actualizadoEn: timestamp }
  fijado: boolean
  creadoEn: timestamp
  coleccionId: string | null                                      // ver 6.7
}

Paso {
  titulo: string
  cuerpo: string
  minutosEstimados: number
  bloque: { tipo: enum { clave, matiz, ejemplo, alerta }, texto: string } | null
  autochequeo: string | null    // pregunta de comprensión, colapsada por defecto
}

Coleccion {                                                       // ver 6.7
  id: string
  titulo: string
  nucleoIds: string[]           // orden de lectura
  creadoEn: timestamp
}

enum Categoria: DesarrolloPersonal | IATecnologia | Negocio | Productividad |
                SaludCiencia | FinanzasLegal | Aprendizaje | Otros
```

Categorías: taxonomía CERRADA de 8. El usuario no puede crear categorías. La clasificación la hace el LLM en generación (ver 6.2). Override manual permitido (ver 5.6).

---



## 5. ESPECIFICACIÓN POR PANTALLA



### 5.1 Home

Layout de arriba a abajo:

1. Header: botón menú (izq). El header NO contiene el selector de modo (ver punto 3).
2. Zona central (scrollable):
  - Si existe ≥1 Núcleo incompleto: card "Continuar" — título del Núcleo, `Paso X de Y · ~N min restantes`, barra de progreso fina en `accent`. Tap → abre en el paso donde quedó. Esta card es el elemento más prominente de la pantalla.
  - Debajo: sección "Recientes" con máximo 3 items (label categoría + título + metadata). Tap → abre.
  - Si NO hay ningún Núcleo (primer uso): wordmark + tagline "Separa lo importante del ruido." + chip centrado "Ver un ejemplo →" que abre un Núcleo demo pregenerado y empaquetado con la app (contenido: cualquier artículo corto de dominio público sobre hábitos o atención).
3. Zona inferior fija: caja de input.
  - Placeholder ESTÁTICO: "Pega texto, un enlace o adjunta un archivo". Los ejemplos rotatorios solo existen en el estado de primer uso (cero Núcleos), una única pasada, y nunca vuelven a rotar.
  - **Altura del campo de texto:** en reposo, 3 líneas (~88px). Crece con el contenido hasta el 40% del viewport; al superar ese tope, el texto scrollea dentro del campo (no expande más el composer).
  - **Pegado largo:** si el usuario pega texto de más de 500 caracteres, el contenido NO permanece en el input: se colapsa a un chip adjunto dentro del composer, mismo patrón visual que un archivo ("Texto · N palabras" + ✕ para quitar). El input queda libre; el envío usa el texto del chip.
  - Borde 1px `accent` al 35% de opacidad en reposo, 100% al enfocar. Debe verse activa, nunca disabled.
  - Dentro de la caja: botón `+` (adjuntar archivo/imagen/PDF), selector segmentado compacto `Entender | Aplicar`, chip de profundidad, botón enviar (círculo `accent`, activo solo con contenido).
  - **Chip de profundidad:** muestra siempre la selección actual (default Estándar). Al tap NO cicla: abre un action sheet nativo con las 3 opciones y su descripción — "Rápido — 3 pasos, ~1 min", "Estándar — 4-6 pasos, ~3 min", "Profundo — 7-9 pasos, ~6 min" — con check ✓ en la opción activa. "Profundo" muestra candado 🔒 si el usuario no tiene entitlement Pro y, al tocarlo sin Pro, no cambia la selección (deriva al aviso de upsell). En iOS usa `ActionSheetIOS`; en Android, `Alert` con las mismas opciones.
  - **Preselección automática de modo:** al detectar la fuente, si es manual / how-to / libro de negocio → preseleccionar Aplicar; si es ensayo / noticia / paper → preseleccionar Entender. La preselección es visible en el selector y cambiable con un tap. Si el usuario cambia el modo manualmente para esa fuente, su elección manda.
  - Autodetección de tipo de fuente al enviar (regex URL / dominio YouTube / mimetype archivo / fallback texto). El usuario NUNCA elige tipo manualmente.
4. Eliminar el texto "Vista de carga" de la home.
5. **Borrador persistente:** el texto del composer y los adjuntos seleccionados se guardan localmente al perder foco o pasar a background, y se restauran al reabrir la app. Se limpian al enviar o al borrar manualmente.



### 5.2 Generación inline (home)

Flujo normal en `InputScreen` (sin pantalla de carga aparte). Layout **efímero**: como máximo una burbuja de usuario + un bloque nucleo; al abrir el Núcleo o volver a home queda la home limpia (wordmark + tagline + composer habilitado).

**Al enviar:** `Keyboard.dismiss()`. Wordmark + tagline centrales desaparecen (fade 150ms). El composer permanece abajo, vacío y deshabilitado (opacity 0.5, no editable).

**Área central (ScrollView), de arriba a abajo:**

**Elemento A — Burbuja usuario:** alineada derecha, `maxWidth` 75%, `bg-surface-2`, radius 16, padding 12×16. Contenido: texto → 2 líneas ellipsis `text-body` 15px; link/YouTube → icono 16px `text-secondary` + dominio o «YouTube» + título si existe, 1 línea; PDF/imagen → icono + nombre truncado 24 chars + tamaño (`PDF · guia.pdf · 5,9 MB`). Entrada fade + translateY(8→0) timing 200ms ease-out (sin spring).

**Elemento B — Bloque nucleo** (250ms después de A): alineado izquierda, sin fondo. Fila 1: label `nucleo` (`label` 13px mayúsculas, `text-secondary`). Fila 2: mensaje conversacional aleatorio fijo al montar («Perfecto, voy con ello.» / «Dame un momento y te lo preparo.» / «Recibido, me pongo con ello.»), `text-body` 17px `text-primary`, fade + translateY(6→0) 200ms; no cambia hasta el final. Fila 3 (600ms tras Fila 2 **o** primer evento del stream, lo que ocurra antes): fase actual reutilizando `LoadingPhaseLabel` + lógica real de `loadingGenerationUi` (`Analizando…` → `Leyendo…` → `Destilando…` → `Construyendo…`), crossfade 200ms, `meta` 14px `text-secondary`. Fila 4: `GenerationProgressBar` existente (200px, `streamProgressShared`), 8px bajo Fila 3.

**Al `done` del stream:** Filas 3–4 fade-out 200ms y se desmontan. En el mismo hueco: orbe `ExactLiquidOrbWebView` 72px (scale 0.6→1 + fade, spring d26/s300) + haptic light al montar; a la derecha (gap 12) título `title` 17px semibold máx 2 líneas + meta `~N min · X pasos`. Fila orbe+título = `Pressable` único → `measureInWindow` → `ContinueExpandTransition` hacia `ResultScreen` (igual que chip Continuar).

**Auto-open:** timer 4000ms al montar el orbe. Si expira con `AppState === 'active'` y sin interacción → misma apertura. Si `AppState !== 'active'` al expirar → cancelar definitivamente. Cualquier tap cancela el auto-open.

**Error:** Filas 3–4 sustituidas por `SessionErrorBanner` inline con Reintentar (restaura Filas 3–4). La burbuja no se toca.

**Reduced motion:** entradas fade 150ms sin translate ni spring; auto-open igual.

**Colecciones:** si el analyze propone división y el usuario acepta, usar `LoadingScreen` actual (§6.7). El Alert de división puede aparecer sobre este layout durante «Analizando la fuente…».



### 5.3 Introducción del Núcleo

Como el diseño actual (correcto), con cambios:

1. Página 1: label `IDEA CENTRAL` + chip tiempo total → titular display → subtítulo → card FUENTE DETECTADA (con límites, borde izq `sem-alerta` 3px) → CTA fijo "Ver mapa visual".
2. Corregir bug del CTA cortado (safe area, ver 3.3).
3. Los límites dentro de FUENTE DETECTADA usan icono ⓘ y `text-secondary`; el label del bloque usa `sem-alerta`.
4. Página 2: un único mapa visual interactivo que representa la relación dominante del Núcleo (flujo, ciclo, comparación o jerarquía), con 3-5 nodos seleccionables y un solo detalle contextual. La primera selección ya es útil sin interacción. Debajo, bloque plano `HILO CONDUCTOR`. Los Núcleos guardados sin `visualizacion` derivan un flujo compatible desde `en60segundos`.



### 5.4 Lectura por pasos

1. Header: menú + `Paso X de Y` + botón "Vista completa". Barra de progreso fina bajo el header, fill `accent`, animada al avanzar.
2. Contenido: label `PASO X DE Y ~N min` → título del paso → cuerpo → bloque semántico (si existe) con borde izq de su color según tipo.
3. Si `autochequeo` existe: bajo el bloque, elemento colapsado "¿Te lo quedas? Compruébalo →" que al tap expande la pregunta. Sin validación de respuesta; es autoevaluación mental.
4. Footer fijo: `Atrás` (secundario) + `Siguiente →` (primario). En el último paso: `✓ Completar`.
5. Gestos: swipe izquierda = siguiente, swipe derecha = atrás. Haptic `light` en cada avance.
6. Al avanzar de paso, persistir `progreso` inmediatamente (la reanudación depende de esto).
7. Junto a la barra de progreso, texto `meta`: "~N min restantes" (suma de pasos pendientes).
8. **Secciones (Núcleos de ≥6 pasos):** los pasos se agrupan en 2-3 secciones (ver §4 y §6.1). Al completar el último paso de una sección: check de mini-completado + haptic `light` antes de entrar en la sección siguiente. El label de paso muestra la sección activa ("SECCIÓN 2 · PASO 5 DE 9").
9. Máximo absoluto: 9 pasos por Núcleo en toda profundidad.



### 5.5 Núcleo completado

1. Label `NÚCLEO COMPLETADO` con check → título display → párrafo de cierre → sección plana PARA RECORDAR (bullets `accent`) → cobertura de fuente y secciones de conocimiento en secciones planas (sin tarjetas glass apiladas).
2. Jerarquía de acciones: fila "Repasar lo esencial" | "Preguntar"; ancho completo "Guardar ficha PDF"; CTA primario único al final "Nuevo Núcleo" (`accent`). Sin "Volver al inicio" (sidebar accesible desde la barra superior).
3. Haptic `success` al entrar por primera vez.



### 5.6 Sidebar / Historial

1. Estructura actual (índice del Núcleo abierto + FIJADOS + RECIENTES) se mantiene.
2. Cada item: label categoría (`label`, en `text-secondary`) + título + metadata `tipoFuente · fecha relativa`.
3. Long-press en un item → action sheet: Fijar/Desfijar, Cambiar categoría (lista de las 8), Exportar PDF, Eliminar (con confirmación).
4. Botón búsqueda (lupa) abre 5.7.



### 5.7 Búsqueda y filtros

1. Barra de búsqueda arriba (autofocus, busca en título + ideaCentral, resultados en vivo).
2. Debajo: fila horizontal scrollable de chips con las 8 categorías + chip "Incompletos". Tap = filtro activo (chip con fondo `accent` al 20% y borde `accent`), tap de nuevo = quitar. Filtros combinables (categoría + texto + incompletos).
3. Sin filtros ni texto: mostrar todos los Núcleos por fecha descendente.
4. Estado vacío: "Nada por aquí. Prueba con otra categoría."



### 5.8 Paywall (ver 6.5)

Pantalla modal: título "nucleo pro" → 4 beneficios en lista con check `accent` (Núcleos ilimitados / Profundidad Profunda / Preguntar sobre la fuente / Ficha PDF sin marca de agua + export HTML) → precio mensual y anual (anual destacado con "2 meses gratis"; referencia de producto: 6,99 €/mes y 59,99 €/año — los IDs se crean en App Store Connect en la fase de monetización; la app lee importes de RevenueCat, nunca hardcodea) → CTA "Probar 7 días gratis" → fila `meta` con tres links: "Restaurar compra · Términos · Privacidad" (obligatorio App Store 3.1.2; los dos últimos abren web). Bajo el CTA, texto `meta`: precio, duración y "se renueva automáticamente, cancela cuando quieras". Sin timers falsos ni dark patterns.

---



## 6. FUNCIONALIDADES TRANSVERSALES



### 6.1 Pipeline de generación

Entrada: fuente + modo + profundidad. Salida: objeto `Nucleo` completo (sección 4) vía LLM con salida JSON estricta validada contra el esquema. Si el JSON no valida: 1 reintento con el error incluido en el prompt; si vuelve a fallar, error de 5.2. Reglas del prompt de generación (P1): prohibido añadir información externa a la fuente; los vacíos se declaran en `fuenteDetectada.limites`; `en60segundos` exactamente 3 items; una `visualizacion` con una sola relación dominante, tipo semántico y 3-5 nodos breves sin métricas inventadas; `paraRecordar` 3-4 bullets; nº de pasos según profundidad: rápido 3, estándar 4-6, profundo 7-9. **Máximo absoluto 9 pasos en toda profundidad.** Si el Núcleo resultante tiene ≥6 pasos, el LLM devuelve además `secciones` (2-3 grupos con título) para el mini-completado de 5.4.8. Fuentes que pidan más de 9 pasos: ver Colecciones (6.7).

### 6.2 Categorización automática

En la misma llamada de generación, el LLM asigna `categoria` eligiendo OBLIGATORIAMENTE una de las 8 del enum (incluir el enum literal en el prompt). Si devuelve otra cosa, mapear a `Otros`.

### 6.3 Export ficha PDF — GRATIS

Una página. Contenido: wordmark nucleo (esquina sup.) → título → idea central → los 3 de EN 60 SEGUNDOS → PARA RECORDAR → pie: "Generado con nucleo" + URL de la app. Misma paleta del design system sobre fondo #0B0B0E. Tipografía embebida. Compartir vía share sheet nativo.

- **Free:** la ficha PDF es gratuita SIEMPRE, con branding nucleo (wordmark + pie con link) como marca de agua.
- **Pro:** quita la marca de agua (se conserva un pie discreto opcional) y añade **export HTML autocontenido**.



### 6.4 Share Extension (captura externa)

Target de Share Extension iOS que acepta URL, texto y PDF desde cualquier app. Flujo: usuario comparte → extensión guarda la fuente en cola compartida (App Group) con modo/profundidad por defecto → la app procesa al abrirse o en background si es posible → notificación local "Tu Núcleo sobre [título] está listo". La extensión muestra solo confirmación mínima: "Añadido a nucleo ✓" y se cierra. Cero configuración dentro de la extensión.

### 6.5 Monetización (RevenueCat)

- Free: 3 Núcleos/día (contador con **reset a las 04:00 hora local**, no a medianoche), profundidades Rápido y Estándar, historial completo, ficha PDF con marca de agua (6.3).
- Pro: ilimitado, Profundo, Preguntar, PDF sin marca de agua + export HTML. Mensual 6,99 € y anual 59,99 € (referencia de producto; los IDs se crean en App Store Connect en la fase de monetización; el código lee los productos de RevenueCat, nunca hardcodea importes).
- Triggers del paywall (únicos): intento del 4º Núcleo del día / tap en Profundo / tap en Preguntar. NUNCA al abrir la app ni interrumpiendo lectura. La ficha PDF NO es trigger de paywall.
- SDK: RevenueCat. Entitlement único: `pro`.



### 6.6 Retención ligera

- Notificación local por Núcleo incompleto: se programa 24h después de abandonarlo, pero se **entrega en la franja 18:00–21:00 local más próxima** al momento programado. Texto: "Te quedaban ~N min de '[título]'". Máximo 1 notificación pendiente a la vez. Opt-in con el prompt de sistema, pedido tras completar el primer Núcleo (nunca al primer arranque).
- En Home, bajo Recientes, línea `meta`: "N Núcleos esta semana" (solo si N ≥ 2). Sin rachas punitivas, sin fuego, sin badges.



### 6.7 COLECCIONES (fuentes largas)

- Si la fuente supera ~15.000 palabras o es un PDF con capítulos detectables, la app propone antes de generar: **"Esta fuente es larga. ¿La divido en X Núcleos?"** con default **Sí**.
- Resultado: una **Colección** = grupo de Núcleos (uno por capítulo/parte, cada uno de 3-9 pasos), modelo `Coleccion` de §4.
- Progreso agregado visible: "4/11 Núcleos".
- Agrupación visual en sidebar e historial: la Colección es un item expandible que contiene sus Núcleos; el progreso agregado se muestra en el item.
- Si el usuario responde No: se genera un único Núcleo con máximo 9 pasos y los límites de síntesis declarados en `fuenteDetectada.limites` (P1).

---



## 7. REGLAS DE CALIDAD GLOBALES

1. Contraste AA en todo texto (verificar `text-secondary` en cada fondo).
2. Áreas táctiles mínimas 44×44pt.
3. Todo estado tiene diseño: cargando, error, vacío, sin conexión ("Sin conexión. Tus Núcleos guardados siguen disponibles.").
4. Persistencia local primero: los Núcleos se guardan en el dispositivo; la app funciona offline para leer.
5. Ningún dato del usuario sale del dispositivo salvo la fuente enviada al LLM.
6. Textos de UI: sentence case, verbos activos, el botón dice lo que hace ("Guardar ficha PDF", no "Exportar").
7. **Toda la escala tipográfica escala con Dynamic Type hasta XL.**
8. **Privacidad y residencia de datos:** almacenamiento en UE (Supabase, AWS eu-west). Las fuentes se envían a Google Gemini API únicamente para generar el Núcleo; la política de privacidad declara que no se usan para entrenamiento (condición garantizada con tier de API de pago en producción — bloqueante pre-lanzamiento en PLAN.md P10).

---



## 8. FUERA DE ALCANCE (prohibido implementar aunque parezca buena idea)

Chat abierto general, flashcards/spaced repetition, colaboración/multiusuario, temas de color alternativos, modo claro, categorías personalizadas, gamificación con puntos/niveles, feed social, onboarding de más de 1 pantalla.

Reservado para **v1.1** (no implementar ahora): export HTML autocontenido (solo el gate Pro de 6.3 lo menciona; la implementación es v1.1), **fuente de audio (notas de voz, podcasts) vía transcripción**.

Widget iOS, App Intents/Siri, universal links con dominio, layout iPad: descartados para v1 por coste/impacto (auditoría jul 2026). Localización EN ya estaba fuera; se reafirma.

---



## 9. BACKLOG POR FASES (una fase = una sesión)

Convención de estado: **[HECHO]** = ya se cumple en el código actual, no repetir trabajo; **[PARCIAL]** = existe base, falta ajuste; sin marca = pendiente.

### FASE 0 — Inventario + Design System

Alcance: generar `ARCHITECTURE.md` (protocolo §1.2). Migrar `shared/uiTokens.ts` + `mobile/tailwind.config.js` a los tokens de la sección 3 (app solo oscura; retirar toggle de tema y variante Clásica del menú de Ajustes). Refactorizar TODOS los colores, tamaños y espaciados hardcodeados a tokens. Sustituir glifo React por glifo núcleo (3.4) en sidebar, splash y `mobile/assets/icon.png` (AppIcon). Renombrado global "mapa"→"Núcleo" en todos los strings de UI.  
Aceptación:  
(1) `grep` de hex colors fuera del archivo de tokens devuelve 0 resultados en vistas — *hoy hay ~35 hex distintos en ~95 puntos de mobile/src (ver docs/ui-audit/aesthetics.md apéndice C)*;  
(2) ningún string "mapa" visible en UI;  
(3) glifo React ausente en UI **y** en `mobile/assets/icon.png`;  
(4) ni el toggle de tema ni la opción "Clásica" aparecen en Ajustes;  
(5) build OK (`npm run lint` en mobile/ y raíz).

### FASE 1 — Fixes críticos de lectura

Alcance: safe-area del CTA en 5.3; contraste según tabla 3.1; bloques semánticos con borde izq 3px y label coloreado según tipo (clave/matiz/ejemplo/alerta); "~N min restantes" junto a progreso; swipe entre pasos; haptics (3.5); persistencia de progreso al avanzar paso.
Aceptación:
(1) CTA visible completo en iPhone con home indicator;
(2) los 4 tipos de bloque se distinguen por color a simple vista — *[PARCIAL] hoy existen 3 callouts (action/info/alert) sin sistema de borde 3px*;
(3) swipe funciona en ambas direcciones — *pendiente, no hay gesto hoy*;
(4) matar la app a mitad de lectura y reabrir conserva el paso exacto — **[HECHO]** *(history store persiste currentStep; verificar solamente)*;
(5) haptic light al avanzar paso — **[HECHO]** *(stepHaptic)*.

### FASE 2 — Home (5.1) + Generación (5.2)

Alcance: implementar 5.1 completo (card Continuar, Recientes, primer uso con demo empaquetado, mover Entender|Aplicar + chip de profundidad al interior de la caja de input con ciclado al tap, preselección automática de modo por fuente, placeholder estático, ejemplos rotatorios solo primer uso una pasada, eliminar "Vista de carga") y 5.2 (estados de progreso reales con los 3 textos nuevos, streaming de ideaCentral, pantalla de error con reintento).
Aceptación:
(1) con un Núcleo a medias, la card Continuar aparece y abre en el paso correcto;
(2) primer arranque muestra demo funcional sin red;
(3) pegar URL de YouTube la detecta sin selección manual — **[HECHO]** *(urlDetection en AppSessionContext)*;
(4) idea central visible <5s con fuente de texto corta — **[PARCIAL]** *(streaming SSE ya implementado; medir y ajustar textos de fase)*;
(5) apagar red y enviar → error con Reintentar, no pantalla en blanco — **[PARCIAL]** *(SessionErrorBanner existe; verificar copy y flujo completo)*;
(6) el selector de modo está dentro de la caja de input y la preselección automática cambia visiblemente al detectar la fuente.

### FASE 3 — Completado (5.5) + Sidebar (5.6) + Búsqueda (5.7)

Alcance: jerarquía de CTAs del completado (1 primario + 1 secundario + menú ···); long-press con action sheet (añadir Exportar PDF al menú existente); chip "Incompletos" en filtros; búsqueda también sobre ideaCentral; estados vacíos.
Aceptación:
(1) completado tiene exactamente 1 CTA primario visible — *hoy hay 5 botones apilados*;
(2) cambiar categoría desde long-press se refleja al instante en listas y filtros — **[HECHO]** *(HistoryEntryGlassMenu + CategoryEditSheet)*;
(3) filtro categoría+texto combinados devuelve resultados correctos — **[PARCIAL]** *(búsqueda y chips existen; falta chip Incompletos y combinación verificada)*;
(4) eliminar pide confirmación — **[HECHO]** *(Alert en HistorySheet)*.

### FASE 4 — Pipeline robusto (6.1, 6.2)

Alcance: salida JSON estricta validada contra esquema de sección 4 con reintento; reglas de fidelidad P1 en el prompt; categorización con enum cerrado de 8 y fallback a Otros (retirar categorías personalizadas); nº de pasos por profundidad con **tope 9**; generación de `secciones` cuando pasos ≥6 y mini-completado renderizado (5.4.8); campo `autochequeo` generado y renderizado colapsado (5.4.3). Migración one-shot al cargar historial: todo Núcleo persistido (AsyncStorage y Supabase) cuya categoria no pertenezca al enum de §4 se reescribe a Otros. Actualizar buildDepthContract() en server.ts: eliminar rangos >9 pasos y la instrucción «decenas». Endurecer la entrada del pipeline en server.ts: (a) truncar la fuente a 120.000 caracteres con aviso en `limitations`; (b) envolver el contenido de usuario en delimitadores `<<<FUENTE>>>…<<<FIN_FUENTE>>>` con instrucción de ignorar órdenes internas, y en imagen/vídeo el contrato va siempre antes del texto del usuario; (c) validar `type` contra enum y `mimeType` contra allowlist (pdf, jpeg, png, webp, mp4); (d) capturar fallos de JSON.parse y reintentar 1 vez incluyendo el error, luego error tipado 5.2; (e) timeout de 120 s (profundo) / 60 s (resto) en llamadas al LLM; (f) si YouTube no tiene transcripción, error tipado "Este vídeo no tiene transcripción disponible" sin reintento.
Aceptación:
(1) 10 generaciones seguidas con fuentes variadas → 0 crashes por JSON inválido — **[PARCIAL]** *(structured output + repair ya existen; validar contra el esquema nuevo)*;
(2) toda categoría asignada pertenece al enum — **[PARCIAL]** *(resolveMapCategory con fallback existe; cerrar taxonomía)*;
(3) profundidad Rápido produce exactamente 3 pasos;
(4) ningún Núcleo supera 9 pasos, y con ≥6 pasos aparecen 2-3 secciones con mini-completado (check + haptic light);
(5) autochequeo aparece colapsado y expande al tap.
(6) Tras migrar, un Núcleo con categoría personalizada preexistente aparece como Otros en historial, filtros y selector; collectUserCategories() no devuelve categorías ajenas al enum.
(7) buildDepthContract('profundo') no contiene «decenas» ni rangos superiores a 9 pasos.
(8) Existe suite Vitest en raíz con tests verdes para: normalización/validación del JSON del mapa contra el esquema §4 (fixtures válido, inválido y truncado), migración de categorías a Otros, y parseo del stream NDJSON; `npm test` pasa en CI local.

### FASE 5 — Colecciones (6.7)

Alcance: detección de fuente larga (~15.000 palabras o PDF con capítulos detectables); diálogo "Esta fuente es larga. ¿La divido en X Núcleos?" con default Sí; modelo `Coleccion`; generación de un Núcleo por capítulo/parte (3-9 pasos cada uno); progreso agregado "X/Y Núcleos"; agrupación visual expandible en sidebar e historial.
Aceptación:
(1) un PDF de libro con capítulos dispara la propuesta de división;
(2) aceptar crea una Colección navegable con un Núcleo por capítulo;
(3) el progreso agregado se actualiza al completar cada Núcleo;
(4) rechazar genera un único Núcleo de máximo 9 pasos con límites declarados;
(5) la Colección se agrupa visualmente en el sidebar con su progreso.

### FASE 6 — Ficha PDF (6.3)

Alcance: rediseñar el PDF existente según spec (paleta 3.1 sobre #0B0B0E, tipografía embebida, wordmark + pie "Generado con nucleo" + URL como branding free); share sheet; sin gate de paywall (es gratis). El "sin marca de agua" Pro se activa en FASE 7.
Aceptación:
(1) PDF renderiza con paleta y tipografía correctas en visor iOS;
(2) contenido coincide con el Núcleo (título, idea central, EN 60 SEGUNDOS, PARA RECORDAR);
(3) compartir por share sheet funciona — **[HECHO]** *(expo-sharing ya integrado; verificar tras rediseño)*;
(4) la ficha se genera sin cuenta Pro y muestra el branding nucleo.

### FASE 7 — Monetización (6.5 + 5.8)

Alcance: integrar RevenueCat, entitlement `pro`, contador 3/día con **reset a las 04:00 hora local** — **verificado en servidor**: `/api/transform` y `/api/maps/:id/chat` exigen JWT de Supabase; el contador vive en Postgres por userId (el cliente solo lo refleja); los 3 triggers del paywall (4º Núcleo / Profundo / Preguntar), pantalla paywall completa con productos reales (referencia 6,99 €/mes y 59,99 €/año; IDs en App Store Connect; importes leídos de RevenueCat) y restaurar compra, retirada de marca de agua del PDF con entitlement. **Control de coste:** cadena de modelos free = `gemini-3-flash-preview` → `gemini-3.1-flash-lite`; la cadena premium actual (3.5-flash / 3-pro-preview) pasa a ser exclusiva Pro; `maxOutputTokens` de profundo baja de 32768 a 16384; fair use Pro server-side: 30 Núcleos/día y 20 preguntas de chat/día; chat con `maxOutputTokens: 2048`; registrar tokens de entrada/salida reales por petición en tabla `usage`.
Aceptación:
(1) 4º Núcleo del día abre paywall en cuenta free y el contador se reinicia a las 04:00 local, no a medianoche;
(2) compra sandbox desbloquea Profundo y Preguntar al instante y quita la marca del PDF;
(3) restaurar compra funciona tras reinstalar;
(4) ningún precio hardcodeado;
(5) guardar ficha PDF NUNCA abre el paywall.
(6) llamar a /api/transform sin JWT devuelve 401;
(7) el 4º transform del día de un userId free devuelve 402 con código `free_limit` aunque el cliente se manipule;
(8) una cuenta free nunca ejecuta la cadena premium (verificable en header X-Gemini-Model-Used).

### FASE 8 — Share Extension + Notificaciones (6.4, 6.6)

Alcance: target de extensión con App Group y cola compartida; procesamiento al abrir la app (background opcional si el stack lo permite); notificación "Núcleo listo"; notificación de incompleto programada a 24h y **entregada en la franja 18:00–21:00 local más próxima**, límite de 1 pendiente; solicitud de permiso tras primer Núcleo completado. Deep link interno `nucleo://map/:id` que abre el Núcleo indicado (lo usan las notificaciones para llevar al Núcleo correcto). Petición de review nativa (StoreKit requestReview) tras el segundo Núcleo completado con éxito, máximo una vez cada 90 días, nunca tras un error. Si hay trial activo (FASE 7), notificación local el día 5 recordando que el trial acaba.
Aceptación:
(1) compartir URL desde Safari → confirmación mínima → al abrir nucleo el Núcleo se genera/aparece;
(2) dejar un Núcleo a medias produce exactamente 1 notificación, entregada entre las 18:00 y las 21:00 locales;
(3) el permiso de notificaciones se pide tras completar el primer Núcleo, nunca antes.

### FASE 9 — Pulido final

Alcance: `prefers-reduced-motion` en todas las animaciones de 3.5; Dynamic Type hasta XL en toda la escala (§7.7); estados sin conexión; áreas táctiles 44pt auditadas; revisión de todos los strings contra §7.6; barrido de estados vacíos/error faltantes en todas las pantallas. Borrado de cuenta y datos desde Ajustes (Guideline 5.1.1(v)): elimina filas de Supabase, el usuario de auth y el estado local, con confirmación destructiva; junto a él, "Exportar mis datos" (JSON del historial via share sheet). Banner offline global consumiendo NetworkStatusContext con el copy de §7.3 y submit deshabilitado. Aviso si la persistencia local falla (retorno de saveHistory). `ITSAppUsesNonExemptEncryption=false` en app.json. Crash reporting (sentry-expo) y analítica privacy-first sin consentimiento requerido (TelemetryDeck o equivalente UE) con exactamente estos eventos: transform_start, transform_done, transform_fail, step_advance, nucleo_completed, paywall_view, trial_start, subscribe.
Aceptación: checklist de sección 7 completa al 100%, verificada pantalla por pantalla — *[PARCIAL] reduced-motion ya cubre el glass (useGlassAccessibility); offline parcial (@react-native-community/netinfo instalado); Dynamic Type pendiente (tamaños px fijos hoy)*.

---



## 10. PLANTILLAS DE INSTRUCCIÓN PARA SESIONES (copiar/pegar)

**Ejecutar fase:**
`Lee SPEC.md completo. Ejecuta la FASE [N] del backlog. Sigue el PROTOCOLO DE TRABAJO (sección 1) sin excepciones. No implementes nada de la sección 8 (fuera de alcance). Al terminar, reporta archivos tocados y qué criterio de aceptación cumple cada cambio.`

**Corregir criterio fallido:**
`El criterio [N] de la FASE [X] de SPEC.md falla. Comportamiento observado: [descripción]. Comportamiento esperado: [cita del criterio]. Corrige solo esto. Diff mínimo.`

**Bug fuera de fase:**
`Bug: [pantalla, sección de SPEC.md afectada, qué pasa, qué debería pasar según la spec]. Corrige solo esto siguiendo el PROTOCOLO. No toques nada más.`

**Duda del agente (respuesta estándar si el agente pregunta algo que la spec ya cubre):**
`La respuesta está en SPEC.md sección [X]. Reléela y aplica lo que dice literalmente.`

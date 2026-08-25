# S08 visual QA E — checklist

## Vendored PDF.js (gate previo)

| Campo | Valor |
|---|---|
| Paquete | `pdfjs-dist` |
| Versión | **5.4.296** (lockfile) |
| CVE | Corrige CVE-2024-4367 / GHSA-wgrm-67xf-hhpq (mín. 4.2.67) |
| Regenerar | `npm run vendor:pdfjs` |
| Assets | `mobile/assets/pdfjs/pdf.min.mjs.txt`, `pdf.worker.min.mjs.txt` |
| Provenance | `mobile/assets/pdfjs/PROVENANCE.json` + `LICENSE` |

**No** aceptar QA final con 3.11.174.

## Dispositivo

- iPhone con la app Núcleo (cliente de desarrollo).
- Metro recargado desde cero después de estos cambios.

## Cómo elegir Entender o Aplicar (textos visibles)

Arriba a la derecha verás dos botones: **Entender** y **Aplicar**. El que esté
seleccionado es el que se enviará al pulsar el botón de enviar (flecha) abajo.

Para la prueba del PDF de QA, no hace falta tocar esos botones a mano: el menú
**+** ya deja el modo listo.

### Paso a paso — PDF en modo Entender

1. Abre la app e inicia sesión con el usuario de prueba.
2. En la pantalla de inicio, toca el botón **+** (abajo a la izquierda del cuadro
   de texto).
3. En el menú, elige exactamente:
   **QA PDF multipágina · Entender**
4. Comprueba que:
   - Aparece el archivo adjunto en el cuadro (nombre del PDF).
   - Arriba a la derecha queda seleccionado **Entender** (no Aplicar).
5. Toca el botón de enviar (flecha circular).
6. Espera a que termine la generación.
7. Abre **Idea central** (sin ocultar el header).
8. Comprueba el aviso naranja de sincronización (si aparece):
   - Un solo título: **Sincronización pendiente**
   - El mensaje **no** alterna entre textos
   - Queda **completo debajo** del header / barra de progreso
   - En DEV/QA: panel **Persistencia (DEV)** con Documento / Referencias
9. Comprueba botones (**Explorar el Núcleo**, luego **Atrás** / **Siguiente** /
   **Completar Núcleo**): siempre con fondo visible, nunca solo texto.
10. Avanza Paso 1 → 2 → 3. El aviso no debe parpadear; los botones conservan forma.
11. Referencias (elige la que exista en tu generación; no busques las dos si solo hay una):
    - **En un paso:** chip de fuente bajo un bloque (`[etiqueta]` / locator) → abre PDF; **o**
    - **Núcleo completado:** tarjeta de evidencia → **Ver fragmento**
12. Abre una cita de página N > 1 → comprueba página y subrayado.
13. Si falla la apertura: un solo aviso con **Reintentar** (no dos pantallas).
14. Kill + restart → Biblioteca → recupera el Núcleo.

### Paso a paso — PDF en modo Aplicar

1. Vuelve al inicio (nuevo mapa / pantalla del compositor vacío).
2. Toca **+** → **QA PDF multipágina · Aplicar**.
3. Comprueba que arriba queda seleccionado **Aplicar**.
4. Debajo del compositor puede aparecer el bloque **Tu contexto** (solo en Aplicar).
5. Toca enviar y completa la generación.

### Qué no hacer

- No elijas solo «Archivos» para esta prueba de QA: usa las dos opciones con
  **· Entender** o **· Aplicar** en el título.
- No cambies Entender/Aplicar a mano después de elegir la opción QA, salvo que
  quieras forzar otro modo a propósito.
- No uses una versión antigua de PDF.js (debe ser 5.4.296).
- No ocultes el header para «ver» el aviso: si hace falta ocultarlo, el fallo
  de geometría sigue abierto.

## Checklist E (marcar a mano)

1. [ ] Metro recargado desde cero
2. [ ] Login usuario A
3. [ ] **QA PDF multipágina · Entender** → arriba se ve **Entender** → enviar
4. [ ] Idea central: aviso estable debajo del header (sin alternar mensajes)
5. [ ] DEV: Documento / Referencias legibles; tras sync → guardado / guardadas
6. [ ] Botones siempre con superficie (nunca solo etiqueta)
7. [ ] Paso 1–3 sin parpadeo de aviso ni botones vacíos
8. [ ] Cita página N>1 vía chip de paso **o** Ver fragmento en completado
9. [ ] Excerpt / región marcada visibles
10. [ ] Si falla la firma: un solo aviso → Reintentar → documento nuevo
11. [ ] Kill + restart → Biblioteca conserva el Núcleo
12. [ ] **QA PDF multipágina · Aplicar** → arriba se ve **Aplicar** → enviar
13. [ ] Capturas: Idea central (header+aviso), un paso, finalización

## Fallos bloqueantes (S08 REOPENED)

No marcar S08 DONE mientras alguno falle:

1. Banner de sync alternando textos
2. Botones que pierden superficie (solo texto)
3. Banner tapado por el header de lectura

## Bloqueo automatización

`osascript` sin assistive access (-25211). Completar a mano.

## Alcance de plataforma (S08)

- Gate de bundle limpio: **iOS** (`npm run mobile:bundle:ios`).
- **Android** queda fuera del alcance de lanzamiento de S08 (producto iOS-first).

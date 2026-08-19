# S08 — Mejora estructural de PDF con pdf-inspector

## Objetivo

Mejorar la lectura de PDFs textuales —especialmente tablas, columnas, títulos y
listas— sin empeorar las garantías existentes de Nucleo: anclas por página,
cancelación, cobertura honesta y cero texto inventado.

La integración vive únicamente en el servidor. La aplicación móvil no incluye
Rust, WASM ni binarios de `pdf-inspector`; continúa subiendo el PDF al endpoint
existente.

## Flujo productivo

1. Se valida el archivo y `pdf.js` comienza la extracción autoritativa por
   página.
2. En paralelo, un worker aislado ejecuta `pdf-inspector` con un presupuesto
   total de 2,5 segundos. El reloj empieza junto a `pdf.js`, no después.
3. `auto` intenta el binding nativo (Linux/macOS ARM/Windows compatibles) y, si
   no está disponible, usa WASM. Esto permite desarrollar en un Mac Intel sin
   cambiar la arquitectura de producción.
4. El resultado del worker se valida como dato no confiable: versión, tipo,
   confianza, número exacto de páginas, índices 1-based y tamaño total.
5. El Markdown se acepta página por página únicamente si la página no requiere
   OCR, no hay problemas de codificación y la longitud es coherente con el texto
   medido por `pdf.js`.
6. Si algo falla, expira o se cancela, el resultado es exactamente el de
   `pdf.js`; nunca falla una creación válida por esta mejora opcional.

## Decisiones de fiabilidad

- El parser síncrono nunca bloquea el hilo principal del servidor.
- No se hace OCR en S08. Una recomendación de OCR es solo diagnóstico.
- `pdf.js` conserva la detección de imágenes y la clasificación de páginas.
- Al usar Markdown se eliminan `textItems`, porque sus offsets ya no coinciden
  con los glifos originales. Se mantiene la ancla exacta de página y no se
  inventa una región (`bbox`).
- Tablas o columnas solo dejan de figurar como limitación cuando fueron
  detectadas y todas sus páginas pasaron la validación estructural.
- Los metadatos almacenados contienen únicamente diagnósticos, nunca texto del
  documento.

## Configuración

- `PDF_INSPECTOR_MODE=auto` (por defecto): nativo y luego WASM.
- `PDF_INSPECTOR_MODE=native`: solo binding nativo.
- `PDF_INSPECTOR_MODE=wasm`: solo WASM.
- `PDF_INSPECTOR_MODE=off`: desactiva la mejora.
- `PDF_INSPECTOR_TIMEOUT_MS=2500`: límite, acotado entre 250 y 30000 ms.

Dependencias fijadas exactamente: `@firecrawl/pdf-inspector@1.12.0` y
`@firecrawl/pdf-inspector-wasm@0.1.3`.

## Evidencia automatizada

- Ejecución real del parser WASM sobre un fixture PDF.
- Desactivación y cancelación antes de arrancar.
- Aceptación conservadora de Markdown y descarte de geometría incompatible.
- Fallback ante OCR, número de páginas incoherente y contenido inseguro.
- Cobertura estructural sin ocultar limitaciones restantes.
- Suite focal S08 y compilación productiva.

La QA visual pendiente de S08 no se sustituye ni se marca como completada por
esta integración.

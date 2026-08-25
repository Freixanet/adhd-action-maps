# Núcleo — especificación ejecutable

**Versión:** 1.0  
**Fecha:** 28 de julio de 2026  
**Consumidor principal:** Grok 4.5 en Cursor Agent  
**Autoridad:** contrato técnico y de ejecución derivado del plan maestro v3

---

## 1. Resultado final

Construir una aplicación mobile-first, con web secundaria, que permita:

1. Incorporar una fuente compatible.
2. Saber qué se pudo extraer.
3. Elegir o aceptar Entender/Aplicar.
4. Recibir primera utilidad progresivamente.
5. Recorrer una estructura coherente.
6. Abrir evidencia exacta.
7. Convertir ideas en una aplicación situada.
8. Interrumpir y reanudar.
9. Guardar, exportar y borrar.

### Promesa

> Convierte lo que lees, ves o guardas en algo que entiendes y puedes usar.

### P0 de alpha personal

- Texto pegado.
- Web.
- PDF nativo.
- EPUB.
- TXT, MD, HTML y DOCX.
- YouTube mediante transcript/subtítulos.
- X mediante API oficial, compartir o pegar.
- Entender.
- Aplicar.
- Evidencia.
- Cobertura.
- Progreso.
- Reanudación.
- Biblioteca.
- Borrado.

### Fuera de P0

- OCR avanzado.
- Descarga o análisis audiovisual de YouTube.
- Audio sin transcript.
- PPTX enriquecido.
- Síntesis multifuente.
- Equipos.
- Ejecución de acciones.
- Agentes.
- Gamificación.
- Marketplace.

---

## 2. Estrategia ante un repositorio existente

### S00 debe decidir

Clasificar el repositorio:

- `GREENFIELD`: no existe producto significativo.
- `FOUNDATION`: existe shell, diseño o infraestructura parcial.
- `FUNCTIONAL`: existe un flujo usable.
- `LEGACY_CONFLICT`: la arquitectura bloquea requisitos críticos.

### Regla

- `FOUNDATION` o `FUNCTIONAL`: conservar y evolucionar.
- `LEGACY_CONFLICT`: proponer migración incremental, no reescritura automática.
- `GREENFIELD`: utilizar el stack predeterminado.

### La auditoría debe producir

`docs/execution/REPO_AUDIT.md` con:

- Árbol relevante.
- Stack y versiones.
- Comandos.
- Estado de build y tests.
- Funciones existentes.
- Datos y migraciones.
- Auth.
- Seguridad.
- Deuda.
- Diferencias con esta especificación.
- Cambios del propietario sin confirmar.
- Clasificación.
- Recomendación.
- Primer slice real.

No editar producto durante S00 salvo archivos de documentación de ejecución.

---

## 3. Stack predeterminado greenfield

Utilizarlo solo si S00 clasifica `GREENFIELD`.

### Aplicación

- React Native con Expo.
- Expo Router.
- TypeScript estricto.
- Web mediante Expo Router como superficie secundaria.
- TanStack Query para estado remoto.
- Estado local mínimo y explícito.
- React Hook Form + Zod para formularios donde aporte valor.
- Tokens propios sobre componentes nativos.

### Backend

- Node.js en versión LTS compatible con el ecosistema.
- TypeScript.
- Fastify modular o framework equivalente ya presente.
- API REST tipada y documentada.
- Zod en límites.
- Sin lógica de dominio dentro de handlers.

### Datos

- Supabase Postgres.
- Supabase Auth.
- Supabase Storage privado.
- RLS.
- Migraciones con Supabase CLI.
- `pgvector` solo cuando exista un caso de retrieval probado.

### Jobs

- Trigger.dev para trabajos largos.
- Idempotency keys.
- Reintentos con backoff.
- Cancelación.
- Checkpoints.
- Concurrencia por usuario/proveedor.

### Calidad

- ESLint.
- Prettier.
- TypeScript.
- Vitest.
- React Native Testing Library.
- Tests de integración contra Supabase local.
- Maestro para smoke E2E móvil.
- Playwright para flujos web críticos si la web P0 está activa.

### Observabilidad

- Eventos propios estructurados.
- Errores con redacción de datos.
- Trazas de jobs.
- Métricas de proveedor, modelo, tokens, coste y latencia.
- Proveedor de observabilidad detrás de una interfaz.

### Estructura greenfield

```text
apps/
  app/
  api/
packages/
  contracts/
  domain/
  ui/
  ai/
  adapters/
  observability/
  testkit/
supabase/
  migrations/
  seed.sql
trigger/
  tasks/
docs/
  product/
  architecture/
  execution/
.cursor/
  rules/
  commands/
```

No crear paquetes vacíos. Incorporarlos cuando el slice los necesite.

---

## 4. Arquitectura lógica

```text
Expo app
  ↓
API/BFF
  ↓
Source module ──→ private object storage
  ↓
Job orchestrator
  ↓
Adapter → canonical document → analysis → plan → verification
  ↓
Postgres
  ↓
Progress events
  ↓
Entender / Aplicar / Evidencia / Reanudación
```

### Módulos

- Identity.
- Sources.
- Ingestion.
- Canonical document.
- Analysis.
- Evidence.
- Understanding.
- Application.
- Progress.
- Library.
- Jobs.
- Billing posterior.
- Observability.
- Privacy/deletion.

### Dependencias

- UI depende de contratos, no de implementaciones de proveedores.
- API depende del dominio y puertos.
- Adaptadores implementan puertos.
- Dominio no importa Expo, Supabase, Trigger.dev ni SDKs de modelos.
- Proveedores de IA no devuelven objetos sin validación.

---

## 5. Estados de dominio

### SourceStatus

```ts
type SourceStatus =
  | "received"
  | "validating"
  | "needs_input"
  | "extracting"
  | "ready"
  | "partially_ready"
  | "failed"
  | "deleting"
  | "deleted";
```

### JobStatus

```ts
type JobStatus =
  | "queued"
  | "running"
  | "waiting"
  | "retrying"
  | "succeeded"
  | "failed"
  | "canceled";
```

### NucleusStatus

```ts
type NucleusStatus =
  | "planning"
  | "essential_ready"
  | "ready"
  | "in_progress"
  | "completed"
  | "blocked"
  | "deleted";
```

No representar estados combinados con booleanos independientes.

---

## 6. Contratos principales

### Source

```ts
type SourceType =
  | "pasted_text"
  | "web_article"
  | "pdf"
  | "epub"
  | "text_file"
  | "docx"
  | "youtube_transcript"
  | "x_content";

interface Source {
  id: string;
  ownerId: string;
  type: SourceType;
  title: string | null;
  creator: string | null;
  originalUrl: string | null;
  language: string | null;
  mimeType: string | null;
  contentHash: string;
  status: SourceStatus;
  coverage: Coverage;
  createdAt: string;
  updatedAt: string;
}
```

### Coverage

```ts
interface Coverage {
  textual: number | null;
  extractionConfidence: number | null;
  visualDependency: "none" | "low" | "medium" | "high" | "unknown";
  visualsAnalyzed: boolean;
  isComplete: boolean;
  limitations: CoverageLimitation[];
}
```

### Anchor

```ts
type SourceAnchor =
  | { type: "paragraph"; paragraph: number }
  | { type: "page"; page: number; box?: BoundingBox }
  | { type: "chapter"; chapter: string; paragraph?: number }
  | { type: "timestamp"; startSeconds: number; endSeconds?: number }
  | { type: "post"; postId: string; url: string }
  | { type: "line"; startLine: number; endLine?: number };
```

### SourceSegment

```ts
interface SourceSegment {
  id: string;
  sourceId: string;
  ordinal: number;
  kind: "heading" | "paragraph" | "list" | "table" | "caption" | "note";
  rawText: string;
  normalizedText: string;
  hierarchy: string[];
  anchor: SourceAnchor;
  extractionConfidence: number;
  metadata: Record<string, unknown>;
}
```

### EpistemicStatus

```ts
type EpistemicStatus =
  | "direct_source"
  | "faithful_paraphrase"
  | "inference"
  | "source_recommendation"
  | "nucleo_adaptation"
  | "insufficient_information";
```

### EvidenceLink

```ts
interface EvidenceLink {
  id: string;
  contentNodeId: string;
  segmentId: string;
  relation: "supports" | "contradicts" | "qualifies" | "illustrates";
  verifierStatus: "pending" | "verified" | "rejected" | "uncertain";
  confidence: number;
}
```

Todos los contratos tienen schemas runtime y tests.

---

## 7. Modelo de datos mínimo

Tablas:

- `profiles`
- `sources`
- `source_versions`
- `source_segments`
- `content_nodes`
- `node_relations`
- `evidence_links`
- `nuclei`
- `routes`
- `units`
- `progress`
- `questions`
- `application_plans`
- `application_steps`
- `jobs`
- `provider_runs`
- `evaluations`
- `deletion_requests`

### Reglas

- PK UUID.
- `owner_id` donde aplique.
- `created_at`, `updated_at`.
- Claves externas explícitas.
- Unicidad de idempotencia.
- Índices para owner, source, nucleus, status y ordering.
- RLS select/insert/update/delete.
- Service role solo en backend seguro.
- Storage path comienza por `owner_id/source_id/`.
- Contenido privado nunca en bucket público.

### Borrado

```text
user request
→ mark deleting
→ cancel jobs
→ delete provider artifacts where supported
→ delete embeddings/derived artifacts
→ delete storage objects
→ delete source graph
→ record completion without content
```

Debe ser idempotente y probado.

---

## 8. API P0

```text
POST   /v1/sources
POST   /v1/sources/:sourceId/content
POST   /v1/sources/:sourceId/files
POST   /v1/sources/:sourceId/process
GET    /v1/sources/:sourceId
GET    /v1/sources/:sourceId/status
DELETE /v1/sources/:sourceId

POST   /v1/nuclei
GET    /v1/nuclei/:nucleusId
GET    /v1/nuclei/:nucleusId/map
GET    /v1/nuclei/:nucleusId/units/:unitId
GET    /v1/nuclei/:nucleusId/resume
POST   /v1/nuclei/:nucleusId/progress
POST   /v1/nuclei/:nucleusId/questions
POST   /v1/nuclei/:nucleusId/applications
POST   /v1/nuclei/:nucleusId/feedback

GET    /v1/evidence/:evidenceId
POST   /v1/jobs/:jobId/cancel
GET    /v1/library
```

Reglas:

- Autorización por recurso.
- Idempotency key en creaciones y procesos.
- Respuestas de error tipadas.
- Correlation ID.
- Rate limiting.
- Nunca enviar storage paths internos.
- Paginación estable.

---

## 9. Flujo de identidad

### Primera prueba

Si greenfield:

- Sesión anónima autenticada.
- CAPTCHA/rate limit.
- RLS igual de estricta.
- Advertir que los datos no se recuperarán en otro dispositivo hasta vincular cuenta.

### Guardar/sincronizar

- Vincular email OTP, Apple o Google.
- Resolver conflictos explícitamente.
- Nunca duplicar fuentes silenciosamente.

### Pruebas

- Usuario A no ve datos de B.
- Anónimo no accede después de perder sesión.
- Conversión conserva fuentes.
- Borrado funciona en ambos tipos.
- Service key nunca aparece en bundle.

---

## 10. Interfaz de adaptador

```ts
interface SourceAdapter<Input> {
  readonly type: SourceType;
  canHandle(input: unknown): boolean;
  validate(input: Input, context: AdapterContext): Promise<ValidationResult>;
  extract(input: Input, context: AdapterContext): Promise<CanonicalDocument>;
  getEvidenceTarget(anchor: SourceAnchor, source: Source): EvidenceTarget;
  redactForLogs(error: unknown): SafeAdapterError;
}
```

### Contract tests obligatorios

Cada adaptador prueba:

- Input válido.
- Input falso o incompatible.
- Fuente vacía.
- Longitud máxima.
- Codificación/idioma.
- Estructura.
- Anclas.
- Determinismo de normalización.
- Cancelación.
- Timeout.
- Error externo.
- Redacción de logs.
- Cobertura.

---

## 11. Adaptadores P0

### Texto

- Preservar párrafos, listas y encabezados.
- Anclas por párrafo.
- Detectar idioma.
- Rechazar vacío.

### Web

- Allowlist de protocolos HTTP/HTTPS.
- Protección SSRF.
- Resolver redirects con límite.
- No acceder a IP privadas.
- Extraer contenido principal.
- Conservar URL, título, autor y fecha.
- Detectar contenido incompleto/paywall.
- Alternativa pegar/compartir.

### PDF

- Firma real.
- Texto nativo.
- Orden de lectura.
- Página y bounding box cuando sea posible.
- Detectar cifrado, escaneado y tablas complejas.
- No afirmar cobertura completa si no existe.

### EPUB

- Validar zip de forma segura.
- Proteger contra zip bombs y path traversal.
- Extraer índice, capítulos y párrafos.
- Anclas estables.
- No eludir DRM.

### TXT/MD/HTML/DOCX

- Sanitizar HTML.
- No ejecutar macros.
- No cargar recursos remotos.
- Preservar jerarquía y tablas soportadas.

### YouTube transcript

- Input: URL, texto o archivo de subtítulos.
- No descargar audio/vídeo.
- Validar formatos SRT/VTT/SBV/TXT.
- Unir fragmentos sin perder timestamps.
- Conservar original y normalizado.
- Enlace de evidencia con `t=`.
- Declarar visuales no analizados.
- Importación automática solo con vía autorizada.

### X

- API oficial lookup cuando esté configurada.
- Compartir/pegar como alternativa completa.
- No scraping.
- Conservar post IDs y URL.
- Hilos con autoría y huecos.
- No confundir quoted post, reply y autor.
- Registrar coste por recurso.

---

## 12. Pipeline de IA

### Etapas

1. Estructura.
2. Género.
3. Cobertura.
4. Afirmaciones y relaciones.
5. Plan.
6. Esencial.
7. Unidades.
8. Evidencia.
9. Verificación.
10. Aplicación.

### Reglas

- Prompts versionados.
- Schemas versionados.
- Temperature/control documentados.
- Model routing explícito.
- Timeout y fallback.
- No fallback que reduzca fidelidad silenciosamente.
- Cache por hash + prompt version + model version.
- No incluir más contenido del necesario.
- Proveedor neutral.

### Prompt injection

El mensaje al modelo separa:

```text
SYSTEM POLICY
USER GOAL
UNTRUSTED SOURCE CONTENT
OUTPUT SCHEMA
```

Las instrucciones encontradas en `UNTRUSTED SOURCE CONTENT` nunca se ejecutan.

### Verificación

Para afirmaciones críticas:

- Localizar segmento.
- Comprobar entailment.
- Comprobar cifra/nombre/fecha.
- Conservar calificadores.
- Rechazar o degradar si falla.

### Aplicación

Salida separada:

- Fuente.
- Inferencia.
- Contexto proporcionado.
- Adaptación.
- Supuestos.
- Acción.
- Criterio.

---

## 13. Experiencia P0

### Inicio

- Compositor universal.
- Archivo.
- Compartir.
- Automático.
- Recientes.

### Procesamiento

- Estados reales.
- Primera utilidad progresiva.
- Cancelar.
- Reintentar.
- No estimaciones falsas.

### Portada

- Conclusión.
- Relevancia.
- Tiempo esencial/completo.
- Cobertura.
- CTA dominante.

### Entender

- Lo esencial.
- Mapa.
- Unidades.
- Evidencia.
- Cautelas.
- Transferencia opcional.
- Cierre.

### Aplicar

- Contexto mínimo.
- Ideas candidatas.
- Adaptación.
- Próxima acción.
- Obstáculo.
- Comprobación.
- Revisión.

### Reanudación

- Objetivo.
- Hasta ahora.
- Punto.
- Queda.
- Aplicación activa.

### Estados de fallo

Diseñar y probar:

- Sin transcript.
- PDF escaneado.
- Paywall.
- Hilo incompleto.
- EPUB protegido.
- Archivo corrupto.
- Proveedor caído.
- Job cancelado.
- Resultado parcial.
- Evidencia insuficiente.
- Eliminación en curso.

---

## 14. Diseño

### Tokens mínimos

- Color semántico.
- Tipografía.
- Espaciado.
- Radio.
- Elevación.
- Movimiento.
- Tamaños táctiles.
- Anchura de lectura.

### Reglas

- Texto móvil base 17–18 pt equivalente.
- Interlineado 1.5–1.65.
- Anchura de lectura 55–75 caracteres.
- Objetivos táctiles ≥44 pt.
- Contraste AA.
- Sin texto justificado.
- Dos pesos tipográficos por unidad.
- Una representación principal por unidad.
- Motion reducido respetado.
- Tema oscuro probado si se ofrece.

### Calidad visual

Verificar en:

- iPhone pequeño.
- iPhone grande.
- Android estrecho.
- Web 1280 px.
- Texto al 200 % en web.
- Dynamic Type grande.
- Reduce Motion.
- Modo oscuro/claro si ambos existen.

---

## 15. Eventos

Sin contenido privado:

- `source_received`
- `source_validation_failed`
- `source_ready`
- `source_needs_input`
- `processing_started`
- `essential_ready`
- `nucleus_ready`
- `evidence_opened`
- `understanding_completed`
- `application_created`
- `application_reviewed`
- `resume_opened`
- `source_deleted`
- `provider_run_completed`
- `provider_run_failed`

Propiedades permitidas:

- IDs internos pseudónimos.
- Tipo.
- Tamaño bucketizado.
- Duración.
- Estado.
- Latencia.
- Coste.
- Versión.
- Código de error seguro.

No permitido:

- Texto fuente.
- Preguntas completas.
- Títulos privados.
- URLs privadas completas.
- Aplicaciones personales.

---

## 16. SLO y presupuestos iniciales

Umbrales de trabajo; revisar con datos.

- UI local responde en <100 ms para interacción simple.
- Primera confirmación de recepción <1 s.
- `Lo esencial` p50 <20 s para texto corto; p95 documentado.
- Reanudación sin pérdida.
- 99.5 % de cifras críticas exactas en golden set.
- ≥95 % entailment en afirmaciones críticas.
- 100 % de afirmaciones críticas ancladas o etiquetadas.
- ≥95 % ingestión dentro del contrato por adaptador.
- Ningún fallo silencioso.
- Coste variable medio <25 % del ingreso neto antes de beta.

No falsificar cumplimiento mediante fixtures fáciles.

---

## 17. Definición de Done global

Cada slice:

- Código y migraciones.
- Tests.
- Fixtures.
- Estados de error.
- Accesibilidad.
- Telemetría.
- Documentación.
- Diff revisado.
- Sin secretos.
- Sin regresión.
- Evidencia en `STATUS.md`.

Toda integración externa:

- Fake contractual.
- Sandbox/staging.
- Prueba real autorizada.
- Timeout.
- Retry.
- Circuit/fallback.
- Coste.
- Redacción.

---

## 18. Slices de ejecución

### S00 — Auditoría del repositorio

**Valor:** conocer el punto de partida.

**Entrega:**

- `REPO_AUDIT.md`.
- Comandos verificados.
- Baseline de build/tests.
- Clasificación.
- Mapa spec → código.
- `STATUS.md` real.

**No código de producto.**

---

### S01 — Baseline y contratos

**Dependencia:** S00.

**Entrega:**

- Toolchain estable.
- CI localizable.
- TypeScript estricto sin empeorar baseline.
- Contratos Source, Segment, Anchor, Coverage y Evidence.
- Fixtures mínimas.
- Tests.

**Criterio:** los contratos compilan, validan y rechazan ejemplos inválidos.

---

### S02 — Identidad, RLS y almacenamiento

**Dependencia:** S01.

**Entrega:**

- Auth.
- Sesión anónima o flujo existente equivalente.
- Storage privado.
- Tablas núcleo.
- RLS completa.
- Tests A/B.
- Subida y borrado mínimo.

**Criterio:** no existe acceso cruzado ni service secret en cliente.

---

### S03 — Texto pegado end-to-end

**Dependencia:** S02.

**Entrega:**

```text
pegar
→ validar
→ segmentar
→ guardar
→ procesar
→ mostrar estado
```

- Idempotencia.
- Cancelación.
- Error vacío/límite.
- E2E.

---

### S04 — Motor Entender

**Dependencia:** S03.

**Entrega:**

- Clasificación.
- Plan.
- Lo esencial.
- Mapa.
- Unidades.
- Cierre.
- Output schemas.
- Golden fixtures.

**Criterio:** produce estructura, no lista genérica; preserva cautelas.

---

### S05 — Evidencia, cobertura y abstención

**Dependencia:** S04.

**Entrega:**

- EvidenceLink.
- Verificador.
- Vista exacta.
- Etiquetas epistemológicas.
- Limitaciones.
- “No se puede determinar”.

**Criterio:** toda afirmación crítica está anclada o degradada.

---

### S06 — Motor Aplicar

**Dependencia:** S05.

**Entrega:**

- Contexto mínimo.
- Selección de ideas.
- ApplicationPlan.
- Acción.
- Supuesto.
- Criterio de éxito/abandono.
- Revisión.

**Criterio:** fuente, inferencia y adaptación son distinguibles y testeadas.

---

### S07 — Progreso, reanudación y biblioteca

**Dependencia:** S06.

**Entrega:**

- Progreso semántico.
- Reanudación.
- Biblioteca por estado.
- Aplicación pendiente/activa.
- Recuperación offline razonable de estado UI.

**Criterio:** cierre/reapertura recupera contexto exacto.

---

### S08 — PDF nativo

**Dependencia:** S05.

**Entrega:**

- Validación.
- Extracción.
- Páginas/regiones.
- PDF escaneado detectado.
- Tablas limitadas declaradas.
- Evidence viewer.

---

### S09 — Web

**Dependencia:** S05.

**Entrega:**

- URL.
- SSRF.
- Readability.
- Metadatos.
- Paywall/incompleto.
- Pegar como fallback.

---

### S10 — EPUB y archivos textuales

**Dependencia:** S05.

**Entrega:**

- EPUB.
- TXT.
- MD.
- HTML.
- DOCX.
- Índice/capítulos.
- Seguridad de ZIP/HTML.

---

### S11 — YouTube transcript

**Dependencia:** S05.

**Entrega:**

- Parser TXT/SRT/VTT/SBV.
- URL y metadatos permitidos.
- Timestamp anchors.
- Link `t=`.
- Dependencia visual.
- Fallback manual.
- Interfaz para vía autorizada.

**Prohibido:** audio/video download o endpoint no autorizado en producción.

---

### S12 — X

**Dependencia:** S05.

**Entrega:**

- Pegar/compartir.
- Interfaz API oficial.
- Post.
- Hilo.
- Autoría.
- Huecos.
- Coste.
- Errores.

**Prohibido:** scraping.

---

### S13 — Captura y estados premium

**Dependencias:** S07, S08–S12.

**Entrega:**

- Compositor universal.
- Detección.
- Hoja de compartir si el stack lo permite.
- Todos los estados de fallo.
- Diseño responsive.
- Accesibilidad.
- Motion.

---

### S14 — Seguridad, privacidad y borrado

**Dependencia:** S13.

**Entrega:**

- Threat model.
- Tests de archivos.
- Prompt injection suite.
- Rate limit.
- Redacción.
- Borrado completo.
- Exportación mínima.
- Retención.
- Subencargados/configuración documentados.

---

### S15 — Evaluación, observabilidad y coste

**Dependencia:** S14.

**Entrega:**

- Golden set personal.
- Eval runner.
- Dashboard técnico.
- Coste por resultado.
- Latencia.
- Fallos por adaptador.
- Quality gates automáticos.

---

### S16 — Alpha personal

**Dependencia:** S15.

**Entrega:**

- Build instalable.
- Checklist en dispositivos.
- Uso real con corpus del fundador.
- Registro de fricción.
- Cero fallos críticos abiertos.

No confundir con lanzamiento público.

---

### S17 — Alpha cerrada

**Dependencia:** S16.

**Entrega:**

- 10–20 usuarios.
- Consentimiento.
- Soporte.
- Feedback estructurado.
- Segunda fuente.
- Comparación baseline.
- Precio de prueba.

---

### S18 — Monetización y beta

**Dependencia:** S17.

**Entrega:**

- Proveedor de pagos seleccionado.
- Entitlements.
- Límites simples.
- Restauración.
- Recibos.
- Privacidad/legal.
- Margen medido.
- Runbook.

No implementar antes de señal real de repetición y pago.

---

## 19. Puertas de intervención humana

El agent debe detenerse ante:

- Credenciales reales.
- Alta en X API.
- Decisión sobre transcript provider.
- Revisión jurídica.
- Apple/Google developer accounts.
- Servicios de pago.
- Dominio y correo.
- Despliegue.
- Migración destructiva.
- Procesamiento de fuentes privadas reales fuera de local.

Todo lo demás debe resolverse con la especificación y registrarse.

---

## 20. Informe de cada slice

Actualizar `STATUS.md` con:

- Commit/hash o estado del árbol.
- Archivos.
- Pruebas y resultados.
- Capturas si UI.
- Métricas.
- Criterios marcados.
- Riesgos.
- Decisiones.
- Próximo slice `READY`.

No copiar grandes logs. Incluir comandos y resumen verificable.

---

## 21. Gate de alpha personal

- Todos S00–S15 `DONE`.
- S16 build instalable.
- Corpus real procesado.
- Entender y Aplicar útiles.
- Evidencia correcta.
- Reanudación.
- Borrado.
- Todos los adaptadores tienen fallback.
- Ninguna dependencia de scraping.
- Ningún secreto.
- Sin P0/P1 crítico abierto.
- Coste observable.

---

## 22. Gate de beta

- Alpha personal estable.
- Alpha cerrada con repetición.
- Pago real.
- Términos revisados.
- Privacidad completa.
- Soporte.
- Observabilidad.
- Backups/restore probados.
- Incidentes y runbooks.
- Performance en dispositivos reales.
- Store compliance.
- Margen viable.


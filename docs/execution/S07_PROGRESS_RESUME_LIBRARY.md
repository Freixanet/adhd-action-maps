# S07 — Progreso, reanudación y biblioteca

**Estado:** DONE
**Dependencia:** S06 DONE
**Fuera de alcance:** S08–S17; gamificación; recomendaciones; rediseño global; corregir la compatibilidad web previa de módulos nativos

## 1. Resultado

S07 convierte la posición de cada Núcleo en un estado semántico, durable y
versionado. Cerrar y volver a abrir conserva:

- el Núcleo activo;
- la unidad exacta mediante su ID estable;
- el modo paso a paso o vista completa;
- el paso de Capa 0 y sus acciones marcadas;
- una acción pendiente, activa, revisada o bloqueada;
- el contexto humano necesario para saber qué se estaba haciendo y qué falta.

La biblioteca deja de inferir todo a partir de `isComplete`: muestra y filtra
por el estado real del trabajo.

## 2. Diagnóstico previo

El repositorio ya guardaba `SavedSession`, pero tenía cuatro brechas:

1. abrir desde Biblioteca forzaba `currentStep = 0` y sobrescribía la posición;
2. el guardado diferido podía perderse si el sistema suspendía la app;
3. «Continuar» elegía el primer elemento incompleto del array, no el trabajo
   semánticamente prioritario;
4. no existía una cola durable y owner-scoped para reintentar el avance cloud
   cuando fallaba el `upsert` de `maps`.

La aplicación de S06 tenía overlays de ejecución y revisión, pero la Biblioteca
no distinguía una acción lista de una acción ya iniciada.

## 3. Contrato de progreso

Versión: `s07.progress.v1`.

`SemanticProgressV1` es una proyección determinista de `SavedSession` y
`ActionMapData`; no es una segunda fuente de verdad. Contiene:

- estado de biblioteca;
- superficie de reanudación;
- índice acotado e ID estable de la unidad;
- unidades completadas y restantes;
- estado de Capa 0 y vista completa;
- estado e identidades de la aplicación;
- instante del snapshot.

Estados visibles:

| Estado | Significado |
|---|---|
| `to_start` | El Núcleo aún no se ha empezado |
| `in_progress` | Lectura o vista completa iniciada |
| `action_pending` | Existe una acción válida lista para empezar |
| `action_active` | La acción se inició y falta comprobarla |
| `completed` | Lectura terminada o aplicación revisada |
| `blocked` | Aplicar necesita contexto o se abstuvo |

La restauración usa primero `currentStepId`; el índice numérico solo es un
fallback acotado para sesiones legacy. Un snapshot hostil o incompatible se
descarta y se vuelve a derivar desde la sesión autoritativa.

## 4. Reanudación

Al abrir desde «Continuar» o Biblioteca:

1. se normaliza el mapa sin cambiar su contenido;
2. se restaura la unidad por ID estable;
3. se conservan vista completa, Capa 0 y checks;
4. si estaba en vista completa, el scroll vuelve a la sección registrada;
5. aparece «Retomas aquí» con objetivo, recorrido, punto exacto y restante;
6. al avanzar o cerrar el aviso, este deja de ocupar la interfaz.

La selección principal prioriza:

1. acción activa;
2. acción pendiente;
3. lectura en curso;
4. bloqueo que necesita contexto;
5. trabajo por empezar.

Dentro de la misma prioridad gana la actualización más reciente. Un Núcleo
completado no desplaza trabajo pendiente.

## 5. Biblioteca

La Biblioteca incorpora filtros permanentes y contadores:

- Todos;
- En curso;
- Acciones;
- Por empezar;
- Completados;
- Necesitan contexto.

Cada tarjeta muestra estado, detalle semántico y fecha. Los filtros de búsqueda
y categoría siguen siendo combinables. Las colecciones cuentan como completos
los planes de aplicación revisados aunque la lectura no use `isComplete`.

## 6. Persistencia y recuperación offline

Antes de que la app pase a `inactive` o `background`, se fuerza el snapshot
pendiente; no se depende del debounce de 800 ms.

Para usuarios autenticados, un fallo al subir `maps.session` crea una cola:

```text
nucleo_pending_progress_sync:user:{userId}
```

La cola:

- está separada por `user.id`;
- conserva una sola operación por mapa;
- envía siempre la entrada local completa más reciente;
- se reintenta en hidratación/login, reconexión, vuelta a foreground y botón
  manual;
- no llama a Gemini ni reconstruye el resultado;
- se detiene si A deja de ser la identidad activa;
- se purga al borrar el mapa o la cuenta;
- se sella, pero no se borra, durante sign-out para poder recuperarla al volver
  a A.

El mensaje visible es: «Avance guardado en este dispositivo. Se sincronizará
cuando vuelva la conexión.»

## 7. Cloud y aislamiento A/B

Migración: `20260729270000_s07_semantic_progress.sql`.

`maps.session` sigue siendo la fuente completa. `nucleus_progress` es una
proyección server-owned para consultas e integridad:

- trigger tras INSERT/UPDATE de `maps.session`;
- derivación servidor de estado, superficie, unidad y aplicación;
- snapshot S07 inconsistente → `S07_PROGRESS_SESSION_MISMATCH` y rollback del
  update del mapa;
- RLS SELECT solo para el propietario;
- clientes autenticados no reciben INSERT/UPDATE/DELETE;
- FK con cascade al borrar el mapa o la identidad;
- backfill de mapas legacy sin alterar su sesión.

La matriz real demuestra: A persiste y lee; B no lee ni modifica; anon no lee;
A no puede escribir directamente la proyección; una representación manipulada
no se consolida.

## 8. Superficies visibles

- `ContinueCard`: CTA y estado semánticos.
- `ResumeContextBanner`: contexto compacto y descartable.
- `HistorySheet`: filtro por estados con contadores.
- `HistoryEntryCard`: estado y punto de avance legibles.
- `SessionErrorBanner`: recuperación manual de progreso cloud.

Los controles nuevos respetan objetivos táctiles de 44 puntos, texto ampliado,
roles y etiquetas de accesibilidad. No se añadieron rachas, estadísticas ni
gamificación.

## 9. Pruebas

Cobertura S07:

- derivación de lectura y aplicación;
- IDs estables y reorder de unidades;
- validación hostil fail-closed;
- copy de reanudación;
- prioridad de «Continuar»;
- filtros y contadores;
- cierre/reapertura desde storage frío;
- cola owner-scoped, coalescing, fallo, mapa borrado y A→B;
- Supabase real: proyección exacta, rollback y matriz A/B.

Gates de cierre:

| Gate | Resultado |
|---|---|
| Supabase `db reset` | PASS (+ `20260729270000`) |
| Suite completa con RLS ×2 | **496 PASS / 0 skipped** en ambas |
| Tests S07 focalizados | **21 PASS / 0 skipped** |
| Build root | PASS |
| Export Expo web | PASS (bundle) |
| Root semantic | **19** baseline; 0 errores S07 |
| Mobile semantic | 4 errores baseline; 0 errores S07 |
| Mobile fingerprint | `f94cf617930e6df2f7c314bd46f2ee5e7e9c589e` |

## 10. Riesgo residual declarado

La exportación Expo web genera el bundle, pero su ejecución web completa sigue
bloqueada por una dependencia nativa preexistente
(`expo-modules-core.requireNativeViewManager`). El cliente canónico de este
slice es Expo móvil; corregir la compatibilidad web global no forma parte de
S07. No se afirma una inspección visual web superada.

## 11. Confirmación de alcance

- **S07 DONE.**
- **S02–S06 no se reabrieron funcionalmente.**
- **S08 no iniciado.**

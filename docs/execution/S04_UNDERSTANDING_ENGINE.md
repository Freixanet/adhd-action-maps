# S04 — Motor Entender

**Estado:** DONE (final reopen residuals closed 2026-07-29)  
**Alcance:** comprensión estructurada para `intent === 'understand'` **solo con texto canónico extraído**  
**Fuera de alcance:** S05 verificación/evidencia, S06 aplicación, ingestores YouTube nuevos (S11)

---

## 1. Diagnóstico anterior

Antes de S04, Entender era un disparo monolítico Gemini → `ActionMapData`.  
Tras el primer cierre S04 y un primer reopen, quedaban cuatro residuos críticos: procedencia destruida al reescribir `body.type` a `text`; autoautorización de chunk IDs en rehydrate/caché; IDs acoplados a títulos libres sin versión estructural; matching de relaciones por `edgeBlob` global.

---

## 2. Contratos y versiones

| Pin | Valor |
|-----|-------|
| schema | `s04.understanding.v1` |
| prompt | `s04.prompt.v1.1` |
| compiler | `s04.compile.v1.2` (provenance E2E, chunk auth, seeds versionados, relations concretas) |
| model route (cache) | `s04.route.gemini-flash-first` |

Compatibilidad de lectura: `s04.prompt.v1` / `s04.compile.v1` / `s04.compile.v1.1` aceptados en `rehydrateUnderstanding`.  
**No** se rellenan versiones ausentes con las actuales.

Migración futura (no automática ahora): bump de schema → transformador explícito versionado; mapas con IR incompatible abren el cuerpo legacy y omiten `understanding`.

---

## 3. Enrutamiento por capacidad (`canRunUnderstandingEngine`)

Decisión compartida JSON/NDJSON:

| Caso | Motor |
|------|-------|
| Texto pegado / web / PDF·EPUB·DOCX con extracción válida | S04 |
| YouTube sin transcripción integrada | Legacy transcript-first (nunca la URL) |
| Imagen / vídeo / PDF vision fallback / passthrough | Legacy multimodal |
| ASK | Nunca S04 |
| apply / study | Legacy |

---

## 4. Procedencia canónica (`SourceProvenance`)

Sobrevive a `body.type → text` tras ingest. Campos: `originalKind`, `canonicalUrl`, label/title, `extractionKind`, source/sourceVersion IDs, contentHash.

Propagación: `resolveTransformIngest → registerTransformRoutes → runUnderstandEngine → compileUnderstandingToMap`.

Reglas:
- `ingest.metadata.type === "url"` → `sourceMetadata.kind === "link"` + URL original.
- PDF/EPUB/DOCX/imagen OCR/texto conservan tipo.
- El texto canónico del modelo **nunca** se reutiliza como URL.
- YouTube legacy conserva `youtube` + URL.
- Metadata real gana a heurísticas por extensión.

---

## 5. Flujo

```text
ingest (+ provenance) → ask? stop
      → canRunUnderstandingEngine?
           no  → legacy monolith
           yes → cache lookup (owner+hash+source+versions+route) BEFORE model
                  hit  → validate IR vs ingest chunks (nunca self-refs) → compile → done
                  miss → blueprint → essential_ready → units
                       → canonicalize (seed versionado + slot keys)
                       → compile (provenance + causal guards + relations concretas)
                       → attach validated IR + chunk manifest → cache set → done
```

---

## 6. IDs estables

Semilla: `contentHash | sourceVersion | schema | prompt | compiler | depth`.  
Slot key: índice del plan (`unitOrder`) o `localId` — **no** el título libre del modelo.  
Bump estructural de versiones → nuevo namespace de IDs; relaciones se remapean.

---

## 7. Relaciones

Cada `plan.relationsToPreserve` debe coincidir con una arista concreta (origen, destino, familia semántica). Sin `edgeBlob` global.  
Familias: causal, contribution, limitation, contradiction, response, precedence, enablement, support.  
Guardia causal: `mustKeep`, `limitsOrConditions`, `doesNotClaim`, cautelas, explanation, uncertainties → `causes` se degrada a `contributes` de forma explícita (IR y UI alineadas).

---

## 8. Rehidratación y caché (sin autoautorización)

- Artefacto **recién generado**: validado contra chunks del ingest; el compilador adjunta la IR tras normalizar el mapa (más manifiesto `citedChunks` para rehydrate posterior).
- Artefacto **rehidratado**: solo contra conjunto independiente (`citedChunks` / manifest / caller). Si hay refs y no hay conjunto → omitir IR; cuerpo legacy abre.
- Caché: nunca valida con los `segmentRefs` del propio artefacto.

---

## 9. Caché y schemas Gemini

- Clave: owner, contentHash, sourceId/version, intent, depth, schema/prompt/compiler, **model route**.  
- Hit: 0 llamadas a blueprint/units/repair.  
- `responseSchema` + validación fail-closed.

---

## 10. Confirmación

S05 y S06 **no iniciados**.

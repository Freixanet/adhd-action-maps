# S06 — Motor Aplicar

**Estado:** DONE (2026-07-29 residuos finales)  
**Alcance:** transformar conocimiento verificado en una aplicación personal concreta, prudente y revisable  
**Fuera de alcance:** S07 progreso/biblioteca; gamificación; reescritura de S04/S05; ingestores futuros

---

## 1. Correcciones de cierre

| Cierre | Qué fallaba aún |
|--------|-----------------|
| Primer DONE | Procedencia, fallback, UI, pending, SQL |
| Residuals A–J | Parcial |
| Segundo reopen | Replan cloud, overlays, pending tipado, risk candidata, review SQL |
| **Residuos finales** | Confirmación operable; CAS tras restart; acción high-risk |

### Residuos finales

1. **Confirmación utilizable** — P2 staged; diálogo Conservar / Reemplazar; RPC con `confirmReplace: true` solo al confirmar.
2. **CAS + pending exacto** — digest durable; `previous_digest` obligatorio en replace; pending guarda núcleo P2; P2 no pisa P3.
3. **Acción high-risk** — guard sobre `verbLedInstruction`; cautela en adaptation no basta.

---

## 2. Arquitectura

```text
… → plan ± draft (guard high-risk action)
  → syncApplicationCloudState (immutable core / execution / review)
  → replan: buildStagedReplan → attemptCloudReplan
       requires_confirmation → ApplicationReplanConfirmDialog
       confirm → replan_application_plan(confirmReplace=true)
       cancel → keep P1
```

---

## 3. SQL

- `20260729230000` base · `20260729240000` harden · `20260729250000` replan+review
- `20260729260000` CAS: replace exige `previous_digest` = digest activo

---

## 4. Gates residuos finales

- Suite 2× **478 PASS / 0 skipped** (RLS on).
- Semantic **19**; FP mobile `8d0f0857…`.
- Builds / diff-check / secrets PASS.
- **S07 no iniciado.**

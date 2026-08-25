# Verificación de release

No despliegues ni publiques.

1. Identifica milestone objetivo: alpha personal, alpha cerrada o beta.
2. Lee el gate correspondiente de la especificación.
3. Comprueba cada criterio con evidencia.
4. Ejecuta pipeline completo.
5. Ejecuta E2E en plataformas disponibles.
6. Verifica migraciones, RLS, storage, borrado y restore.
7. Ejecuta suites de archivos y prompt injection.
8. Verifica accesibilidad y dispositivos.
9. Revisa dependencias, secretos, logs y configuración.
10. Revisa contratos de YouTube y X documentados.
11. Revisa coste, latencia y errores.
12. Crea `docs/execution/RELEASE_READINESS.md`.

Resultado permitido:

- `GO`
- `NO_GO`
- `CONDITIONAL_GO`

No uses `GO` si falta un criterio crítico o una prueba real requerida.


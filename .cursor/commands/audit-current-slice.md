# Auditoría del slice actual

No implementes nuevas funciones.

1. Identifica el último slice marcado `DONE` o `IN_PROGRESS`.
2. Lee su diff y criterios.
3. Busca errores funcionales, seguridad, privacidad, accesibilidad, rendimiento, datos y deuda.
4. Ejecuta pruebas existentes.
5. Añade pruebas adversariales solo si revelan o previenen un fallo del slice.
6. Comprueba que no haya mocks de producción, secretos o alcance extra.
7. Comprueba RLS y aislamiento si toca datos.
8. Verifica manualmente el flujo crítico cuando sea posible.
9. Si falla, marca `REOPENED` y lista correcciones exactas.
10. Si pasa, añade evidencia sin cambiar el estado.

Prioriza hallazgos por severidad y ubicación.


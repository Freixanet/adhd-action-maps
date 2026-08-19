# Procedencia — pack provisional Storyset Bro

**Estado:** proveedor provisional para demo editorial local (3 páginas).  
**No es la identidad visual definitiva de Nucleo.**

| Campo | Valor |
|---|---|
| Proveedor | Storyset (Freepik Company) |
| Familia | Bro |
| Fecha de descarga | 2026-08-01 |
| Licencia (free) | Uso personal/comercial con atribución obligatoria ([storyset.com/terms](https://storyset.com/terms) §6; [FAQ](https://storyset.com/faqs)) |
| Atribución sugerida (certificados Freepik) | `designed by storyset - Freepik.com` — junto al contenido si es posible; si no, credits/acknowledgements |
| Premium | Flaticon Premium puede eliminar la atribución (según términos Storyset) |
| Distribución comercial | **Requiere confirmación escrita de Storyset/Freepik o licencia Premium.** No asumir que “Acerca de” basta. |
| Uso en Nucleo | Embebido localmente; sin descarga en sesión; no redistribuir como biblioteca descargable |

## Recursos

| Archivo | URL | Uso |
|---|---|---|
| `hiking.svg` | https://storyset.com/illustration/hiking/bro | Portada / progreso |
| `procrastination.svg` | https://storyset.com/illustration/procrastination/bro | Enemigo: procrastinación |
| `target.svg` | https://storyset.com/illustration/target/bro | Enemigo: perfeccionismo |
| `schedule.svg` | https://storyset.com/illustration/schedule/bro | Enemigo: planificación excesiva |
| `choice.svg` | https://storyset.com/illustration/choice/bro | Experimento: elección |
| `exams.svg` | https://storyset.com/illustration/exams/bro | Experimento: prueba |
| `anxiety.svg` | https://storyset.com/illustration/anxiety/bro | Experimento: excusa / coste |

## Modificaciones aplicadas al SVG

- Fondo Storyset (`freepik--background-*`) eliminado (opción Hidden).
- Capas decorativas recortadas según asset (p. ej. Clouds/Plants) — permitido por FAQ Storyset.
- Acento Bro `#92E3A9` → `#E0B45C` (amarillo Nucleo).
- Tinte `#E4F8E9` → `#F6E7C3` cuando aparecía.
- Púrpuras Storyset frecuentes → `#8B8FF5` cuando aparecían.
- Linework `#263238` sin alterar.
- Sin redibujar sujetos.

## Runtime

Los SVG se empaquetan en la app. El catálogo referencia `localModule`; el renderer lee XML local. Cero peticiones de ilustraciones en runtime.

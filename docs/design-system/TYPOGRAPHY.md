# Tipografía de Nucleo

La tipografía es parte de la función de lectura, no una capa decorativa.

## Decisiones

- Familia de producto: **SF Pro** (iOS) / **Roboto** (Android). Es la cara de sistema; no hace falta una display de pago para que se lea bien.
- Source Sans 3 y SF Pro Rounded quedan como prueba en Ajustes. No son el default.
- Firma opcional: solo en títulos de canvas Lumen, **Iowan Old Style** (iOS) / Georgia (Android). El cuerpo sigue en system. No añadir Söhne, Geist ni Inter Display sin una decisión explícita.
- Escala única: **34 / 28 / 22 / 17 / 15 / 13**.
- Pesos: **400** cuerpo, **500** énfasis a 15/17, **600** heading (22), **700** display (28 y 34, y títulos Lumen).
- Interlineado: **1,4** cuerpo (13/15/17) y **1,15** titulares (22/28/34).
- Tracking: **−0,02 em** por encima de 24 px (28 y 34). El resto, 0. Los kickers en mayúsculas conservan tracking abierto (`kicker`).
- **Máximo 3 tamaños por pantalla.**

## 8 roles

Nuevo texto usa uno de estos nombres. El resto de claves en `type` son alias deprecados que apuntan a ellos.

| Role | Tamaño | Peso | Uso |
| --- | --- | --- | --- |
| `display` | 34 | 700 | Cover / display |
| `pageTitle` | 28 | 700 | Título de página |
| `heading` | 22 | 600 | Sección |
| `title` | 17 | 500 | Línea enfatizada, título de tarjeta |
| `body` | 17 | 400 | Cuerpo y campos |
| `callout` | 15 | 500 | Callout, botón |
| `caption` | 15 | 400 | Caption |
| `meta` | 13 | 500 | Meta, label |

`kicker` no es un noveno tamaño: es `meta` en overline (13/18/500, tracking abierto, uppercase). Usar `kicker`, no inventar `metaKicker` ni `planKicker`.

## Regla de uso

Las pantallas consumen `NucleoText`, `ReadingText`, `ReadingColumn` o `typography(role)`. No se deben añadir tamaños, pesos, interlineados o familias literales en componentes. Si un elemento no es texto de producto (SVG, shader, vendor o marca grabada), debe quedar fuera del sistema con una razón técnica concreta.

El checker `npm run check:design-tokens` protege también contra `allowFontScaling={false}`, `adjustsFontSizeToFit`, texto justificado, partición automática y familias tipográficas directas.

## Escala del usuario

La opción se guarda en `nucleo.reading-size-preference` y se ofrece desde el menú de perfil. El valor `system` no intenta neutralizar la configuración de accesibilidad del dispositivo; por eso el contenido sigue usando `allowFontScaling`.

La prueba de familia se guarda en `nucleo.reading-font-preference` (SF Pro, Rounded o Source Sans 3) en el mismo panel de Ajustes.

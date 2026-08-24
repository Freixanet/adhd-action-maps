# Tipografía de Nucleo

La tipografía es parte de la función de lectura, no una capa decorativa.

## Decisiones

- Familia de producto: **SF Pro** (iOS) / **Roboto** (Android). Es la cara de sistema; no hace falta una display de pago para que se lea bien.
- Source Sans 3 y SF Pro Rounded quedan como prueba en Ajustes. No son el default.
- Firma opcional: solo en títulos de canvas Lumen, **Iowan Old Style** (iOS) / Georgia (Android). El cuerpo sigue en system. No añadir Söhne, Geist ni Inter Display sin una decisión explícita.
- Escala única: **34 / 28 / 22 / 17 / 15 / 13**.
- Pesos: **400** cuerpo, **500** subtítulo y UI, **700** display (28 y 34, y títulos Lumen).
- Interlineado: **1,4** cuerpo (13/15/17) y **1,15** titulares (22/28/34).
- Tracking: **−0,02 em** por encima de 24 px (28 y 34). El resto, 0. Los kickers en mayúsculas conservan tracking abierto.
- **Máximo 3 tamaños por pantalla.**

## Roles

| Tamaño | Uso |
| --- | --- |
| 34 | Display / cover |
| 28 | Título de página |
| 22 | Sección / subtítulo |
| 17 | Cuerpo y campos |
| 15 | Callout, botón, caption |
| 13 | Meta, kicker, label |

## Regla de uso

Las pantallas consumen `NucleoText`, `ReadingText`, `ReadingColumn` o `typography(role)`. No se deben añadir tamaños, pesos, interlineados o familias literales en componentes. Si un elemento no es texto de producto (SVG, shader, vendor o marca grabada), debe quedar fuera del sistema con una razón técnica concreta.

El checker `npm run check:design-tokens` protege también contra `allowFontScaling={false}`, `adjustsFontSizeToFit`, texto justificado, partición automática y familias tipográficas directas.

## Escala del usuario

La opción se guarda en `nucleo.reading-size-preference` y se ofrece desde el menú de perfil. El valor `system` no intenta neutralizar la configuración de accesibilidad del dispositivo; por eso el contenido sigue usando `allowFontScaling`.

La prueba de familia se guarda en `nucleo.reading-font-preference` (SF Pro, Rounded o Source Sans 3) en el mismo panel de Ajustes.

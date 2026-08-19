# Tipografía de Nucleo

La tipografía es parte de la función de lectura, no una capa decorativa.

## Decisiones

- Familia de producto: **Source Sans 3**. Ajustes prueba **SF Pro** (`ui-sans-serif`) y **SF Pro Rounded** (`ui-rounded`) en iOS; esos nombres genéricos son los que React Native mapea al diseño del sistema. `"SF Pro Rounded"` como familia no carga y cae a SF Pro.
- Pesos funcionales: regular (400), semibold (600) y bold (700). Los roles históricos restantes existen solo para compatibilidad visual de superficies concretas.
- Cuerpo de lectura: 17/26 por defecto (≈1,53), sin justificado ni partición automática.
- Titulares: interlineado aproximado 1,1–1,25 mediante roles semánticos.
- Ancho: `reading.maxWidth`/`space.editorial.maxReadWidth` limita únicamente columnas de lectura; las tarjetas, formularios y navegación conservan su propio layout.
- Dynamic Type sigue activo. La preferencia interna `system | comfortable | large | extraLarge` modifica solo lectura/editorial y se combina con la escala del sistema sin desactivarla.

## Regla de uso

Las pantallas consumen `NucleoText`, `ReadingText`, `ReadingColumn` o `typography(role)`. No se deben añadir tamaños, pesos, interlineados o familias literales en componentes. Si un elemento no es texto de producto (SVG, shader, vendor o marca grabada), debe quedar fuera del sistema con una razón técnica concreta.

El checker `npm run check:design-tokens` protege también contra `allowFontScaling={false}`, `adjustsFontSizeToFit`, texto justificado, partición automática y familias tipográficas directas.

## Escala del usuario

La opción se guarda en `nucleo.reading-size-preference` y se ofrece desde el menú de perfil. El valor `system` no intenta neutralizar la configuración de accesibilidad del dispositivo; por eso el contenido sigue usando `allowFontScaling`.

La prueba de familia se guarda en `nucleo.reading-font-preference` (Source Sans 3 o SF Pro Rounded) en el mismo panel de Ajustes.

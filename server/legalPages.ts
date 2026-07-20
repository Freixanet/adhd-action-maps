export const PRIVACY_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Privacidad — Núcleo</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1.25rem;line-height:1.55;color:#1a1a1a}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-top:1.6rem}p,li{color:#333}</style>
</head><body>
<h1>Política de privacidad</h1>
<p>Última actualización: 20 de julio de 2026.</p>
<p>Núcleo te ayuda a transformar fuentes en mapas de comprensión. Tratamos datos personales de forma limitada y con finalidad de prestar el servicio.</p>
<h2>Datos que tratamos</h2>
<ul>
<li>Cuenta (email) si inicias sesión con Supabase Auth.</li>
<li>Historial de mapas sincronizado en la nube (si activas la cuenta).</li>
<li>Fuentes que envías para generar un Núcleo (texto, enlaces, archivos).</li>
<li>Datos técnicos de uso necesarios para límites diarios y seguridad.</li>
</ul>
<h2>Dónde se procesan</h2>
<ul>
<li>Datos de cuenta e historial: Supabase (UE / AWS eu-west cuando el proyecto esté configurado allí).</li>
<li>Generación de mapas: Google Gemini API (el contenido de la fuente se envía solo para generar la respuesta).</li>
<li>Alojamiento de la API: Railway.</li>
</ul>
<h2>Tus derechos</h2>
<p>Puedes solicitar acceso, rectificación o borrado de tu cuenta desde la app (Eliminar cuenta) o contactando al responsable del tratamiento.</p>
<p>Esta página es un borrador operativo para cumplimiento mínimo de review; el texto legal final se publicará antes del lanzamiento de pago.</p>
</body></html>`;

export const TERMS_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Términos — Núcleo</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1.25rem;line-height:1.55;color:#1a1a1a}h1{font-size:1.6rem}h2{font-size:1.1rem;margin-top:1.6rem}p,li{color:#333}</style>
</head><body>
<h1>Términos de uso</h1>
<p>Última actualización: 20 de julio de 2026.</p>
<p>Al usar Núcleo aceptas estas condiciones de uso del servicio.</p>
<h2>Servicio</h2>
<p>Núcleo genera mapas de comprensión a partir de fuentes que aportas. El plan gratuito tiene un límite diario; Pro puede incluir límites de uso justo.</p>
<h2>Contenido</h2>
<p>Eres responsable de las fuentes que subes y de disponer de derechos suficientes para procesarlas. No uses el servicio para contenido ilegal o abusivo.</p>
<h2>Disponibilidad</h2>
<p>El servicio se ofrece “tal cual”; puede haber interrupciones o errores de generación. Borrador previo al lanzamiento comercial.</p>
</body></html>`;

import { assertSafeFetchUrl } from "../shared/ssrfGuard";
import { truncateSourceText } from "../shared/nucleoPipeline";

const MAX_REMOTE_FETCH_BYTES = Number(process.env.MAX_REMOTE_FETCH_BYTES ?? 2 * 1024 * 1024);

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function readResponseTextCapped(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new Error("La página es demasiado grande para procesarla.");
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        // ignore cancel errors
      }
      throw new Error("La página es demasiado grande para procesarla.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
}

/** Fetch public http(s) pages with SSRF guards, redirect checks, and size caps. */
export async function fetchUrlContent(url: string): Promise<string> {
  const maxRedirects = 3;
  let current = url;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
    const safe = await assertSafeFetchUrl(current);
    if (!safe.ok) {
      throw new Error(
        "No se puede acceder a ese enlace por seguridad. Usa una URL https pública."
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(safe.url.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Nucleo/1.0)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("El enlace redirige sin destino válido.");
        }
        current = new URL(location, safe.url).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `No se pudo acceder al enlace (${response.status}). Verifica que la URL sea pública.`
        );
      }

      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength > MAX_REMOTE_FETCH_BYTES) {
        throw new Error("La página es demasiado grande para procesarla.");
      }

      const body = await readResponseTextCapped(response, MAX_REMOTE_FETCH_BYTES);
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/html") || body.trim().startsWith("<")) {
        const text = htmlToText(body);
        if (text.length < 50) {
          throw new Error("La página no contiene suficiente texto legible para procesar.");
        }
        return truncateSourceText(text).text;
      }

      const plain = body.trim();
      if (plain.length < 50) {
        throw new Error("El enlace no contiene suficiente texto para procesar.");
      }
      return truncateSourceText(plain).text;
    } catch (err: any) {
      if (err.name === "AbortError") {
        throw new Error("La descarga del enlace tardó demasiado. Inténtalo de nuevo.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("El enlace hace demasiadas redirecciones.");
}

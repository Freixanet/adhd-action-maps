import { lookup } from "node:dns/promises";
import path from "node:path";
import { Readability } from "@mozilla/readability";
import ipaddr from "ipaddr.js";
import { JSDOM } from "jsdom";
import { Agent, request } from "undici";
import { truncateSourceText } from "../../../shared/nucleoPipeline";

const MAX_REDIRECTS = 3;
const TOTAL_TIMEOUT_MS = 8_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "NucleoBot/1.0 (+https://nucleo.app)";
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_MIME_TYPES = new Set([
  "text/html",
  "text/plain",
  "application/pdf",
]);
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

export type SecureFetchResult = {
  title: string;
  text: string;
  canonicalUrl: string;
};

export type SecureFetchErrorCode =
  | "invalid_url"
  | "unsupported_protocol"
  | "credentials_not_allowed"
  | "blocked_hostname"
  | "private_ip"
  | "dns_failed"
  | "redirect_loop"
  | "too_many_redirects"
  | "timeout"
  | "too_large"
  | "disallowed_mime"
  | "http_error"
  | "empty_content"
  | "parse_failed";

export class SecureFetchError extends Error {
  constructor(
    public readonly code: SecureFetchErrorCode,
    message: string,
    public readonly httpStatus: number
  ) {
    super(message);
    this.name = "SecureFetchError";
  }
}

type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

type ValidatedUrl = {
  url: URL;
  address: ResolvedAddress;
};

function clientError(code: SecureFetchErrorCode, message: string, status = 400) {
  return new SecureFetchError(code, message, status);
}

function ssrfBlocked(code: "blocked_hostname" | "private_ip") {
  return new SecureFetchError(code, "SSRF_BLOCKED", 403);
}

function normalizedHostname(url: URL): string {
  return url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

function isPublicIp(address: string): boolean {
  try {
    const parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6") {
      const ipv6 = parsed as ipaddr.IPv6;
      if (ipv6.isIPv4MappedAddress()) {
        return isPublicIp(ipv6.toIPv4Address().toString());
      }
    }
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(clientError("timeout", "Tiempo de descarga agotado.", 422));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(clientError("timeout", "Tiempo de descarga agotado.", 422));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

export function assertSecureFetchTarget(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw clientError("invalid_url", "URL no válida.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw clientError("unsupported_protocol", "Protocolo no permitido.");
  }
  if (url.username || url.password) {
    throw clientError("credentials_not_allowed", "No se permiten credenciales en la URL.");
  }

  const hostname = normalizedHostname(url);
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw ssrfBlocked("blocked_hostname");
  }

  if (ipaddr.isValid(hostname)) {
    if (!isPublicIp(hostname)) {
      throw ssrfBlocked("private_ip");
    }
  }

  return url;
}

async function validateAndResolve(rawUrl: string, signal: AbortSignal): Promise<ValidatedUrl> {
  const url = assertSecureFetchTarget(rawUrl);
  const hostname = normalizedHostname(url);

  if (ipaddr.isValid(hostname)) {
    const parsed = ipaddr.parse(hostname);
    return {
      url,
      address: {
        address: hostname,
        family: parsed.kind() === "ipv4" ? 4 : 6,
      },
    };
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await abortable(
      lookup(hostname, { all: true, verbatim: true }),
      signal
    );
  } catch (error) {
    if (error instanceof SecureFetchError) throw error;
    throw clientError("dns_failed", "No se pudo resolver el host.", 422);
  }

  if (!addresses.length) {
    throw clientError("dns_failed", "No se pudo resolver el host.", 422);
  }
  if (addresses.some(({ address }) => !isPublicIp(address))) {
    throw ssrfBlocked("private_ip");
  }

  const selected =
    addresses.find(({ family }) => family === 4) ??
    addresses.find(({ family }) => family === 6);
  if (!selected || (selected.family !== 4 && selected.family !== 6)) {
    throw clientError("dns_failed", "No se pudo resolver el host.", 422);
  }

  return {
    url,
    address: {
      address: selected.address,
      family: selected.family,
    },
  };
}

function pinnedUrlFor(url: URL, address: ResolvedAddress): URL {
  const pinned = new URL(url);
  pinned.hostname = address.family === 6 ? `[${address.address}]` : address.address;
  return pinned;
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | null {
  const value = headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeMime(header: string | null): string | null {
  if (!header) return null;
  const normalized = header.split(";")[0]?.trim().toLowerCase() || null;
  return normalized === "application/xhtml+xml" ? "text/html" : normalized;
}

function sniffMime(body: Buffer): "text/html" | "application/pdf" | null {
  if (body.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }
  const prefix = body.subarray(0, 512).toString("utf8");
  if (/^\s*<(?:!doctype|html|head|body|article|main)\b/i.test(prefix)) {
    return "text/html";
  }
  return null;
}

async function readBodyCapped(
  body: AsyncIterable<Uint8Array> & { destroy?: (error?: Error) => void },
  signal: AbortSignal
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of body) {
    if (signal.aborted) {
      body.destroy?.();
      throw clientError("timeout", "Tiempo de descarga agotado.", 422);
    }
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_BODY_BYTES) {
      body.destroy?.();
      throw clientError("too_large", "La respuesta supera el límite permitido.", 422);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, total);
}

function normalizeText(value: string): string {
  return value
    .replace(/\0/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function fallbackTitle(url: URL, text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim())?.trim();
  if (firstLine && firstLine.length <= 120) return firstLine;

  const basename = path.posix.basename(url.pathname);
  if (basename) {
    try {
      return decodeURIComponent(basename).slice(0, 120);
    } catch {
      return basename.slice(0, 120);
    }
  }
  return url.hostname;
}

function isSameSiteHostname(left: string, right: string): boolean {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  if (a.split(".").length < 2 || b.split(".").length < 2) return false;
  return a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

async function resolveCanonicalUrl(
  document: Document,
  finalUrl: URL,
  signal: AbortSignal
): Promise<string> {
  const canonicalHref = document
    .querySelector('link[rel~="canonical" i]')
    ?.getAttribute("href");
  if (!canonicalHref) return finalUrl.toString();

  try {
    const candidate = new URL(canonicalHref, finalUrl);
    if (!isSameSiteHostname(candidate.hostname, finalUrl.hostname)) {
      return finalUrl.toString();
    }
    await validateAndResolve(candidate.toString(), signal);
    return candidate.toString();
  } catch (error) {
    if (error instanceof SecureFetchError && error.code === "timeout") throw error;
    return finalUrl.toString();
  }
}

async function parseDocument(
  body: Buffer,
  mime: string,
  finalUrl: URL,
  signal: AbortSignal
): Promise<SecureFetchResult> {
  if (mime === "application/pdf") {
    throw clientError(
      "parse_failed",
      "PDF mediante URL no habilitado; sube el archivo.",
      422
    );
  }

  const decoded = body.toString("utf8").replace(/^\uFEFF/, "");
  if (mime === "text/plain") {
    const text = truncateSourceText(normalizeText(decoded)).text;
    if (!text) throw clientError("empty_content", "Contenido vacío.", 422);
    return {
      title: fallbackTitle(finalUrl, text),
      text,
      canonicalUrl: finalUrl.toString(),
    };
  }

  try {
    const dom = new JSDOM(decoded, { url: finalUrl.toString() });
    const readability = new Readability(dom.window.document).parse();
    const text = truncateSourceText(
      normalizeText(readability?.textContent || dom.window.document.body?.textContent || "")
    ).text;
    if (!text) throw clientError("empty_content", "Contenido vacío.", 422);

    const title =
      normalizeText(readability?.title || dom.window.document.title || "") ||
      fallbackTitle(finalUrl, text);
    const canonicalUrl = await resolveCanonicalUrl(
      dom.window.document,
      finalUrl,
      signal
    );

    dom.window.close();
    return {
      title: title.slice(0, 240),
      text,
      canonicalUrl,
    };
  } catch (error) {
    if (error instanceof SecureFetchError) throw error;
    throw clientError("parse_failed", "No se pudo extraer el contenido.", 422);
  }
}

function logSafeFetch(details: {
  host: string;
  finalHost?: string;
  status?: number;
  mime?: string | null;
  bytes?: number;
  redirects: number;
  durationMs: number;
  code: "ok" | SecureFetchErrorCode;
}) {
  console.info("[safe_fetch]", details);
}

export async function secureFetch(rawUrl: string): Promise<SecureFetchResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
  let current = rawUrl;
  let initialHost = "";
  let finalHost = "";
  let redirects = 0;
  let status: number | undefined;
  let mime: string | null = null;
  let bytes = 0;
  const visited = new Set<string>();

  try {
    while (true) {
      const validated = await validateAndResolve(current, controller.signal);
      initialHost ||= validated.url.hostname;
      finalHost = validated.url.hostname;

      const visitKey = validated.url.toString();
      if (visited.has(visitKey)) {
        throw clientError("redirect_loop", "Bucle de redirección.", 422);
      }
      visited.add(visitKey);

      const pinnedUrl = pinnedUrlFor(validated.url, validated.address);
      const remainingMs = Math.max(1, TOTAL_TIMEOUT_MS - (Date.now() - startedAt));
      const dispatcher = new Agent({
        connect: {
          servername:
            validated.url.protocol === "https:" ? validated.url.hostname : undefined,
        },
        connectTimeout: remainingMs,
        headersTimeout: remainingMs,
        bodyTimeout: remainingMs,
        maxResponseSize: MAX_BODY_BYTES,
      });

      try {
        let response: Awaited<ReturnType<typeof request>>;
        try {
          response = await request(pinnedUrl, {
            dispatcher,
            method: "GET",
            signal: controller.signal,
            headers: {
              accept:
                "text/html,application/xhtml+xml,text/plain,application/pdf;q=0.9",
              "accept-encoding": "identity",
              "user-agent": USER_AGENT,
              host: validated.url.host,
            },
          });
        } catch (error: any) {
          if (controller.signal.aborted || error?.name === "AbortError") {
            throw clientError("timeout", "Tiempo de descarga agotado.", 422);
          }
          if (error?.code === "UND_ERR_RES_EXCEEDED") {
            throw clientError("too_large", "La respuesta supera el límite permitido.", 422);
          }
          throw clientError("http_error", "No se pudo descargar la URL.", 422);
        }

        status = response.statusCode;
        if (REDIRECT_STATUSES.has(response.statusCode)) {
          response.body.destroy();
          const location = headerValue(response.headers, "location");
          if (!location) {
            throw clientError("http_error", "Redirección sin destino.", 422);
          }
          if (redirects >= MAX_REDIRECTS) {
            throw clientError("too_many_redirects", "Demasiadas redirecciones.", 422);
          }
          redirects += 1;
          current = new URL(location, validated.url).toString();
          continue;
        }

        if (response.statusCode < 200 || response.statusCode > 299) {
          response.body.destroy();
          throw clientError("http_error", "La URL respondió con error.", 422);
        }

        mime = normalizeMime(headerValue(response.headers, "content-type"));
        if (mime && !ALLOWED_MIME_TYPES.has(mime)) {
          response.body.destroy();
          throw clientError("disallowed_mime", "Tipo de contenido no permitido.", 422);
        }

        const contentLength = Number(headerValue(response.headers, "content-length") || 0);
        if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
          response.body.destroy();
          throw clientError("too_large", "La respuesta supera el límite permitido.", 422);
        }

        const body = await readBodyCapped(response.body, controller.signal);
        bytes = body.byteLength;
        mime ||= sniffMime(body);
        if (!mime || !ALLOWED_MIME_TYPES.has(mime)) {
          throw clientError("disallowed_mime", "Tipo de contenido no permitido.", 422);
        }

        const result = await parseDocument(body, mime, validated.url, controller.signal);
        logSafeFetch({
          host: initialHost,
          finalHost,
          status,
          mime,
          bytes,
          redirects,
          durationMs: Date.now() - startedAt,
          code: "ok",
        });
        return result;
      } finally {
        await dispatcher.close().catch(() => undefined);
      }
    }
  } catch (error) {
    const safeError =
      error instanceof SecureFetchError
        ? error
        : clientError("http_error", "No se pudo descargar la URL.", 422);
    logSafeFetch({
      host: initialHost,
      finalHost,
      status,
      mime,
      bytes,
      redirects,
      durationMs: Date.now() - startedAt,
      code: safeError.code,
    });
    throw safeError;
  } finally {
    clearTimeout(timer);
  }
}

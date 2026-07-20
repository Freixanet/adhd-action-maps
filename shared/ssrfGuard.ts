import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    if (n == null) return true;
    // 0.0.0.0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, 224+/multicast+reserved
    if ((n & 0xff000000) === 0x00000000) return true;
    if ((n & 0xff000000) === 0x0a000000) return true;
    if ((n & 0xff000000) === 0x7f000000) return true;
    if ((n & 0xffff0000) === 0xa9fe0000) return true;
    if ((n & 0xfff00000) === 0xac100000) return true;
    if ((n & 0xffff0000) === 0xc0a80000) return true;
    if ((n & 0xf0000000) >= 0xe0000000) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
    if (normalized.startsWith("fe80")) return true; // link-local
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice("::ffff:".length);
      if (isIP(mapped) === 4) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

export type SafeUrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Reject non-http(s), credentials in URL, blocked hostnames, and private/reserved IPs
 * (including after DNS resolution).
 */
export async function assertSafeFetchUrl(raw: string): Promise<SafeUrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsupported_protocol" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_not_allowed" };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    return { ok: false, reason: "blocked_hostname" };
  }

  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { ok: false, reason: "private_ip" };
    }
    return { ok: true, url };
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: "dns_failed" };
  }
  if (!addresses.length) {
    return { ok: false, reason: "dns_failed" };
  }
  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      return { ok: false, reason: "private_ip" };
    }
  }
  return { ok: true, url };
}

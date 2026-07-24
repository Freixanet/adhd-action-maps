import type { Request, Response } from "express";
import { isProUser } from "../shared/proEntitlement";
import { assertAndConsumeUsage, type UsageKind } from "../shared/usageLimits";
import type { TransformRequest } from "../shared/contracts";

export type AuthenticatedRequest = Request & {
  userId?: string;
  userEmail?: string;
  isPro?: boolean;
};

const PREMIUM_MODEL_IDS = new Set([
  "gemini-3.5-flash",
  "gemini-3-pro-preview",
  "gemini-3.1-pro-preview",
  ...(process.env.GEMINI_DEEP_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),
]);

export function isPlaceholderSupabaseUrl(url: string | undefined): boolean {
  if (!url?.trim()) return true;
  if (/your-project\.supabase\.co/i.test(url)) return true;
  return false;
}

export function isSupabaseAuthConfigured(): boolean {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!url || !key || isPlaceholderSupabaseUrl(url)) return false;
  if (/^your-anon-key$/i.test(key)) return false;
  return true;
}

/** Default: require JWT when Supabase looks real. Set REQUIRE_AUTH=false for local anon metering. */
export function requireAuthEnabled(): boolean {
  if (process.env.REQUIRE_AUTH === "false") return false;
  if (process.env.REQUIRE_AUTH === "true") return true;
  return isSupabaseAuthConfigured();
}

export async function authenticateOptional(req: AuthenticatedRequest) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey || isPlaceholderSupabaseUrl(supabaseUrl)) return;

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return;
    const user = (await response.json()) as { id?: string; email?: string };
    if (!user.id) return;
    req.userId = user.id;
    req.userEmail = user.email;
    req.isPro = isProUser(user.email);
  } catch (err) {
    console.warn("[auth] Supabase user lookup failed:", err instanceof Error ? err.message : err);
  }
}

function usageSubject(req: AuthenticatedRequest): string {
  if (req.userId) return req.userId;
  return `anon:${req.ip || req.socket.remoteAddress || "unknown"}`;
}

export async function requireLlmAccess(
  req: AuthenticatedRequest,
  res: Response
): Promise<boolean> {
  await authenticateOptional(req);
  if (req.userId) return true;
  if (!requireAuthEnabled()) {
    req.userId = usageSubject(req);
    req.isPro = false;
    return true;
  }
  res.status(401).json({
    error: "Inicia sesión para generar Núcleos.",
    code: "auth_required",
  });
  return false;
}

export function enforceUsageQuota(
  req: AuthenticatedRequest,
  res: Response,
  kind: UsageKind
): boolean {
  const result = assertAndConsumeUsage(usageSubject(req), Boolean(req.isPro), kind);
  if (result.ok === false) {
    const error =
      result.code === "free_limit"
        ? "Has usado tus 3 Núcleos gratis de hoy. Vuelve mañana o pasa a Pro."
        : "Has alcanzado el límite diario de uso. Vuelve mañana.";
    res.status(402).json({
      error,
      code: result.code,
      used: result.used,
      limit: result.limit,
    });
    return false;
  }
  res.setHeader("X-Usage-Used", String(result.used));
  res.setHeader("X-Usage-Limit", String(result.limit));
  return true;
}

export function enforceProEntitlements(
  req: AuthenticatedRequest,
  res: Response,
  body: TransformRequest
): boolean {
  if (body.depth === "profundo" && !req.isPro) {
    res.status(403).json({
      error: "La profundidad Profundo es exclusiva de Pro.",
      code: "pro_required",
    });
    return false;
  }
  const preferred = typeof body.preferredModel === "string" ? body.preferredModel : undefined;
  if (
    preferred &&
    preferred !== "auto" &&
    PREMIUM_MODEL_IDS.has(preferred) &&
    !req.isPro
  ) {
    res.status(403).json({
      error: "Ese modelo es exclusivo de Pro.",
      code: "pro_required",
    });
    return false;
  }
  return true;
}

export { PREMIUM_MODEL_IDS };

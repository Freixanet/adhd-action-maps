/** Daily quotas for LLM endpoints (UTC calendar day). */

export const FREE_TRANSFORMS_PER_DAY = 3;
export const PRO_TRANSFORMS_PER_DAY = 30;
export const PRO_CHAT_PER_DAY = 20;
export const FREE_CHAT_PER_DAY = 3;

export type UsageKind = "transform" | "chat";

export function utcDayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resolveDailyQuota(isPro: boolean, kind: UsageKind): number {
  if (kind === "chat") {
    return isPro ? PRO_CHAT_PER_DAY : FREE_CHAT_PER_DAY;
  }
  return isPro ? PRO_TRANSFORMS_PER_DAY : FREE_TRANSFORMS_PER_DAY;
}

export type UsageBucket = {
  day: string;
  transform: number;
  chat: number;
};

/** Process-local meter (sufficient for single-instance Railway until Postgres is wired). */
const buckets = new Map<string, UsageBucket>();

function getBucket(subjectId: string, day = utcDayKey()): UsageBucket {
  const key = `${subjectId}:${day}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.day !== day) {
    bucket = { day, transform: 0, chat: 0 };
    buckets.set(key, bucket);
  }
  return bucket;
}

export function peekUsage(subjectId: string, kind: UsageKind): number {
  const bucket = getBucket(subjectId);
  return kind === "chat" ? bucket.chat : bucket.transform;
}

export function assertAndConsumeUsage(
  subjectId: string,
  isPro: boolean,
  kind: UsageKind
): { ok: true; used: number; limit: number } | { ok: false; used: number; limit: number; code: "free_limit" | "pro_fair_use" } {
  const limit = resolveDailyQuota(isPro, kind);
  const bucket = getBucket(subjectId);
  const used = kind === "chat" ? bucket.chat : bucket.transform;
  if (used >= limit) {
    return {
      ok: false,
      used,
      limit,
      code: isPro ? "pro_fair_use" : "free_limit",
    };
  }
  if (kind === "chat") bucket.chat += 1;
  else bucket.transform += 1;
  return {
    ok: true,
    used: used + 1,
    limit,
  };
}

/** Test helper */
export function __resetUsageMeterForTests() {
  buckets.clear();
}

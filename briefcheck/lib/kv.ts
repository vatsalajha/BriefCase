// Vercel KV (Redis) wrapper — no-ops gracefully if KV is not configured.
// Setup: vercel kv create briefcase-stats  →  vercel env pull
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const { kv } = await import("@vercel/kv");
  return kv;
}

/** Call after every successful analysis to record usage. */
export async function trackAnalysis(citationCount: number) {
  const kv = await getKV();
  if (!kv) return;
  const today = new Date().toISOString().split("T")[0];
  try {
    await Promise.all([
      kv.incr("stats:total_analyses"),
      kv.incrby("stats:total_citations", Math.max(0, citationCount)),
      kv.incr(`stats:daily:${today}`),
      kv.set("stats:last_seen", new Date().toISOString()),
    ]);
  } catch (e) {
    console.warn("[kv] trackAnalysis failed (non-fatal):", e);
  }
}

/** Return full stats for the admin dashboard, or null if KV unavailable. */
export async function getAdminStats() {
  const kv = await getKV();
  if (!kv) return null;
  try {
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }

    const [totalAnalyses, totalCitations, lastSeen, disabled, dailyLimit, ...dailyCounts] =
      await Promise.all([
        kv.get<number>("stats:total_analyses"),
        kv.get<number>("stats:total_citations"),
        kv.get<string>("stats:last_seen"),
        kv.get<boolean>("service:disabled"),
        kv.get<number>("service:daily_limit"),
        ...days.map((d) => kv.get<number>(`stats:daily:${d}`)),
      ]);

    return {
      total_analyses: (totalAnalyses as number) ?? 0,
      total_citations: (totalCitations as number) ?? 0,
      last_seen: (lastSeen as string) ?? null,
      today: (dailyCounts[days.length - 1] as number) ?? 0,
      service_enabled: !(disabled as boolean),
      daily_limit: (dailyLimit as number) ?? 0,
      daily: days.map((d, i) => ({ date: d, count: (dailyCounts[i] as number) ?? 0 })),
    };
  } catch (e) {
    console.warn("[kv] getAdminStats failed:", e);
    return null;
  }
}

/** Returns true if analysis requests should proceed. */
export async function isServiceEnabled(): Promise<boolean> {
  const kv = await getKV();
  if (!kv) return true;
  try {
    const disabled = await kv.get<boolean>("service:disabled");
    return !disabled;
  } catch {
    return true;
  }
}

/** Returns { ok: true } if under the daily limit (or no limit set). */
export async function checkDailyLimit(): Promise<{ ok: boolean; count: number; limit: number }> {
  const kv = await getKV();
  if (!kv) return { ok: true, count: 0, limit: 0 };
  try {
    const today = new Date().toISOString().split("T")[0];
    const [limit, count] = await Promise.all([
      kv.get<number>("service:daily_limit"),
      kv.get<number>(`stats:daily:${today}`),
    ]);
    const l = (limit as number) ?? 0;
    const c = (count as number) ?? 0;
    if (!l) return { ok: true, count: c, limit: l };
    return { ok: c < l, count: c, limit: l };
  } catch {
    return { ok: true, count: 0, limit: 0 };
  }
}

export async function setServiceEnabled(enabled: boolean) {
  const kv = await getKV();
  if (!kv) throw new Error("KV not configured — add KV_REST_API_URL and KV_REST_API_TOKEN");
  if (enabled) {
    await kv.del("service:disabled");
  } else {
    await kv.set("service:disabled", true);
  }
}

export async function setDailyLimit(limit: number) {
  const kv = await getKV();
  if (!kv) throw new Error("KV not configured — add KV_REST_API_URL and KV_REST_API_TOKEN");
  await kv.set("service:daily_limit", limit);
}

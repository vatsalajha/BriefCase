/**
 * TrustFoundry API client — backup citation verifier
 * https://api.trustfoundry.ai/v1
 *
 * Used as a secondary source when Midpage doesn't find a case.
 * Degrades gracefully if the API is unreachable.
 */

const TF_BASE = "https://api.trustfoundry.ai/v1";

export interface TrustFoundryCase {
  id: string;
  case_name?: string;
  citation?: string;
  court?: string;
  date?: string;
  treatment?: string; // "positive" | "negative" | "neutral"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function tfHeaders() {
  return {
    Authorization: `Bearer ${process.env.TRUSTFOUNDARY_API_KEY}`,
    "X-API-Key": process.env.TRUSTFOUNDARY_API_KEY ?? "",
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "BriefCase/1.0 (legal-brief-analyzer; +https://github.com/vatsalajha/BriefCase)",
  };
}

/**
 * Look up a case by citation string.
 * Returns the matched case or null. Never throws.
 */
export async function trustFoundryLookup(
  citation: string
): Promise<TrustFoundryCase | null> {
  if (!process.env.TRUSTFOUNDARY_API_KEY) return null;

  try {
    const url = `${TF_BASE}/cases?citation=${encodeURIComponent(citation)}`;
    const res = await fetch(url, {
      headers: tfHeaders(),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      // Check if it's a Cloudflare challenge (returns HTML)
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        console.warn(`[trustfoundry] Cloudflare challenge — API not accessible from server`);
        return null;
      }
      console.warn(`[trustfoundry] lookup failed: ${res.status}`);
      return null;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      console.warn(`[trustfoundry] Non-JSON response — Cloudflare may be intercepting`);
      return null;
    }

    const data = await res.json();
    // Handle { cases: [...] } or bare array or single object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cases: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data.cases)
      ? data.cases
      : data.id
      ? [data]
      : [];

    return cases[0] ?? null;
  } catch (err) {
    // Timeout or network error — fail silently
    console.warn("[trustfoundry] lookup error:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Search for a case by name.
 * Returns the top match or null. Never throws.
 */
export async function trustFoundrySearch(
  caseName: string
): Promise<TrustFoundryCase | null> {
  if (!process.env.TRUSTFOUNDARY_API_KEY) return null;

  try {
    const url = `${TF_BASE}/search?q=${encodeURIComponent(caseName)}&limit=1`;
    const res = await fetch(url, {
      headers: tfHeaders(),
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("json")) return null;
      console.warn(`[trustfoundry] search failed: ${res.status}`);
      return null;
    }

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("json")) return null;

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = Array.isArray(data)
      ? data
      : Array.isArray(data.results)
      ? data.results
      : Array.isArray(data.cases)
      ? data.cases
      : [];

    return results[0] ?? null;
  } catch (err) {
    console.warn("[trustfoundry] search error:", err instanceof Error ? err.message : err);
    return null;
  }
}

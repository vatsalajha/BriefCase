// Midpage API client — https://app.midpage.ai/api/v1
// Uses POST /opinions/get with JSON body for batch citation lookup.

export const MIDPAGE_API_BASE = "https://app.midpage.ai/api/v1";

// Shape returned by Midpage opinion lookup
export interface MidpageOpinion {
  id: string;
  case_name: string;
  court_id?: string;
  court_name?: string;
  court_abbreviation?: string;
  date_filed?: string;
  docket_number?: string;
  judge_name?: string;
  citations?: { cite?: string; cited_as?: string; volume?: string; reporter?: string; page?: string }[];
  citation_count?: number;
  overall_treatment?: string; // "Positive" | "Negative" | "Caution" | "Neutral"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface MidpageTreatment {
  overall_treatment?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.MIDPAGE_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Look up one or more citations using POST /opinions/get.
 * Returns an array of matched opinions (may be shorter than input if some are not found).
 */
export async function lookupCitations(
  citations: string[]
): Promise<MidpageOpinion[]> {
  const res = await fetch(`${MIDPAGE_API_BASE}/opinions/get`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ citations }),
  });

  if (!res.ok) {
    console.warn(`[midpage] POST /opinions/get failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const data = await res.json();
  // Response: { opinions: [...], citation_matches: [...] }
  return Array.isArray(data.opinions) ? data.opinions : [];
}

/**
 * Look up a single citation.
 * overall_treatment is included in the opinion object directly.
 * Returns the matched opinion or null.
 */
export async function lookupByCitation(
  citation: string
): Promise<MidpageOpinion | null> {
  const opinions = await lookupCitations([citation]);
  return opinions[0] ?? null;
}

/**
 * Fetch the full opinion text for a known opinion ID.
 * Returns raw HTML/text or null.
 */
export async function getOpinionText(opinionId: string): Promise<string | null> {
  const url = `${MIDPAGE_API_BASE}/opinions/${opinionId}`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.warn(`[midpage] getOpinionText failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  // Try common field names for the opinion body
  return data.text ?? data.opinion_text ?? data.content ?? data.html ?? null;
}

/**
 * Fetch citator treatment for an opinion ID.
 * NOTE: overall_treatment is now returned in lookupByCitation — only call this
 * if you need the full treatment breakdown and have an opinion ID already.
 */
export async function getCitatorTreatment(
  opinionId: string
): Promise<MidpageTreatment | null> {
  const url = `${MIDPAGE_API_BASE}/opinions/${opinionId}/treatment`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.warn(`[midpage] getCitatorTreatment failed: ${res.status} ${res.statusText}`);
    return null;
  }

  return res.json();
}

/**
 * Search for a case by name (fallback when citation lookup fails).
 */
export async function searchByName(
  caseName: string
): Promise<MidpageOpinion | null> {
  const url = `${MIDPAGE_API_BASE}/opinions/search?q=${encodeURIComponent(caseName)}&limit=1`;

  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    console.warn(`[midpage] searchByName failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  const results: MidpageOpinion[] = Array.isArray(data)
    ? data
    : data.results ?? data.opinions ?? data.data ?? [];

  return results[0] ?? null;
}

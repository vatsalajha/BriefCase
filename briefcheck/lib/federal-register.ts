import { anthropic } from "./claude";
import type { RegulatoryAlert } from "./types";

const FR_BASE = "https://www.federalregister.gov/api/v1";

// Strip markdown fences from Claude output
function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// Score a document's relevance to a search topic (0–100)
function scoreRelevance(
  title: string,
  abstract: string,
  topic: string,
  significant: boolean
): { score: number; explanation: string } {
  const lc = (s: string) => s.toLowerCase();
  const topicTerms = lc(topic).split(/\s+/).filter((t) => t.length > 3);

  let score = 45; // base score for appearing in search results
  const matched: string[] = [];

  for (const term of topicTerms) {
    if (lc(title).includes(term)) {
      score += 20;
      matched.push(`title matches "${term}"`);
      break; // only count once per title
    }
  }
  for (const term of topicTerms) {
    if (lc(abstract).includes(term)) {
      score += 10;
      matched.push(`abstract mentions "${term}"`);
      break;
    }
  }
  if (significant) {
    score += 10;
    matched.push("designated significant rule");
  }

  score = Math.min(100, score);

  const explanation =
    matched.length > 0
      ? `Relevant to topic "${topic}": ${matched.join("; ")}.`
      : `Returned for search topic "${topic}".`;

  return { score, explanation };
}

// Fetch documents from Federal Register for one topic
async function fetchForTopic(
  topic: string,
  dateRange: { start: string; end: string }
): Promise<RegulatoryAlert[]> {
  const params = new URLSearchParams({
    "conditions[term]": topic,
    "conditions[publication_date][gte]": dateRange.start,
    "conditions[publication_date][lte]": dateRange.end,
    per_page: "5",
    order: "newest",
  });
  // Use fields[] (array style) — comma-separated fields= causes 500 on this API
  for (const f of ["title", "type", "abstract", "agencies", "publication_date",
                    "effective_on", "comments_close_on", "html_url", "pdf_url",
                    "document_number", "significant"]) {
    params.append("fields[]", f);
  }

  // Add type filters for rules, proposed rules, notices
  params.append("conditions[type][]", "RULE");
  params.append("conditions[type][]", "PRORULE");
  params.append("conditions[type][]", "NOTICE");

  const res = await fetch(`${FR_BASE}/documents.json?${params}`, {
    headers: { Accept: "application/json" },
    // 10-second timeout via AbortSignal
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    results?: Array<{
      title: string;
      type: string;
      abstract?: string;
      agencies?: Array<{ name: string }>;
      publication_date: string;
      effective_on?: string;
      comments_close_on?: string;
      html_url: string;
      pdf_url: string;
      document_number: string;
      significant?: boolean;
    }>;
  };

  if (!Array.isArray(data.results)) return [];

  return data.results.map((doc) => {
    const significant = doc.significant ?? false;
    const abstract = doc.abstract ?? "";
    const { score, explanation } = scoreRelevance(
      doc.title,
      abstract,
      topic,
      significant
    );

    return {
      title: doc.title,
      type: doc.type,
      abstract,
      agencies: (doc.agencies ?? []).map((a) => a.name),
      publicationDate: doc.publication_date,
      effectiveDate: doc.effective_on ?? null,
      commentEndDate: doc.comments_close_on ?? null,
      htmlUrl: doc.html_url,
      pdfUrl: doc.pdf_url,
      documentNumber: doc.document_number,
      significantRule: significant,
      relevanceScore: score,
      relevanceExplanation: explanation,
    };
  });
}

export async function searchFederalRegister(
  topics: string[],
  dateRange: { start: string; end: string }
): Promise<RegulatoryAlert[]> {
  const allResults: RegulatoryAlert[] = [];

  for (const topic of topics.slice(0, 3)) {
    try {
      const results = await fetchForTopic(topic, dateRange);
      allResults.push(...results);
    } catch (err) {
      console.warn(`[federal-register] fetch failed for topic "${topic}":`, err);
    }
    // Brief pause between requests to be polite
    await new Promise((r) => setTimeout(r, 300));
  }

  // Deduplicate by document number, keep highest relevance score
  const byDoc = new Map<string, RegulatoryAlert>();
  for (const alert of allResults) {
    const existing = byDoc.get(alert.documentNumber);
    if (!existing || alert.relevanceScore > existing.relevanceScore) {
      byDoc.set(alert.documentNumber, alert);
    }
  }

  // Sort by relevance score descending
  return [...byDoc.values()]
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 10);
}

export async function extractTopicsFromBrief(briefText: string): Promise<string[]> {
  // Use the first 4000 chars — enough for topic extraction without burning tokens
  const excerpt = briefText.slice(0, 4000);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      system: `Extract 3-5 specific regulatory topics from this legal brief that would appear in Federal Register documents. Return ONLY a JSON array of short search terms. Examples: ["data privacy", "non-compete agreements", "FTC enforcement", "HIPAA compliance", "securities fraud"]. Keep terms specific, regulatory-focused, and 1-4 words each. No explanations, no markdown fences.`,
      messages: [
        {
          role: "user",
          content: `Extract regulatory search topics from this brief excerpt:\n\n${excerpt}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];

    const parsed = JSON.parse(stripFences(textBlock.text));
    if (!Array.isArray(parsed)) return [];

    return (parsed as unknown[])
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 5);
  } catch (err) {
    console.warn("[federal-register] topic extraction failed:", err);
    return [];
  }
}

// Returns the default date range: last 90 days → today
export function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

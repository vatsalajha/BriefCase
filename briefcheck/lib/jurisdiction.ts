import Anthropic from "@anthropic-ai/sdk";
import type { JurisdictionResult, JurisdictionAnalysis } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

// Default states for auto-analysis — legally significant + diverse
export const DEFAULT_STATES = ["CA", "TX", "NY", "DE", "FL"];

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

/**
 * Detect contract clauses in a brief and return typed extracts.
 * Returns an empty array if no clauses are found.
 */
export async function extractClauses(
  briefText: string
): Promise<Array<{ clause: string; clauseType: string }>> {
  const truncated = briefText.slice(0, 12000); // keep within token budget

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: `You are a contract law expert. Scan a legal document for contract clauses that have jurisdiction-dependent enforceability.

Identify clauses of these types (and ONLY these types):
- non-compete
- arbitration
- liability-cap
- nda
- non-solicitation

For each clause found, extract the exact verbatim text (up to ~200 words) and its type.

Return ONLY a JSON array. If no qualifying clauses are found, return an empty array [].

Example:
[
  {
    "clauseType": "non-compete",
    "clause": "Employee agrees that for a period of two (2) years following termination, Employee shall not engage in any business that competes with Employer within the United States."
  }
]`,
    messages: [
      {
        role: "user",
        content: `Scan this document for contract clauses:\n\n${truncated}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") return [];

  try {
    const parsed = JSON.parse(stripFences(block.text));
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { clause: string; clauseType: string } =>
        typeof item.clause === "string" && typeof item.clauseType === "string"
    );
  } catch {
    return [];
  }
}

/**
 * Analyze a single contract clause across the specified state codes.
 */
export async function analyzeClauseJurisdictions(
  clauseText: string,
  states: string[]
): Promise<JurisdictionResult> {
  const stateList = states
    .map((code) => `${STATE_NAMES[code] ?? code} (${code})`)
    .join(", ");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: `You are an expert in US state contract law. Given a contract clause and a list of states, analyze enforceability in each state.

For each state return:
- status: "enforceable" | "partially_enforceable" | "void" | "uncertain"
- explanation: 1–2 sentences on why
- keyStatute: the governing statute or leading case (be specific — cite actual statute codes)
- recentChanges: any 2024–2026 legislative or case law changes, or null if none

Common rules to apply:
• Non-compete: California (Cal. Bus. & Prof. Code § 16600) and Minnesota ban them outright. Many states allow with reasonable time/geography limits. Recent: FTC rule struck down (2024), but state bans remain. Minnesota banned them Jan 2023.
• Arbitration: Generally enforceable under FAA but some states restrict mandatory arbitration for employment/consumer claims.
• Liability caps: Most states allow except for gross negligence/willful misconduct. Some states (NJ, etc.) void caps in certain contexts.
• NDA: Broadly enforceable; some states limit NDAs covering illegal workplace conduct (CA SB 331, NY law).
• Non-solicitation: More permissive than non-compete. California still limits them post-2024.

IMPORTANT GUIDANCE for common clause types:
- Non-compete with 24-month duration and 50-mile radius:
  * California: ALWAYS void — § 16600 is a near-absolute ban with no reasonableness exception. Use status "void".
  * Texas: Generally ENFORCEABLE when ancillary to an otherwise enforceable agreement with confidentiality or trade secret protections (Tex. Bus. & Com. Code § 15.50). 24 months and 50 miles are within ranges Texas courts have upheld. Use status "enforceable".
  * Florida: ENFORCEABLE — Fla. Stat. § 542.335 creates a statutory presumption of validity and expressly lists 2 years as presumptively reasonable. Use status "enforceable".
  * New York: PARTIAL — courts apply a three-prong reasonableness test (necessary to protect legitimate interest, not impose undue hardship, not injure the public). May blue-pencil or reform. Use status "partially_enforceable".
  * Delaware: PARTIAL — reasonableness test applies on a fact-specific basis; courts will scrutinize scope. Use status "partially_enforceable".

Be definitive where the law is clear. Do not hedge on California (it is void — no exceptions for commercial agreements) or Florida (it is enforceable — the statute presumes validity). Only use "partially_enforceable" where courts genuinely apply a fact-specific reasonableness test and outcomes vary.

Return ONLY valid JSON matching this structure (clauseType inferred from the clause):
{
  "clauseType": "non-compete",
  "jurisdictions": [
    {
      "state": "California",
      "stateCode": "CA",
      "status": "void",
      "explanation": "California broadly prohibits non-compete clauses with narrow exceptions for business sales.",
      "keyStatute": "Cal. Bus. & Prof. Code § 16600",
      "recentChanges": "AB 1076 (2024) strengthened the ban and requires employers to notify former employees of void agreements."
    }
  ]
}`,
    messages: [
      {
        role: "user",
        content: `Analyze this contract clause across these states: ${stateList}\n\nClause:\n${clauseText}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    return { clause: clauseText, clauseType: "unknown", jurisdictions: [] };
  }

  try {
    const parsed = JSON.parse(stripFences(block.text)) as {
      clauseType?: string;
      jurisdictions?: JurisdictionAnalysis[];
    };
    return {
      clause: clauseText,
      clauseType: parsed.clauseType ?? "unknown",
      jurisdictions: Array.isArray(parsed.jurisdictions) ? parsed.jurisdictions : [],
    };
  } catch {
    return { clause: clauseText, clauseType: "unknown", jurisdictions: [] };
  }
}

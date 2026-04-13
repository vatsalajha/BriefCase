import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { Citation } from "./types";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EXTRACT_MODEL = "claude-sonnet-4-6";
const ANALYZE_MODEL = "claude-sonnet-4-6";

// ─── OpenAI fallback ──────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) return null;
  _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

/** Call Claude with automatic fallback to GPT-4o if Anthropic fails */
async function callLLM(opts: {
  system: string;
  user: string;
  maxTokens: number;
  model?: string;
}): Promise<string> {
  const { system, user, maxTokens, model = EXTRACT_MODEL } = opts;

  // Try Anthropic first
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (textBlock && textBlock.type === "text") return textBlock.text;
    throw new Error("No text block in Anthropic response");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isCreditsError =
      errMsg.includes("credit") ||
      errMsg.includes("quota") ||
      errMsg.includes("billing") ||
      (err instanceof Anthropic.PermissionDeniedError) ||
      (err instanceof Anthropic.RateLimitError);

    if (!isCreditsError) throw err; // hard error, don't fall back

    console.warn("[claude] Anthropic API failed, falling back to OpenAI:", errMsg);
  }

  // Fallback: OpenAI GPT-4o
  const client = getOpenAI();
  if (!client) throw new Error("Anthropic credits exhausted and OPENAI_API_KEY not set");

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: maxTokens,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: user },
    ],
  });

  return completion.choices[0]?.message?.content ?? "";
}

// ─── Utilities ────────────────────────────────────────────────────────────────

// Strip HTML tags and collapse whitespace
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// Strip markdown code fences that Claude sometimes wraps JSON in
function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

// ─── Public functions ─────────────────────────────────────────────────────────

export async function extractCitations(briefText: string): Promise<Citation[]> {
  const text = await callLLM({
    model: EXTRACT_MODEL,
    maxTokens: 4096,
    system: `You are a legal citation extraction expert. Given a legal brief, extract every case law citation. For each citation, identify:
1. The raw citation text as it appears in the brief
2. The case name (e.g., "Smith v. Jones")
3. The reporter citation in standard format (e.g., "542 U.S. 296") — just volume, reporter, and page number
4. The year
5. The legal proposition — what does the brief claim this case stands for? What point is the author using this case to support?
6. The context — the full sentence or paragraph where this citation appears

Return a JSON array. Return ONLY the JSON array with no markdown formatting, no backticks, no explanation.

Example output:
[
  {
    "rawText": "Miranda v. Arizona, 384 U.S. 436 (1966)",
    "caseName": "Miranda v. Arizona",
    "citation": "384 U.S. 436",
    "year": "1966",
    "proposition": "The Fifth Amendment requires that suspects be informed of their rights before custodial interrogation",
    "contextInBrief": "As established in Miranda v. Arizona, 384 U.S. 436 (1966), the defendant should have been advised of his constitutional rights prior to any questioning."
  }
]`,
    user: `Extract all case law citations from this legal brief:\n\n${briefText}`,
  });

  const cleaned = stripMarkdownFences(text);

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed.map(
      (
        item: {
          rawText?: string;
          caseName?: string;
          citation?: string;
          year?: string;
          proposition?: string;
          contextInBrief?: string;
        },
        i: number
      ): Citation => ({
        id: `citation-${i}`,
        rawText: item.rawText ?? "",
        caseName: item.caseName ?? "",
        citation: item.citation ?? "",
        year: item.year ?? "",
        proposition: item.proposition ?? "",
        contextInBrief: item.contextInBrief ?? "",
      })
    );
  } catch {
    return [];
  }
}

export async function analyzeHolding(
  proposition: string,
  opinionText: string,
  caseName: string
): Promise<{ match: boolean; analysis: string }> {
  const cleaned = stripHtml(opinionText).slice(0, 6000);

  const text = await callLLM({
    model: ANALYZE_MODEL,
    maxTokens: 1024,
    system: `You are a legal analysis expert. Given a legal proposition that a brief claims a case stands for, and the actual text of the court opinion, determine:
1. Does the opinion actually support this proposition? (true/false)
2. A brief explanation (2-3 sentences max) of why it matches or doesn't.

Consider: The proposition doesn't need to be a perfect quote — it should capture the holding or a key principle from the case. Be somewhat generous but flag clear misrepresentations.

Return ONLY a JSON object: {"match": true/false, "analysis": "your explanation"}`,
    user: `Case: ${caseName}

Proposition claimed in brief: ${proposition}

Opinion text:
${cleaned}`,
  });

  const cleaned2 = stripMarkdownFences(text);

  try {
    const parsed = JSON.parse(cleaned2) as { match: boolean; analysis: string };
    return {
      match: Boolean(parsed.match),
      analysis: parsed.analysis ?? "",
    };
  } catch {
    const matchTrue = /\"match\"\s*:\s*true/i.test(cleaned2);
    return {
      match: matchTrue,
      analysis: cleaned2.slice(0, 300),
    };
  }
}

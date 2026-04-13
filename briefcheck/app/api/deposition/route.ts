import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisReport } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface DepositionQuestion {
  text: string;
  citation: string | null;   // which case this challenges, if any
  challengeFlag: boolean;    // true if targets a flagged/not-found citation
  tip: string;               // brief tactical note for the deposing attorney
}

export interface DepositionTopic {
  name: string;
  questions: DepositionQuestion[];
}

export interface DepositionOutline {
  witness: string;
  topics: DepositionTopic[];
}

// Repair truncated JSON from Claude — closes any open strings, brackets, braces
function repairJSON(text: string): string {
  let cleaned = text.trim();

  // Strip markdown wrappers
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();

  // If truncated mid-string, close the open string
  const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) cleaned += '"';

  // Close missing brackets and braces (innermost first)
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;

  for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const { report, witnessRole }: { report: AnalysisReport; witnessRole: string } =
      await req.json();

    if (!report) {
      return NextResponse.json({ error: "report is required" }, { status: 400 });
    }

    // Build a compact citation summary for Claude
    const citationSummary = report.results
      .map((r) => {
        const flag =
          r.status === "not_found"
            ? "[HALLUCINATED/NOT FOUND]"
            : r.status === "warning"
            ? "[NEGATIVE TREATMENT]"
            : "[VERIFIED]";
        const holding = r.citation.proposition
          ? `Proposition: "${r.citation.proposition}"`
          : "";
        const analysis = r.holdingAnalysis ? `Analysis: ${r.holdingAnalysis}` : "";
        return [
          `${flag} ${r.citation.rawText}`,
          holding,
          analysis,
          r.overallTreatment ? `Treatment: ${r.overallTreatment}` : "",
        ]
          .filter(Boolean)
          .join("\n  ");
      })
      .join("\n\n");

    const systemPrompt = `You are an expert litigator preparing deposition questions.
Return ONLY valid JSON — no explanation, no markdown, no preamble.
Keep the total response under 3000 tokens. Limit to 4-5 topic areas with 3 questions each. Be concise.`;

    const userPrompt = `A legal brief has been analyzed. Here is a summary of its citations and holdings:

${citationSummary}

Witness role: ${witnessRole || "adverse party / 30(b)(6) corporate designee"}

Generate a structured deposition outline targeting the weaknesses exposed by the citation analysis. Focus on:
1. Attacking reliance on hallucinated or not-found citations
2. Exploiting cases with negative citator treatment
3. Challenging the propositions the brief claims these cases stand for
4. General credibility and foundation questions

Return ONLY valid JSON in this exact structure:
{
  "witness": "${witnessRole || "Adverse Corporate Designee"}",
  "topics": [
    {
      "name": "Topic Name",
      "questions": [
        {
          "text": "Question text ending with a question mark?",
          "citation": "Case name or null",
          "challengeFlag": true,
          "tip": "One-sentence tactical note"
        }
      ]
    }
  ]
}

Generate exactly 4-5 topics with exactly 3 questions each. Make questions specific and legally precise.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
    }

    const repaired = repairJSON(block.text);
    console.log(`[deposition] raw=${block.text.length} repaired=${repaired.length} stop_reason=${response.stop_reason}`);

    const outline: DepositionOutline = JSON.parse(repaired);
    return NextResponse.json(outline);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[deposition] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

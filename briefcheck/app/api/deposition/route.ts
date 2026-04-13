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

    const prompt = `You are an expert litigator preparing deposition questions for the opposing party.

A legal brief has been analyzed. Here is a summary of its citations and holdings:

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

Generate 4-6 topics with 3-5 questions each. Make questions specific and legally precise.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json({ error: "No response from Claude" }, { status: 500 });
    }

    // Strip markdown fences if present
    const cleaned = block.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    const outline: DepositionOutline = JSON.parse(cleaned);

    return NextResponse.json(outline);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

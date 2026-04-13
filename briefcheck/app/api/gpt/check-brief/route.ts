import { NextRequest, NextResponse } from "next/server";
import { extractCitations } from "@/lib/claude";
import { lookupByCitation } from "@/lib/midpage";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text: string = body.text?.trim();

    if (!text) {
      return NextResponse.json(
        { error: '"text" field is required.' },
        { status: 400, headers: CORS }
      );
    }

    // Extract citations via Claude
    const citations = await extractCitations(text);

    if (citations.length === 0) {
      return NextResponse.json(
        {
          total_citations: 0,
          verified: 0,
          warnings: 0,
          not_found: 0,
          results: [],
          report_summary: "No citations found in the provided text.",
        },
        { headers: CORS }
      );
    }

    // Verify each citation against Midpage
    let verifiedCount = 0;
    let warningsCount = 0;
    let notFoundCount = 0;

    const results = [];

    for (let i = 0; i < citations.length; i++) {
      const c = citations[i];
      const opinion = await lookupByCitation(c.citation);

      if (!opinion) {
        notFoundCount++;
        results.push({
          citation_text: c.citation,
          case_name: c.caseName || null,
          status: "not_found",
          treatment: null,
          summary: `❌ NOT FOUND. This citation does not exist in any court database. Likely AI hallucination.`,
        });
      } else {
        const treatment = opinion.overall_treatment ?? null;
        const isNegative = treatment === "Negative" || treatment === "Caution";

        if (isNegative) {
          warningsCount++;
          results.push({
            citation_text: c.citation,
            case_name: opinion.case_name ?? c.caseName ?? null,
            status: "warning",
            treatment,
            summary: `⚠️ Citation verified but has ${treatment} treatment. This case may have been overruled or limited. Verify before citing.`,
          });
        } else {
          verifiedCount++;
          results.push({
            citation_text: c.citation,
            case_name: opinion.case_name ?? c.caseName ?? null,
            status: "verified",
            treatment: treatment ?? "Positive",
            summary: `✅ Citation verified. Case exists and has ${treatment ?? "positive"} treatment.`,
          });
        }
      }

      if (i < citations.length - 1) await delay(200);
    }

    const total = citations.length;
    const report_summary = [
      `Found ${total} citation${total !== 1 ? "s" : ""}:`,
      `${verifiedCount} verified ✅,`,
      `${warningsCount} warning${warningsCount !== 1 ? "s" : ""} ⚠️,`,
      `${notFoundCount} not found ❌.`,
      notFoundCount > 0 ? "Remove unfound citations before filing." : "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    return NextResponse.json(
      {
        total_citations: total,
        verified: verifiedCount,
        warnings: warningsCount,
        not_found: notFoundCount,
        results,
        report_summary,
      },
      { headers: CORS }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS });
  }
}

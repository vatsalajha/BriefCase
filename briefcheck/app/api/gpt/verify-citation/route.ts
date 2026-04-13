import { NextRequest, NextResponse } from "next/server";
import { lookupByCitation } from "@/lib/midpage";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const citation: string = body.citation?.trim();

    if (!citation) {
      return NextResponse.json(
        { error: '"citation" field is required.' },
        { status: 400, headers: CORS }
      );
    }

    const opinion = await lookupByCitation(citation);

    if (!opinion) {
      return NextResponse.json(
        {
          found: false,
          citation,
          verification_status: "not_found",
          warning:
            "This citation was NOT found in any federal or state court database. It may be fabricated or incorrectly formatted. Do NOT use in any filing.",
        },
        { headers: CORS }
      );
    }

    const treatment = opinion.overall_treatment ?? null;
    const isNegative = treatment === "Negative" || treatment === "Caution";

    return NextResponse.json(
      {
        found: true,
        case_name: opinion.case_name ?? null,
        citation,
        court: opinion.court_name ?? null,
        court_abbreviation: opinion.court_abbreviation ?? null,
        date_filed: opinion.date_filed ?? null,
        citator_treatment: treatment,
        citation_count: opinion.citation_count ?? null,
        treatment_warning: isNegative
          ? `⚠️ This case has ${treatment?.toUpperCase()} citator treatment. It may have been overruled or significantly limited. Verify current validity before citing.`
          : null,
        verification_status: isNegative ? "found_with_warning" : "found",
      },
      { headers: CORS }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS });
  }
}

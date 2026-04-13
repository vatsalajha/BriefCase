import { NextRequest, NextResponse } from "next/server";
import { lookupByCitation, searchByName, getCitatorTreatment, getOpinionText } from "@/lib/midpage";

// Quick single-citation test endpoint.
// POST { "citation": "410 U.S. 113" }
// Optional: POST { "citation": "...", "caseName": "Roe v. Wade" } for name fallback
// Returns the raw Midpage result directly — useful for debugging.

export async function POST(request: NextRequest) {
  let body: { citation?: string; caseName?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.citation?.trim()) {
    return NextResponse.json({ error: '"citation" field is required.' }, { status: 400 });
  }

  const citationStr = body.citation.trim();
  const caseNameStr = body.caseName?.trim();

  // Primary lookup
  let opinion = await lookupByCitation(citationStr);

  // Name fallback
  if (!opinion && caseNameStr) {
    opinion = await searchByName(caseNameStr);
  }

  if (!opinion) {
    return NextResponse.json({ found: false, citation: citationStr });
  }

  const opinionId = String(opinion.id);

  // Fetch treatment and opinion text in parallel
  const [treatment, opinionText] = await Promise.allSettled([
    getCitatorTreatment(opinionId),
    getOpinionText(opinionId),
  ]);

  return NextResponse.json({
    found: true,
    citation: citationStr,
    opinion,
    treatment: treatment.status === "fulfilled" ? treatment.value : null,
    opinionTextSnippet:
      opinionText.status === "fulfilled" && opinionText.value
        ? opinionText.value.slice(0, 500)
        : null,
  });
}

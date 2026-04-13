import { NextRequest, NextResponse } from "next/server";
import { analyzeClauseJurisdictions, DEFAULT_STATES } from "@/lib/jurisdiction";

export async function POST(request: NextRequest) {
  let body: { clause?: string; states?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { clause, states } = body;

  if (!clause || typeof clause !== "string" || !clause.trim()) {
    return NextResponse.json({ error: "clause is required." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const targetStates =
    Array.isArray(states) && states.length > 0 ? states : DEFAULT_STATES;

  try {
    const result = await analyzeClauseJurisdictions(clause.trim(), targetStates);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[jurisdiction] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 500 }
    );
  }
}

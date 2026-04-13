import { NextRequest, NextResponse } from "next/server";
import {
  searchFederalRegister,
  extractTopicsFromBrief,
  defaultDateRange,
} from "@/lib/federal-register";

export async function POST(request: NextRequest) {
  let body: { text?: string; topics?: string[]; dateRange?: { start: string; end: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { text, topics: inputTopics, dateRange } = body;

  if (!text && (!inputTopics || inputTopics.length === 0)) {
    return NextResponse.json(
      { error: 'Provide "text" (brief text) or "topics" (string array).' },
      { status: 400 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY && text && !inputTopics) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured (required for topic extraction)." },
      { status: 500 }
    );
  }

  try {
    // Determine topics — use provided ones or extract from brief text
    let topics: string[] = inputTopics ?? [];
    if (topics.length === 0 && text) {
      topics = await extractTopicsFromBrief(text);
    }

    if (topics.length === 0) {
      return NextResponse.json({ topics: [], alerts: [] });
    }

    const range = dateRange ?? defaultDateRange();
    const alerts = await searchFederalRegister(topics, range);

    return NextResponse.json({ topics, alerts });
  } catch (err) {
    console.error("[regulatory] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Regulatory search failed." },
      { status: 500 }
    );
  }
}

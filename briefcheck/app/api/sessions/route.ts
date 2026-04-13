import { NextResponse } from "next/server";
import { getAllSessions } from "@/lib/store";

export async function GET() {
  const sessions = getAllSessions(50);
  return NextResponse.json({ sessions });
}

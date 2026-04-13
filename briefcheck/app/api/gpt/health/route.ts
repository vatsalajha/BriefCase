import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "BriefCase", version: "1.0.0" },
    { headers: CORS }
  );
}

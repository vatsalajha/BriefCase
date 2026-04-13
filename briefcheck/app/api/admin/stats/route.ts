import { NextRequest, NextResponse } from "next/server";
import { getAdminStats } from "@/lib/kv";

function checkAuth(req: NextRequest): boolean {
  const provided = req.headers.get("x-admin-key") ?? req.nextUrl.searchParams.get("key");
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || !provided) return false;
  return provided === adminKey;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getAdminStats();
  if (!stats) {
    return NextResponse.json(
      {
        error:
          "KV not configured. Run: vercel kv create briefcase-stats  then  vercel env pull. " +
          "Add KV_REST_API_URL and KV_REST_API_TOKEN to your environment.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(stats);
}

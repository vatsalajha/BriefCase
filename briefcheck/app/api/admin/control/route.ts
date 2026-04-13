import { NextRequest, NextResponse } from "next/server";
import { setServiceEnabled, setDailyLimit } from "@/lib/kv";

function checkAuth(req: NextRequest): boolean {
  const provided = req.headers.get("x-admin-key");
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || !provided) return false;
  return provided === adminKey;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as { action: string; enabled?: boolean; limit?: number };

  try {
    if (body.action === "toggle") {
      await setServiceEnabled(body.enabled ?? true);
      return NextResponse.json({ ok: true, enabled: body.enabled ?? true });
    }
    if (body.action === "limit") {
      const limit = Math.max(0, Math.floor(Number(body.limit) || 0));
      await setDailyLimit(limit);
      return NextResponse.json({ ok: true, limit });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}

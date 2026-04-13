/**
 * Midpage API smoke test
 * Usage: npx tsx --env-file .env.local scripts/test-midpage.ts
 *
 * Tests two citations:
 *   • 410 U.S. 113  (Roe v. Wade)  — should be FOUND with Negative treatment
 *   • 847 F.3d 1092 (fake)         — should be NOT FOUND
 */

const BASE = "https://app.midpage.ai/api/v1";

function headers() {
  const key = process.env.MIDPAGE_API_KEY;
  if (!key) {
    console.error("❌  MIDPAGE_API_KEY is not set. Run: npx tsx --env-file .env.local scripts/test-midpage.ts");
    process.exit(1);
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function lookupByCitation(citation: string) {
  const url = `${BASE}/opinions?citation=${encodeURIComponent(citation)}&limit=1`;
  console.log(`\n  GET ${url}`);
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function getCitatorTreatment(opinionId: string) {
  const url = `${BASE}/opinions/${opinionId}/treatment`;
  console.log(`  GET ${url}`);
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

function banner(title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${title}`);
  console.log("─".repeat(60));
}

async function main() {
  // ── Test 1: real citation (Roe v. Wade) ───────────────────────────────────

  banner("TEST 1 — Real citation: 410 U.S. 113 (Roe v. Wade)");
  const test1 = await lookupByCitation("410 U.S. 113");
  console.log(`\n  HTTP ${test1.status}`);
  console.log("  Body:", JSON.stringify(test1.body, null, 2));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results1: any[] = Array.isArray(test1.body)
    ? test1.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (test1.body as any)?.results ?? (test1.body as any)?.opinions ?? (test1.body as any)?.data ?? [];

  if (results1.length > 0) {
    const opinion = results1[0];
    const id = String(opinion.id ?? opinion.opinion_id ?? "");
    console.log(`\n  ✅ Found: "${opinion.case_name ?? opinion.name}" (id=${id})`);

    if (id) {
      banner("  → Fetching citator treatment");
      const treatment = await getCitatorTreatment(id);
      console.log(`  HTTP ${treatment.status}`);
      console.log("  Body:", JSON.stringify(treatment.body, null, 2));
    }
  } else {
    console.log("\n  ❌ Not found — check the citation format or API response shape above");
  }

  // ── Test 2: fake citation ──────────────────────────────────────────────────

  banner("TEST 2 — Fake citation: 847 F.3d 1092 (Henderson v. TechCorp)");
  const test2 = await lookupByCitation("847 F.3d 1092");
  console.log(`\n  HTTP ${test2.status}`);
  console.log("  Body:", JSON.stringify(test2.body, null, 2));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results2: any[] = Array.isArray(test2.body)
    ? test2.body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (test2.body as any)?.results ?? (test2.body as any)?.opinions ?? (test2.body as any)?.data ?? [];

  if (results2.length === 0) {
    console.log("\n  ✅ Correctly returned NOT FOUND");
  } else {
    console.log("\n  ⚠️  Unexpectedly found results — inspect above");
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  banner("SUMMARY");
  console.log(`  Test 1 (real):  ${results1.length > 0 ? "✅ PASS — case found" : "❌ FAIL — case not found"}`);
  console.log(`  Test 2 (fake):  ${results2.length === 0 ? "✅ PASS — correctly not found" : "❌ FAIL — fake case was found"}`);
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

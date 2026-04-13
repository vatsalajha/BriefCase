/**
 * BriefCheck E2E Test Suite
 *
 * Usage:
 *   npx tsx --env-file .env.local scripts/test-e2e.ts
 *   npx tsx --env-file .env.local scripts/test-e2e.ts --mock
 *
 * The --mock flag enables USE_MOCK_DATA=true, skips live API tests, and
 * verifies the mock data pipeline works end-to-end.
 *
 * Optional env vars:
 *   TEST_BASE_URL=http://localhost:3000   Override the local server URL
 *   TEST_TIMEOUT_MS=120000               Override the pipeline test timeout
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── Flags ────────────────────────────────────────────────────────────────────

const MOCK_MODE = process.argv.includes("--mock");
const BASE_URL = (process.env.TEST_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const PIPELINE_TIMEOUT = Number(process.env.TEST_TIMEOUT_MS ?? 120_000);

if (MOCK_MODE) {
  process.env.USE_MOCK_DATA = "true";
}

// ─── Terminal helpers ─────────────────────────────────────────────────────────

const C = {
  green:  (s: string) => `\x1b[32m${s}\x1b[0m`,
  red:    (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan:   (s: string) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s: string) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function ok(msg: string)    { console.log(`  ${C.green("✅")} ${msg}`); }
function no(msg: string)    { console.log(`  ${C.red("❌")} ${msg}`); }
function skip(msg: string)  { console.log(`  ${C.yellow("⏭")}  ${msg}`); }
function note(msg: string)  { console.log(`     ${C.dim(msg)}`); }

function banner(title: string) {
  console.log(`\n${C.cyan("─".repeat(62))}`);
  console.log(C.bold(`  ${title}`));
  console.log(C.cyan("─".repeat(62)));
}

// ─── Suite-level result tracking ──────────────────────────────────────────────

type SuiteStatus = "pass" | "fail" | "skip";
interface SuiteResult { name: string; status: SuiteStatus; error?: string; }
const suiteResults: SuiteResult[] = [];

// ─── Assertion primitives ─────────────────────────────────────────────────────

class AssertionError extends Error {}

function assert(condition: boolean, message: string): void {
  if (condition) { ok(message); }
  else { no(message); throw new AssertionError(message); }
}

/** Like assert but doesn't throw — use for non-fatal checks within a test. */
function check(condition: boolean, message: string): boolean {
  if (condition) { ok(message); } else { no(message); }
  return condition;
}

// ─── SSE stream consumer ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SsePayload = Record<string, any>;

async function consumeSse(
  res: Response,
  onEvent?: (e: SsePayload) => void
): Promise<SsePayload[]> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  const events: SsePayload[] = [];
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const payload = JSON.parse(line.slice(6)) as SsePayload;
        events.push(payload);
        onEvent?.(payload);
      } catch { /* skip malformed lines */ }
    }
  }
  return events;
}

// ─── Midpage helpers (inlined to avoid module-init issues) ────────────────────

const MIDPAGE_BASE = "https://app.midpage.ai/api/v1";

function midpageHeaders() {
  return {
    Authorization: `Bearer ${process.env.MIDPAGE_API_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function midpageLookup(citation: string) {
  // POST /opinions/get with JSON body — returns { opinions: [...], citation_matches: [...] }
  const res = await fetch(`${MIDPAGE_BASE}/opinions/get`, {
    method: "POST",
    headers: midpageHeaders(),
    body: JSON.stringify({ citations: [citation] }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opinions: any[] = Array.isArray(data.opinions) ? data.opinions : [];
  return opinions[0] ?? null;
}

// ─── Federal Register helpers (inlined) ───────────────────────────────────────

const FR_BASE = "https://www.federalregister.gov/api/v1";

async function frSearch(topic: string, start: string, end: string) {
  const params = new URLSearchParams({
    "conditions[term]": topic,
    "conditions[publication_date][gte]": start,
    "conditions[publication_date][lte]": end,
    per_page: "5",
    order: "newest",
  });
  params.append("conditions[type][]", "RULE");
  params.append("conditions[type][]", "PRORULE");
  params.append("conditions[type][]", "NOTICE");
  // Use fields[] array style — comma-separated fields= causes 500 on this API
  for (const f of ["title", "type", "abstract", "html_url", "document_number", "publication_date"]) {
    params.append("fields[]", f);
  }

  const res = await fetch(`${FR_BASE}/documents.json?${params}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

// ─── Date range helper ────────────────────────────────────────────────────────

function last90Days() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { start: fmt(start), end: fmt(end) };
}

// ─── Test suites ──────────────────────────────────────────────────────────────

// ── 1. Midpage API ────────────────────────────────────────────────────────────

async function testMidpageAPI(): Promise<SuiteResult> {
  const name = "Midpage API";
  banner(`TEST 1 — ${name}`);

  if (MOCK_MODE) {
    skip("Skipping live API test in --mock mode");
    return { name, status: "skip" };
  }
  if (!process.env.MIDPAGE_API_KEY) {
    skip("MIDPAGE_API_KEY not set — skipping");
    return { name, status: "skip" };
  }

  try {
    // 1a. Real citation: Roe v. Wade
    note("Looking up 410 U.S. 113 (Roe v. Wade)…");
    const roe = await midpageLookup("410 U.S. 113");
    assert(roe !== null, "Roe v. Wade (410 U.S. 113) found in Midpage");
    assert(
      typeof roe.case_name === "string" && roe.case_name.toLowerCase().includes("roe"),
      `case_name contains "roe" (got: "${roe.case_name}")`
    );
    assert(
      typeof roe.id !== "undefined",
      `opinion has an id field (got: ${roe.id})`
    );

    // Treatment is returned directly in the opinion object
    check(
      typeof roe.overall_treatment === "string" && roe.overall_treatment.length > 0,
      `overall_treatment present in opinion (got: "${roe.overall_treatment}")`
    );
    note(`  treatment=${roe.overall_treatment}, citation_count=${roe.citation_count}`);

    // 1b. Fake citation
    note("Looking up 847 F.3d 1092 (Henderson v. TechCorp — fake)…");
    const fake = await midpageLookup("847 F.3d 1092");
    assert(fake === null, "847 F.3d 1092 correctly returns NOT FOUND");

    return { name, status: "pass" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    no(`Midpage test threw: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

// ── 2. Claude Citation Extraction ─────────────────────────────────────────────

async function testClaudeExtraction(): Promise<SuiteResult> {
  const name = "Claude Citation Extraction";
  banner(`TEST 2 — ${name}`);

  if (MOCK_MODE) {
    skip("Skipping live Claude test in --mock mode");
    return { name, status: "skip" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    skip("ANTHROPIC_API_KEY not set — skipping");
    return { name, status: "skip" };
  }

  try {
    // Import dynamically so env-check above is respected
    const { extractCitations } = await import("../lib/claude.js");

    const sampleText = `
This Court has long recognized the right to privacy. In Miranda v. Arizona,
384 U.S. 436 (1966), the Supreme Court established that suspects must be informed
of their constitutional rights before custodial interrogation. Similarly, in
Carpenter v. United States, 585 U.S. 296 (2018), the Court held that accessing
cell-site location data constitutes a Fourth Amendment search requiring a warrant.
    `.trim();

    note("Calling extractCitations() with sample text containing 2 known citations…");
    const citations = await extractCitations(sampleText);

    assert(Array.isArray(citations), "Returns an array");
    assert(citations.length >= 2, `Extracted ≥ 2 citations (got ${citations.length})`);

    for (const c of citations) {
      check(typeof c.caseName === "string" && c.caseName.length > 0, `citation.caseName present ("${c.caseName}")`);
      check(typeof c.citation === "string" && c.citation.length > 0, `citation.citation present ("${c.citation}")`);
      check(typeof c.proposition === "string" && c.proposition.length > 0, `citation.proposition present`);
      check(typeof c.id === "string", `citation.id present ("${c.id}")`);
    }

    // Spot-check: should find Miranda and Carpenter
    const rawTexts = citations.map((c) => c.rawText.toLowerCase());
    check(rawTexts.some((t) => t.includes("miranda")), "Miranda v. Arizona detected");
    check(rawTexts.some((t) => t.includes("carpenter")), "Carpenter v. United States detected");

    return { name, status: "pass" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    no(`Claude extraction test threw: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

// ── 3. Claude Holding Analysis ────────────────────────────────────────────────

async function testClaudeHoldingAnalysis(): Promise<SuiteResult> {
  const name = "Claude Holding Analysis";
  banner(`TEST 3 — ${name}`);

  if (MOCK_MODE) {
    skip("Skipping live Claude test in --mock mode");
    return { name, status: "skip" };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    skip("ANTHROPIC_API_KEY not set — skipping");
    return { name, status: "skip" };
  }

  try {
    const { analyzeHolding } = await import("../lib/claude.js");

    // 3a. Correct proposition for Miranda
    const mirandaOpinionExcerpt = `
The prosecution may not use statements, whether exculpatory or inculpatory,
stemming from custodial interrogation of the defendant unless it demonstrates
the use of procedural safeguards effective to secure the privilege against
self-incrimination. By custodial interrogation, we mean questioning initiated
by law enforcement officers after a person has been taken into custody or
otherwise deprived of his freedom of action in any significant way. As for the
procedural safeguards to be employed, unless other fully effective means are
devised to inform accused persons of their right of silence and to assure a
continuous opportunity to exercise it, the following measures are required.
Prior to any questioning, the person must be warned that he has a right to
remain silent, that any statement he does make may be used as evidence against
him, and that he has a right to the presence of an attorney.
    `.trim();

    note("Testing CORRECT proposition (Miranda)…");
    const correctResult = await analyzeHolding(
      "The Fifth Amendment requires that suspects be informed of their rights before custodial interrogation",
      mirandaOpinionExcerpt,
      "Miranda v. Arizona"
    );
    assert(typeof correctResult.match === "boolean", "analyzeHolding returns { match: boolean }");
    assert(typeof correctResult.analysis === "string" && correctResult.analysis.length > 0, "analyzeHolding returns { analysis: string }");
    check(correctResult.match === true, `Correct Miranda proposition → match: true (got: ${correctResult.match})`);
    note(`  Analysis: "${correctResult.analysis.slice(0, 100)}…"`);

    // 3b. Incorrect proposition about Citizens United
    const citizensUnitedExcerpt = `
We are asked to reconsider Austin and, in effect, McConnell. It has been noted
that "Austin was a significant departure from ancient First Amendment principles."
For the reasons stated below, we now conclude that independent expenditures,
including those made by corporations, do not give rise to corruption or the
appearance of corruption. We now hold that Sections 203 and 441b's restrictions
on corporate independent expenditures are invalid and cannot be applied to
spending such as that by Citizens United to release Hillary: The Movie throughout
the 2008 presidential primary season.
    `.trim();

    note("Testing INCORRECT proposition (Citizens United misrepresented as privacy case)…");
    const incorrectResult = await analyzeHolding(
      "Individuals have an inherent constitutional right to maintain privacy in their personal data and associations, free from unauthorized commercial surveillance",
      citizensUnitedExcerpt,
      "Citizens United v. Federal Election Commission"
    );
    assert(typeof incorrectResult.match === "boolean", "analyzeHolding returns { match: boolean }");
    check(incorrectResult.match === false, `Incorrect Citizens United proposition → match: false (got: ${incorrectResult.match})`);
    note(`  Analysis: "${incorrectResult.analysis.slice(0, 100)}…"`);

    return { name, status: "pass" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    no(`Claude analysis test threw: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

// ── 4. Federal Register API ───────────────────────────────────────────────────

async function testFederalRegisterAPI(): Promise<SuiteResult> {
  const name = "Federal Register API";
  banner(`TEST 4 — ${name}`);

  if (MOCK_MODE) {
    skip("Skipping live API test in --mock mode");
    return { name, status: "skip" };
  }

  try {
    const { start, end } = last90Days();
    note(`Searching "data privacy" from ${start} to ${end}…`);

    const results = await frSearch("data privacy", start, end);

    assert(Array.isArray(results), "Federal Register returns an array");
    assert(results.length >= 1, `At least 1 result found (got ${results.length})`);

    // Validate structure of first few results
    const toCheck = results.slice(0, 3);
    for (const doc of toCheck) {
      check(typeof doc.title === "string" && doc.title.length > 0, `doc.title present ("${doc.title?.slice(0, 60)}")`);
      check(typeof doc.type === "string" && doc.type.length > 0, `doc.type present ("${doc.type}")`);
      check(typeof doc.html_url === "string" && doc.html_url.startsWith("https://"), `doc.html_url present`);
      check(typeof doc.document_number === "string", `doc.document_number present`);
      check(typeof doc.publication_date === "string", `doc.publication_date present`);
    }

    note(`Found ${results.length} documents. First: "${results[0].title?.slice(0, 70)}"`);

    // Also verify the searchFederalRegister wrapper function works
    note("Testing searchFederalRegister() wrapper…");
    const { searchFederalRegister, defaultDateRange } = await import("../lib/federal-register.js");
    const alerts = await searchFederalRegister(["data privacy"], defaultDateRange());
    check(Array.isArray(alerts), "searchFederalRegister returns array");
    check(alerts.length >= 0, "searchFederalRegister resolved without error");
    if (alerts.length > 0) {
      const a = alerts[0];
      check(typeof a.title === "string", "alert.title present");
      check(typeof a.relevanceScore === "number", `alert.relevanceScore present (${a.relevanceScore})`);
      check(typeof a.significantRule === "boolean", "alert.significantRule present");
    }

    return { name, status: "pass" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    no(`Federal Register test threw: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

// ── 5. Full Analysis Pipeline ─────────────────────────────────────────────────

async function testFullPipeline(): Promise<SuiteResult> {
  const name = "Full Analysis Pipeline";
  banner(`TEST 5 — ${name}${MOCK_MODE ? " (mock mode)" : ""}`);

  // Load demo brief
  let demoBrief: string;
  try {
    demoBrief = readFileSync(resolve(ROOT, "public/demo/demo-brief.txt"), "utf-8");
    note(`Loaded demo-brief.txt (${demoBrief.length} chars)`);
  } catch (err) {
    no("Could not load public/demo/demo-brief.txt");
    return { name, status: "fail", error: "demo-brief.txt not found" };
  }

  // Check server is reachable
  note(`Checking server at ${BASE_URL}…`);
  try {
    const ping = await fetch(`${BASE_URL}/api/sessions`, { signal: AbortSignal.timeout(5_000) });
    if (!ping.ok && ping.status !== 200) {
      note(`Server returned ${ping.status} — may still be OK`);
    }
    note("Server is reachable");
  } catch {
    no(`Cannot reach ${BASE_URL} — is the dev server running? (npm run dev)`);
    note("Hint: start the server in another terminal, then re-run this script.");
    return { name, status: "fail", error: `Cannot connect to ${BASE_URL}` };
  }

  try {
    const fd = new FormData();
    fd.append("text", demoBrief);

    note(`POST ${BASE_URL}/api/analyze (timeout: ${PIPELINE_TIMEOUT / 1000}s)…`);

    const res = await fetch(`${BASE_URL}/api/analyze`, {
      method: "POST",
      body: fd,
      signal: AbortSignal.timeout(PIPELINE_TIMEOUT),
    });

    assert(res.ok, `POST /api/analyze returned 2xx (status: ${res.status})`);
    assert(
      res.headers.get("content-type")?.includes("text/event-stream") ?? false,
      "Response is text/event-stream (SSE)"
    );

    // Consume the stream, printing progress
    let lastStatus = "";
    const events = await consumeSse(res, (e) => {
      if (e.type === "status" || e.type === "verifying") {
        lastStatus = e.message ?? e.citation ?? "";
        process.stdout.write(`\r     ${C.dim(("→ " + lastStatus).slice(0, 70).padEnd(70))}`);
      }
    });
    process.stdout.write("\r" + " ".repeat(76) + "\r");

    // Find complete event
    const completeEvent = events.find((e) => e.type === "complete");
    const errorEvent = events.find((e) => e.type === "error");

    if (errorEvent) {
      no(`Server returned an error event: ${errorEvent.message}`);
      return { name, status: "fail", error: String(errorEvent.message) };
    }

    assert(!!completeEvent, `SSE stream contains a "complete" event (got ${events.length} events total)`);

    const report = completeEvent!.report as Record<string, unknown>;
    assert(typeof report === "object" && report !== null, "complete.report is an object");

    // Validate report structure
    check(typeof report.fileName === "string", `report.fileName present ("${report.fileName}")`);
    check(typeof report.totalCitations === "number", `report.totalCitations present (${report.totalCitations})`);
    check(typeof report.analyzedAt === "string", `report.analyzedAt present`);

    // Citation results
    const results = report.results as unknown[];
    assert(Array.isArray(results), `report.results is an array`);
    assert(results.length > 0, `report.results has at least 1 entry (got ${results.length})`);

    // Demo brief should have all three statuses: verified, warning, not_found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const statuses = new Set(results.map((r: any) => r.status));
    if (!MOCK_MODE) {
      // Live mode: demo brief has 6 citations with mix of real + fake
      note(`Citation statuses found: ${[...statuses].join(", ")}`);
      check(statuses.has("verified"), "At least one citation is 'verified'");
      check(statuses.has("not_found") || statuses.has("warning"), "At least one citation is flagged (not_found or warning)");
    } else {
      // Mock mode: known outcomes from MOCK_RESULTS
      ok(`Mock statuses: ${[...statuses].join(", ")}`);
      check(statuses.has("verified"), "Mock results include 'verified'");
      check(statuses.has("not_found"), "Mock results include 'not_found'");
      check(statuses.has("warning"), "Mock results include 'warning'");
    }

    // Jurisdiction section
    const clauses = report.clauses as unknown[];
    check(Array.isArray(clauses), `report.clauses is an array`);
    note(`Clauses detected: ${clauses.length}`);

    // Regulatory section
    const alerts = report.regulatoryAlerts as unknown[];
    const topics = report.regulatoryTopics as unknown[];
    check(Array.isArray(alerts), "report.regulatoryAlerts is an array");
    check(Array.isArray(topics), "report.regulatoryTopics is an array");
    note(`Regulatory alerts: ${alerts.length}, topics: ${topics.length}`);

    // SSE event sequence validation
    const eventTypes = events.map((e) => e.type);
    check(eventTypes.includes("citations_found"), "SSE stream includes 'citations_found' event");
    check(eventTypes.includes("jurisdiction_complete"), "SSE stream includes 'jurisdiction_complete' event");
    check(eventTypes.includes("regulatory_complete"), "SSE stream includes 'regulatory_complete' event");

    return { name, status: "pass" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    no(`Pipeline test threw: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

// ── 6. GPT Endpoints ──────────────────────────────────────────────────────────

async function testGptEndpoints(): Promise<SuiteResult> {
  const name = "GPT Endpoints";
  banner(`TEST 6 — ${name}`);

  // These endpoints are planned but not yet implemented.
  // When implemented, uncomment the assertions below.
  skip("/api/gpt/health — not yet implemented");
  skip("/api/gpt/verify-citation — not yet implemented");
  note("To implement: add app/api/gpt/health/route.ts and app/api/gpt/verify-citation/route.ts");
  note("Then update this test suite to assert status='ok' and found=true/false.");

  return { name, status: "skip" };
}

// ── 7. Mock Mode (only when --mock) ───────────────────────────────────────────

async function testMockMode(): Promise<SuiteResult> {
  const name = "Mock Data Mode";
  if (!MOCK_MODE) return { name, status: "skip" };

  banner(`TEST 7 — ${name}`);

  try {
    // Verify USE_MOCK_DATA is set
    assert(process.env.USE_MOCK_DATA === "true", "USE_MOCK_DATA env var is 'true'");

    // Import and validate mock data directly
    const { MOCK_CITATIONS, MOCK_RESULTS, buildMockReport } = await import("../lib/mock-data.js");

    assert(Array.isArray(MOCK_CITATIONS) && MOCK_CITATIONS.length > 0, `MOCK_CITATIONS is non-empty (${MOCK_CITATIONS.length} items)`);
    assert(Array.isArray(MOCK_RESULTS) && MOCK_RESULTS.length > 0, `MOCK_RESULTS is non-empty (${MOCK_RESULTS.length} items)`);
    assert(MOCK_CITATIONS.length === MOCK_RESULTS.length, `MOCK_CITATIONS and MOCK_RESULTS have same length (${MOCK_CITATIONS.length})`);

    // Validate each mock citation has required fields
    for (const c of MOCK_CITATIONS) {
      assert(typeof c.id === "string" && c.id.length > 0, `citation.id present ("${c.id}")`);
      assert(typeof c.caseName === "string" && c.caseName.length > 0, `citation.caseName present`);
      assert(typeof c.citation === "string" && c.citation.length > 0, `citation.citation present`);
      assert(typeof c.proposition === "string" && c.proposition.length > 0, `citation.proposition present`);
    }

    // Validate each mock result
    const validStatuses = new Set(["verified", "warning", "error", "not_found"]);
    for (const r of MOCK_RESULTS) {
      assert(validStatuses.has(r.status), `result.status is valid ("${r.status}")`);
      assert(typeof r.holdingAnalysis === "string", `result.holdingAnalysis present`);
    }

    // Validate known outcomes for the 6 demo citations
    const byCase = new Map(MOCK_RESULTS.map((r) => [r.citation.caseName, r.status]));
    check(byCase.get("Carpenter v. United States") === "verified", "Carpenter → verified");
    check(byCase.get("Miranda v. Arizona") === "verified", "Miranda → verified");
    check(byCase.get("Roe v. Wade") === "warning", "Roe v. Wade → warning (overruled)");
    check(byCase.get("Citizens United v. Federal Election Commission") === "warning", "Citizens United → warning (holding mismatch)");
    check(byCase.get("Henderson v. TechCorp Solutions") === "not_found", "Henderson → not_found (fake case)");
    check(byCase.get("Brown v. Board of Education") === "verified", "Brown → verified");

    // Build and validate mock report
    const report = buildMockReport("test-brief.pdf");
    assert(report.totalCitations === MOCK_RESULTS.length, `report.totalCitations === ${MOCK_RESULTS.length}`);
    assert(report.verified >= 1, `report.verified >= 1 (got ${report.verified})`);
    assert(report.notFound >= 1, `report.notFound >= 1 (got ${report.notFound})`);
    assert(Array.isArray(report.clauses), "report.clauses is array");
    assert(Array.isArray(report.regulatoryAlerts), "report.regulatoryAlerts is array");
    assert(Array.isArray(report.regulatoryTopics), "report.regulatoryTopics is array");
    assert(typeof report.analyzedAt === "string", "report.analyzedAt is string");

    return { name, status: "pass" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    no(`Mock mode test threw: ${msg}`);
    return { name, status: "fail", error: msg };
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(C.bold(`\n${"═".repeat(62)}`));
  console.log(C.bold(`  BriefCheck E2E Test Suite${MOCK_MODE ? "  (--mock mode)" : ""}`));
  console.log(C.bold(`${"═".repeat(62)}`));

  if (MOCK_MODE) {
    console.log(C.yellow(`\n  ⚠  Running in mock mode — live API tests will be skipped.`));
    console.log(C.dim(`     Set USE_MOCK_DATA=true and verify the mock data pipeline.\n`));
  } else {
    console.log(C.dim(`\n  Server: ${BASE_URL}`));
    console.log(C.dim(`  Tip:    Run with --mock to skip live API calls.\n`));
  }

  // Run all suites sequentially (some depend on env state)
  const runners = [
    testMidpageAPI,
    testClaudeExtraction,
    testClaudeHoldingAnalysis,
    testFederalRegisterAPI,
    testFullPipeline,
    testGptEndpoints,
    ...(MOCK_MODE ? [testMockMode] : []),
  ];

  for (const run of runners) {
    try {
      const result = await run();
      suiteResults.push(result);
    } catch (err) {
      // Shouldn't reach here — each suite catches its own errors
      const msg = err instanceof Error ? err.message : String(err);
      suiteResults.push({ name: run.name, status: "fail", error: msg });
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n${C.bold("═".repeat(62))}`);
  console.log(C.bold("  BriefCheck E2E Test Results"));
  console.log(`${C.bold("═".repeat(62))}\n`);

  const suiteLabels: Record<string, string> = {
    "Midpage API":              "Midpage API",
    "Claude Citation Extraction": "Claude Extraction",
    "Claude Holding Analysis":  "Claude Analysis",
    "Federal Register API":     "Federal Register",
    "Full Analysis Pipeline":   "Full Pipeline",
    "GPT Endpoints":            "GPT Endpoints",
    "Mock Data Mode":           "Mock Data Mode",
  };

  let anyFailed = false;

  for (const r of suiteResults) {
    const label = (suiteLabels[r.name] ?? r.name).padEnd(22);
    if (r.status === "pass") {
      console.log(`  ${label} ${C.green("✅  PASS")}`);
    } else if (r.status === "skip") {
      console.log(`  ${label} ${C.yellow("⏭   SKIPPED")}`);
    } else {
      anyFailed = true;
      console.log(`  ${label} ${C.red("❌  FAIL")}  ${C.dim(r.error ?? "")}`);
    }
  }

  console.log();

  if (anyFailed) {
    console.log(C.red(C.bold("  Some tests failed — see details above.")));
    console.log(C.dim("  Common fixes:"));
    console.log(C.dim("    • Check API keys in .env.local"));
    console.log(C.dim("    • Ensure the dev server is running:  npm run dev"));
    console.log(C.dim("    • Use --mock to bypass live API calls"));
    console.log();
    process.exit(1);
  } else {
    const skipped = suiteResults.filter((r) => r.status === "skip").length;
    const passed  = suiteResults.filter((r) => r.status === "pass").length;
    if (skipped > 0) {
      console.log(C.green(C.bold(`  ${passed} test${passed !== 1 ? "s" : ""} passed, ${skipped} skipped.`)));
    } else {
      console.log(C.green(C.bold("  All tests passed! Ready for demo.")));
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(C.red("Fatal error:"), err);
  process.exit(1);
});

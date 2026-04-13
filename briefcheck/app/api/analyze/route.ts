import { NextRequest, NextResponse } from "next/server";
import { parsePDFWithLlama } from "@/lib/llamaparse";
import { extractCitations, analyzeHolding } from "@/lib/claude";
import {
  lookupByCitation,
  searchByName,
  getOpinionText,
} from "@/lib/midpage";
import { trustFoundryLookup, trustFoundrySearch } from "@/lib/trustfoundry";
import { MOCK_CITATIONS, MOCK_RESULTS, buildMockReport } from "@/lib/mock-data";
import {
  createSession,
  updateSession,
  addCitationResult,
} from "@/lib/store";
import {
  extractClauses,
  analyzeClauseJurisdictions,
  DEFAULT_STATES,
} from "@/lib/jurisdiction";
import {
  searchFederalRegister,
  extractTopicsFromBrief,
  defaultDateRange,
} from "@/lib/federal-register";
import type { AnalysisReport, Citation, VerificationResult, JurisdictionResult, RegulatoryAlert } from "@/lib/types";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ---- SSE helpers --------------------------------------------------------

type SseEvent =
  | { type: "status"; message: string }
  | { type: "citations_found"; count: number; citations: Citation[] }
  | { type: "verifying"; index: number; total: number; citation: string }
  | { type: "result"; index: number; result: VerificationResult }
  | { type: "clauses_found"; count: number }
  | { type: "regulatory_searching"; topics: string[] }
  | { type: "jurisdiction_complete"; count: number }
  | { type: "regulatory_complete"; count: number }
  | { type: "complete"; report: AnalysisReport }
  | { type: "error"; message: string };

function sseChunk(event: SseEvent): string {
  // SSE spec: "data: <payload>\n\n"
  return `data: ${JSON.stringify(event)}\n\n`;
}

// ---- Utilities ----------------------------------------------------------

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize extracted text so that PDFs, DOCX, and TXT files produce
 * identical citation strings for the same brief.
 *
 * Problems each parser introduces:
 *  - pdf-parse: hard line-breaks mid-citation ("585\nU.S. 296", "v.\nUnited States")
 *  - LlamaParse: markdown artifacts (## headings, **bold**, *italic*, [links](url))
 *  - mammoth: paragraph-level \n spacing that varies from plain TXT
 */
function normalizeText(raw: string): string {
  let text = raw;

  // 1. Strip LlamaParse / markdown artifacts so citations are plain text
  text = text
    .replace(/^#{1,6}\s+/gm, "")                    // ## Heading → ""
    .replace(/\*{2}([^*\n]+)\*{2}/g, "$1")           // **bold** → bold
    .replace(/\*([^*\n]+)\*/g, "$1")                 // *italic* → italic
    .replace(/_{2}([^_\n]+)_{2}/g, "$1")             // __bold__ → bold
    .replace(/_([^_\n]+)_/g, "$1")                   // _italic_ → italic
    .replace(/`([^`]+)`/g, "$1")                     // `code` → code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")         // [text](url) → text
    .replace(/^[-*_]{3,}\s*$/gm, "")                 // --- hr → ""
    .replace(/^>\s*/gm, "")                          // > blockquote → ""
    .replace(/^\s*[-*+]\s+/gm, "")                   // bullet list markers
    .replace(/^\s*\d+\.\s+(?=[A-Z])/gm, "");         // numbered list markers (only before uppercase — avoids mangling citations like "410 U.S.")

  // 2. Fix hard line-breaks inside citations — the main PDF divergence source
  //    "585\nU.S. 296" → "585 U.S. 296"
  const reporters =
    "U\\.S\\.|F\\.(?:\\d[a-z]*)|S\\.\\s*Ct\\.|L\\.\\s*Ed\\." +
    "|F\\.Supp\\.(?:\\d[a-z]*)|F\\.R\\.D\\." +
    "|A\\.(?:2|3)d|P\\.(?:2|3)d" +
    "|N\\.W\\.(?:2d)?|S\\.E\\.(?:2d)?|S\\.W\\.(?:2|3)d|N\\.E\\.(?:2d)?";
  text = text.replace(
    new RegExp(`(\\d+)\\s*\\n\\s*(${reporters})`, "g"),
    "$1 $2"
  );

  //    "Carpenter v.\nUnited States" → "Carpenter v. United States"
  text = text.replace(/v\.\s*\n\s*/g, "v. ");

  //    "( 2018 )" or "(2018\n)" → "(2018)"
  text = text.replace(/\(\s*(\d{4})\s*\n?\s*\)/g, "($1)");

  // 3. Collapse runs of 3+ newlines to a paragraph break
  text = text.replace(/\n{3,}/g, "\n\n");

  // 4. Within each paragraph, collapse single newlines to spaces.
  //    This neutralises pdf-parse's per-visual-line breaks while preserving
  //    paragraph structure.
  text = text
    .split(/\n\n+/)
    .map((para) => para.replace(/\n/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter((para) => para.length > 0)
    .join("\n\n");

  return text.trim();
}

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    return parsePDFWithLlama(buffer, file.name);
  }

  // DOCX support via mammoth
  if (
    file.name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require("mammoth") as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return buffer.toString("utf-8");
}

// ---- Per-citation verification ------------------------------------------

async function verifyCitation(citation: Citation): Promise<VerificationResult> {
  const base: Omit<VerificationResult, "status"> = {
    citation,
    midpageFound: false,
    caseName: null,
    court: null,
    dateFiled: null,
    overallTreatment: null,
    holdingMatch: null,
    holdingAnalysis: "",
    midpageOpinionId: null,
    citations: [],
  };

  // 1. Look up by reporter citation, fall back to case name search, then TrustFoundry
  let opinion = null;
  try {
    opinion = await lookupByCitation(citation.citation);
    if (!opinion && citation.caseName) {
      console.log(`[analyze] Midpage name fallback: "${citation.caseName}"`);
      opinion = await searchByName(citation.caseName);
    }
    // Secondary source: TrustFoundry (used as backup when Midpage returns nothing)
    if (!opinion) {
      console.log(`[analyze] TrustFoundry fallback: "${citation.citation}"`);
      const tfCase = await trustFoundryLookup(citation.citation)
        ?? (citation.caseName ? await trustFoundrySearch(citation.caseName) : null);
      if (tfCase) {
        // Normalize TrustFoundry result to Midpage opinion shape
        opinion = {
          id: tfCase.id,
          case_name: tfCase.case_name ?? citation.caseName,
          court: tfCase.court ?? null,
          date_filed: tfCase.date ?? null,
          overall_treatment: tfCase.treatment ?? null,
          citations: [],
          _source: "trustfoundry",
        };
        console.log(`[analyze] TrustFoundry found: "${opinion.case_name}"`);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetworkErr =
      msg.includes("fetch failed") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("ENOTFOUND") ||
      msg.includes("network");
    console.error(`[analyze] Midpage lookup error for "${citation.rawText}":`, err);
    return {
      ...base,
      status: "error",
      holdingAnalysis: isNetworkErr
        ? "Midpage is currently unreachable. Verification unavailable — please retry."
        : "Midpage API error during case lookup.",
    };
  }

  if (!opinion) {
    return { ...base, status: "not_found" };
  }

  const opinionId = String(opinion.id);
  const isTrustFoundry = opinion._source === "trustfoundry";
  const filled: Omit<VerificationResult, "status"> = {
    ...base,
    midpageFound: true,
    caseName: opinion.case_name ?? null,
    court: opinion.court ?? null,
    dateFiled: opinion.date_filed ?? null,
    midpageOpinionId: isTrustFoundry ? null : opinionId,
    citations: opinion.citations ?? [],
    verificationSource: isTrustFoundry ? "trustfoundry" : "midpage",
  };

  // 2. Citator treatment — now returned directly by the GET /opinions/get endpoint
  const treatment: string | null = opinion.overall_treatment ?? null;
  filled.overallTreatment = treatment;

  // 3. Holding analysis via Claude (non-fatal if missing)
  let holdingMatch: boolean | null = null;
  let holdingAnalysis = "";
  if (citation.proposition) {
    try {
      // Prefer html_content bundled in the lookup response (include_content: true),
      // then fall back to a separate getOpinionText fetch.
      // analyzeHolding handles null gracefully — uses Claude knowledge as fallback.
      let opinionText: string | null = opinion.html_content ?? null;
      if (!opinionText && !isTrustFoundry) {
        opinionText = await getOpinionText(opinionId);
      }
      console.log(`[analyze] opinionText for ${opinionId}: ${opinionText?.length ?? 0} chars`);

      const result = await analyzeHolding(
        citation.proposition,
        opinionText,
        opinion.case_name ?? citation.caseName
      );
      holdingMatch = result.match;
      holdingAnalysis = result.analysis;
    } catch (err) {
      console.warn(`[analyze] holding analysis failed for ${opinionId}:`, err);
      holdingAnalysis = "Holding analysis could not be completed.";
    }
  }

  filled.holdingMatch = holdingMatch;
  filled.holdingAnalysis = holdingAnalysis;

  // 4. Status
  const negTreatment = treatment === "Negative" || treatment === "Caution";
  const status: VerificationResult["status"] =
    negTreatment || holdingMatch === false ? "warning" : "verified";

  console.log(
    `[analyze] "${citation.rawText}" → ${status} (treatment=${treatment ?? "n/a"}, holdingMatch=${holdingMatch ?? "n/a"})`
  );

  return { ...filled, status };
}

// ---- Route handler ------------------------------------------------------

export async function POST(request: NextRequest) {
  // Validate input before opening the stream so we can return normal 4xx errors
  let fileName = "unknown";
  let briefText = "";

  try {
    const formData = await request.formData();
    const fileField = formData.get("file");
    const textField = formData.get("text");

    if (fileField instanceof File) {
      if (fileField.size === 0) {
        return NextResponse.json({ error: "File is empty." }, { status: 400 });
      }
      if (fileField.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File exceeds 10 MB limit." }, { status: 413 });
      }
      fileName = fileField.name;
      briefText = normalizeText(await extractText(fileField));
    } else if (typeof textField === "string" && textField.trim()) {
      briefText = normalizeText(textField.trim());
      fileName = "pasted-text";
    } else {
      return NextResponse.json(
        { error: 'Provide a PDF via "file" or text via "text".' },
        { status: 400 }
      );
    }

    if (!briefText.trim()) {
      return NextResponse.json({ error: "Could not extract text from file." }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse request." },
      { status: 400 }
    );
  }

  // Capture for use inside the stream closure
  const capturedFileName = fileName;
  const capturedText = briefText;
  console.log(`[analyze] normalized text (first 500 chars):\n${capturedText.slice(0, 500)}`);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: SseEvent) {
        controller.enqueue(enc.encode(sseChunk(event)));
      }

      // ── MOCK MODE ────────────────────────────────────────────────────────
      // Flip USE_MOCK_DATA=true in .env.local to activate before a live demo.
      if (process.env.USE_MOCK_DATA === "true") {
        const mockSession = createSession(capturedFileName);
        try {
          await delay(600);
          emit({ type: "status", message: "Extracting citations from brief..." });

          await delay(1800);
          emit({
            type: "citations_found",
            count: MOCK_CITATIONS.length,
            citations: MOCK_CITATIONS,
          });

          for (let i = 0; i < MOCK_RESULTS.length; i++) {
            await delay(500);
            emit({
              type: "verifying",
              index: i + 1,
              total: MOCK_RESULTS.length,
              citation: MOCK_CITATIONS[i].rawText,
            });

            await delay(900);
            addCitationResult(mockSession.id, i + 1, MOCK_RESULTS[i]);
            emit({ type: "result", index: i + 1, result: MOCK_RESULTS[i] });
          }

          await delay(400);
          const mockReport = buildMockReport(capturedFileName);
          updateSession(mockSession.id, {
            status: "completed",
            totalCitations: mockReport.totalCitations,
            verified: mockReport.verified,
            warnings: mockReport.warnings,
            errors: mockReport.errors,
            notFound: mockReport.notFound,
            report: mockReport,
          });
          emit({ type: "complete", report: mockReport });
        } catch (err) {
          updateSession(mockSession.id, { status: "failed" });
          throw err;
        } finally {
          controller.close();
        }
        return;
      }
      // ── END MOCK MODE ────────────────────────────────────────────────────

      const session = createSession(capturedFileName);

      try {
        // Guard: Anthropic key must be present
        if (!process.env.ANTHROPIC_API_KEY) {
          updateSession(session.id, { status: "failed" });
          emit({
            type: "error",
            message:
              "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the server.",
          });
          return;
        }

        // Step 1: Extract citations + scan for contract clauses in parallel
        emit({ type: "status", message: "Extracting citations from brief..." });
        console.log(`[analyze] extracting citations from "${capturedFileName}" (${capturedText.length} chars)`);

        const [citations, rawClauses] = await Promise.all([
          extractCitations(capturedText),
          extractClauses(capturedText).catch(() => []),
        ]);
        console.log(`[analyze] found ${citations.length} citations, ${rawClauses.length} contract clauses`);

        emit({ type: "citations_found", count: citations.length, citations });
        if (rawClauses.length > 0) {
          emit({ type: "clauses_found", count: rawClauses.length });
        }

        if (citations.length === 0 && rawClauses.length === 0) {
          const emptyReport: AnalysisReport = {
            fileName: capturedFileName,
            totalCitations: 0,
            verified: 0,
            warnings: 0,
            errors: 0,
            notFound: 0,
            results: [],
            clauses: [],
            regulatoryAlerts: [],
            regulatoryTopics: [],
            analyzedAt: new Date().toISOString(),
          };
          updateSession(session.id, {
            status: "completed",
            totalCitations: 0,
            report: emptyReport,
          });
          emit({ type: "complete", report: emptyReport });
          controller.close();
          return;
        }

        // Step 2: Verify each citation sequentially
        const results: VerificationResult[] = [];

        for (let i = 0; i < citations.length; i++) {
          const citation = citations[i];

          emit({
            type: "verifying",
            index: i + 1,
            total: citations.length,
            citation: citation.rawText,
          });
          console.log(`[analyze] verifying ${i + 1}/${citations.length}: "${citation.rawText}"`);

          const result = await verifyCitation(citation);
          results.push(result);
          addCitationResult(session.id, i + 1, result);

          emit({ type: "result", index: i + 1, result });

          if (i < citations.length - 1) {
            await delay(200);
          }
        }

        // Step 3: Jurisdiction analysis + regulatory search (parallel)
        let clauses: JurisdictionResult[] = [];
        let regulatoryAlerts: RegulatoryAlert[] = [];
        let regulatoryTopics: string[] = [];

        const jurisdictionPromise = rawClauses.length > 0
          ? (async () => {
              emit({ type: "status", message: `Analyzing ${rawClauses.length} contract clause${rawClauses.length !== 1 ? "s" : ""} across 5 states…` });
              console.log(`[analyze] running jurisdiction analysis for ${rawClauses.length} clauses`);
              return Promise.all(
                rawClauses.map((c) =>
                  analyzeClauseJurisdictions(c.clause, DEFAULT_STATES).catch(() => ({
                    clause: c.clause,
                    clauseType: c.clauseType,
                    jurisdictions: [],
                  }))
                )
              );
            })()
          : Promise.resolve([]);

        const regulatoryPromise = (async () => {
          try {
            const topics = await extractTopicsFromBrief(capturedText);
            if (topics.length === 0) return { topics: [], alerts: [] };
            emit({ type: "regulatory_searching", topics });
            console.log(`[analyze] regulatory search for topics: ${topics.join(", ")}`);
            const alerts = await searchFederalRegister(topics, defaultDateRange());
            console.log(`[analyze] regulatory search found ${alerts.length} alerts`);
            return { topics, alerts };
          } catch (err) {
            console.warn("[analyze] regulatory search failed (non-fatal):", err);
            return { topics: [], alerts: [] };
          }
        })();

        [clauses, { topics: regulatoryTopics, alerts: regulatoryAlerts }] = await Promise.all([
          jurisdictionPromise,
          regulatoryPromise,
        ]);

        // Emit stage-complete events for precise stage tracking on the client
        emit({ type: "jurisdiction_complete", count: clauses.length });
        emit({ type: "regulatory_complete", count: regulatoryAlerts.length });

        // Step 4: Compile and emit the final report
        const report: AnalysisReport = {
          fileName: capturedFileName,
          totalCitations: results.length,
          verified: results.filter((r) => r.status === "verified").length,
          warnings: results.filter((r) => r.status === "warning").length,
          errors: results.filter((r) => r.status === "error").length,
          notFound: results.filter((r) => r.status === "not_found").length,
          results,
          clauses,
          regulatoryAlerts,
          regulatoryTopics,
          analyzedAt: new Date().toISOString(),
        };

        console.log(
          `[analyze] done — verified=${report.verified} warnings=${report.warnings} errors=${report.errors} not_found=${report.notFound}`
        );

        updateSession(session.id, {
          status: "completed",
          totalCitations: report.totalCitations,
          verified: report.verified,
          warnings: report.warnings,
          errors: report.errors,
          notFound: report.notFound,
          report,
        });

        emit({ type: "complete", report });
      } catch (err) {
        updateSession(session.id, { status: "failed" });
        console.error("[analyze] stream error:", err);
        emit({
          type: "error",
          message: err instanceof Error ? err.message : "Internal server error.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Prevent Next.js / proxies from buffering the response
      "X-Accel-Buffering": "no",
    },
  });
}

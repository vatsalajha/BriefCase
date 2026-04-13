import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const MIDPAGE_BASE = "https://app.midpage.ai/api/v1";
function midpageHeaders() {
    const key = process.env.MIDPAGE_API_KEY;
    if (!key)
        throw new Error("MIDPAGE_API_KEY environment variable is not set.");
    return {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    };
}
/**
 * Look up a single citation using POST /opinions/get — the correct Midpage endpoint.
 * overall_treatment is returned directly on the opinion object.
 */
async function lookupByCitation(citation) {
    const res = await fetch(`${MIDPAGE_BASE}/opinions/get`, {
        method: "POST",
        headers: midpageHeaders(),
        body: JSON.stringify({ citations: [citation] }),
    });
    if (!res.ok)
        return null;
    const json = await res.json();
    return json.opinions?.[0] ?? null;
}
/**
 * overall_treatment is now embedded in the opinion returned by lookupByCitation.
 * This helper is kept for explicit re-fetches but typically not needed.
 */
async function getCitatorTreatment(opinionId) {
    const res = await fetch(`${MIDPAGE_BASE}/opinions/${opinionId}/treatment`, {
        headers: midpageHeaders(),
    });
    if (!res.ok)
        return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = await res.json();
    return json?.overall_treatment ?? null;
}
function treatmentBadge(treatment) {
    if (!treatment)
        return "Not available";
    if (treatment === "Negative")
        return "⚠️ Negative (may be overruled or distinguished)";
    if (treatment === "Caution")
        return "⚠️ Caution (treated with caution by later courts)";
    return `✅ ${treatment}`;
}
function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
// ── MCP Server ─────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "BriefCheck",
    version: "1.0.0",
});
// ── Tool 1: verify_citation ────────────────────────────────────────────────
server.tool("verify_citation", "Verify a legal case citation against the Midpage case law database. Returns whether the case exists, its court, date, and citator treatment (positive/negative/caution). Use this whenever a user mentions a case citation.", {
    citation: z.string().describe("The reporter citation to verify, e.g. '410 U.S. 113' or '384 U.S. 436'"),
}, async ({ citation }) => {
    try {
        const opinion = await lookupByCitation(citation);
        if (!opinion) {
            return {
                content: [
                    {
                        type: "text",
                        text: [
                            `❌ CITATION NOT FOUND`,
                            ``,
                            `No case matching "${citation}" was found in the Midpage database.`,
                            `This citation may be:`,
                            `  • Incorrectly formatted (expected format: "volume reporter page", e.g. "410 U.S. 113")`,
                            `  • A fabricated / hallucinated citation`,
                            `  • From a court not yet indexed in Midpage`,
                            ``,
                            `⚠️ Do NOT use this citation in any filing without independent manual verification.`,
                        ].join("\n"),
                    },
                ],
            };
        }
        const treatment = opinion.overall_treatment ?? null;
        const isNegative = treatment === "Negative" || treatment === "Caution";
        const court = opinion.court_abbreviation ?? opinion.court_name ?? "Unknown";
        return {
            content: [
                {
                    type: "text",
                    text: [
                        `${isNegative ? "⚠️" : "✅"} CITATION ${isNegative ? "VERIFIED WITH WARNINGS" : "VERIFIED"}`,
                        ``,
                        `Case:       ${opinion.case_name ?? "Unknown"}`,
                        `Citation:   ${citation}`,
                        `Court:      ${court}`,
                        `Date Filed: ${opinion.date_filed ?? "Unknown"}`,
                        `Treatment:  ${treatmentBadge(treatment)}`,
                        ``,
                        isNegative
                            ? `⚠️ WARNING: This case has ${treatment?.toLowerCase()} treatment. It may have been overruled, reversed, or distinguished by later courts. Verify before citing.`
                            : `This case appears to be good law based on available citator data.`,
                    ].join("\n"),
                },
            ],
        };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
            content: [
                {
                    type: "text",
                    text: `⚠️ ERROR: Unable to verify citation "${citation}".\n\n${msg}\n\nCheck that MIDPAGE_API_KEY is set correctly.`,
                },
            ],
        };
    }
});
// ── Tool 2: check_brief ───────────────────────────────────────────────────
// Matches reporter citations like "410 U.S. 113", "747 F.3d 1241", "134 S. Ct. 2473"
const CITATION_RE = /\b(\d{1,4})\s+(U\.S\.|F\.\d[a-z]*|F\.\s*Supp\.(?:\s*\d[a-z]*)?|S\.(?:\s*)Ct\.|L\.\s*Ed\.(?:\s*\d[a-z]*)?|A\.\d[a-z]*|Cal\.\d[a-z]*|N\.Y\.\d[a-z]*)\s+(\d{1,4})\b/g;
function extractCitations(text) {
    const seen = new Set();
    const results = [];
    let match;
    // Reset lastIndex since the regex is global
    CITATION_RE.lastIndex = 0;
    while ((match = CITATION_RE.exec(text)) !== null) {
        const raw = match[0];
        // Normalize spacing in reporter (e.g. "S. Ct." → "S. Ct.")
        const normalized = `${match[1]} ${match[2].replace(/\s+/g, " ").trim()} ${match[3]}`;
        if (!seen.has(normalized)) {
            seen.add(normalized);
            results.push({ raw, normalized });
        }
    }
    return results;
}
server.tool("check_brief", "Extract and verify all case law citations from a legal brief or document. Returns a full verification report for every citation found — whether it exists, its treatment, and any warnings.", {
    text: z.string().describe("The full text of the legal brief or document to check"),
}, async ({ text }) => {
    const citations = extractCitations(text);
    if (citations.length === 0) {
        return {
            content: [
                {
                    type: "text",
                    text: "No reporter citations found in the provided text.\n\nMake sure the text contains citations in standard format, e.g. \"410 U.S. 113\" or \"747 F.3d 1241\".",
                },
            ],
        };
    }
    const lines = [];
    let verified = 0;
    let warnings = 0;
    let notFound = 0;
    let errors = 0;
    for (let i = 0; i < citations.length; i++) {
        const { raw, normalized } = citations[i];
        try {
            const opinion = await lookupByCitation(normalized);
            if (!opinion) {
                notFound++;
                lines.push(`❌ ${raw}\n   NOT FOUND — possible hallucination or formatting error`);
            }
            else {
                const treatment = opinion.overall_treatment ?? null;
                const isNegative = treatment === "Negative" || treatment === "Caution";
                const court = opinion.court_abbreviation ?? opinion.court_name ?? "?";
                if (isNegative) {
                    warnings++;
                    lines.push(`⚠️  ${raw}\n   Case: ${opinion.case_name ?? "Unknown"} | Court: ${court} | Treatment: ${treatment}`);
                }
                else {
                    verified++;
                    lines.push(`✅ ${raw}\n   Case: ${opinion.case_name ?? "Unknown"} | Court: ${court} | Treatment: ${treatment ?? "N/A"}`);
                }
            }
        }
        catch (err) {
            errors++;
            const msg = err instanceof Error ? err.message : String(err);
            lines.push(`⚠️  ${raw}\n   Error: ${msg}`);
        }
        // Respect Midpage rate limits
        if (i < citations.length - 1)
            await delay(200);
    }
    const summary = [
        verified > 0 ? `${verified} verified` : null,
        warnings > 0 ? `${warnings} warnings` : null,
        notFound > 0 ? `${notFound} not found` : null,
        errors > 0 ? `${errors} errors` : null,
    ]
        .filter(Boolean)
        .join(" · ");
    return {
        content: [
            {
                type: "text",
                text: [
                    `BRIEFCHECK CITATION REPORT`,
                    `${"=".repeat(50)}`,
                    `Found ${citations.length} unique citation${citations.length !== 1 ? "s" : ""}. ${summary}`,
                    ``,
                    lines.join("\n\n"),
                    ``,
                    notFound > 0
                        ? `⚠️  ${notFound} citation${notFound !== 1 ? "s were" : " was"} not found in Midpage. Verify manually before filing.`
                        : `All citations located in Midpage database.`,
                ].join("\n"),
            },
        ],
    };
});
// ── Start ──────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);

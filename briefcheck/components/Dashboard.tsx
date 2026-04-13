"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Scale, Radio, Download, RotateCcw,
  CheckCircle, AlertTriangle, XCircle,
  FileText, MessageSquare, X, Copy, Check, ChevronDown, ChevronRight,
  Loader2,
} from "lucide-react";
import type { AnalysisReport, VerificationResult } from "@/lib/types";
import type { DepositionOutline, DepositionTopic } from "@/app/api/deposition/route";
import CitationCard from "./CitationCard";
import JurisdictionChecker from "./JurisdictionChecker";
import RegulatoryRadar from "./RegulatoryRadar";

// ─── Types ───────────────────────────────────────────────────────────────────

type DashTab = "citations" | "jurisdiction" | "regulatory";
type CitFilter = "all" | "verified" | "warning" | "not_found" | "error";

// ─── Trust Score gauge (SVG ring) ────────────────────────────────────────────

interface GaugeProps {
  score: number;
  citationPct: number;
  jurisdictionPct: number;
  regulatoryPct: number;
}

function TrustGauge({ score, citationPct, jurisdictionPct, regulatoryPct }: GaugeProps) {
  const r = 52;
  const c = 2 * Math.PI * r; // ≈ 326.7
  const offset = c * (1 - score / 100);
  const color =
    score >= 80 ? "#16A34A" : score >= 60 ? "#D97706" : "#DC2626";

  const breakdown = [
    { label: "Citations", pct: citationPct, color: "#16A34A" },
    { label: "Jurisdiction", pct: jurisdictionPct, color: "#2563EB" },
    { label: "Regulatory", pct: regulatoryPct, color: "#D97706" },
  ];

  return (
    <div className="flex items-center gap-8 flex-wrap">
      {/* Ring */}
      <div className="relative w-[120px] h-[120px] shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={60} cy={60} r={r} fill="none" stroke="#E2DCD0" strokeWidth={10} />
          {/* Progress */}
          <motion.circle
            cx={60} cy={60} r={r} fill="none"
            stroke={color} strokeWidth={10} strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {score}
          </motion.span>
          <span className="text-xs mt-0.5 font-medium" style={{ color: "var(--text-secondary)" }}>
            Trust
          </span>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="flex-1 min-w-[180px] space-y-3">
        {breakdown.map(({ label, pct, color: bColor }, i) => (
          <div key={label}>
            <div className="flex justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
              <span className="text-xs font-semibold tabular-nums" style={{ color: bColor }}>
                {Math.round(pct)}%
              </span>
            </div>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: bColor }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 * i + 0.3 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Citations tab ────────────────────────────────────────────────────────────

const CIT_STAT_CFG = [
  {
    key: "verified" as CitFilter,
    label: "Verified",
    icon: CheckCircle,
    color: "#16A34A",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.2)",
  },
  {
    key: "warning" as CitFilter,
    label: "Warnings",
    icon: AlertTriangle,
    color: "#D97706",
    bg: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.2)",
  },
  {
    key: "not_found" as CitFilter,
    label: "Not Found",
    icon: XCircle,
    color: "#DC2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.2)",
  },
  {
    key: "error" as CitFilter,
    label: "Errors",
    icon: XCircle,
    color: "var(--text-secondary)",
    bg: "var(--bg-tertiary)",
    border: "var(--border)",
  },
] as const;

function CitationsTab({ report }: { report: AnalysisReport }) {
  const [filter, setFilter] = useState<CitFilter>("all");

  // Derive counts directly from results so they always match the cards shown
  const counts: Record<CitFilter, number> = {
    all: report.results.length,
    verified: report.results.filter((r) => r.status === "verified").length,
    warning: report.results.filter((r) => r.status === "warning").length,
    not_found: report.results.filter((r) => r.status === "not_found").length,
    error: report.results.filter((r) => r.status === "error").length,
  };

  const filtered: VerificationResult[] =
    filter === "all"
      ? report.results
      : report.results.filter((r) => r.status === filter);

  return (
    <div className="space-y-5">
      {/* Stat cards — only render cards with non-zero counts */}
      <div className="flex flex-wrap gap-3">
        {CIT_STAT_CFG.filter(({ key }) => counts[key] > 0).map(({ key, label, icon: Icon, color, bg, border }) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setFilter(filter === key ? "all" : key)}
            className="rounded-xl p-4 text-left transition-all flex-1"
            style={{
              background: filter === key ? bg : "var(--bg-secondary)",
              border: `1px solid ${filter === key ? border : "var(--border)"}`,
              minWidth: "100px",
            }}
          >
            <Icon size={18} style={{ color }} strokeWidth={2} />
            <p className="text-2xl font-bold mt-2 tabular-nums" style={{ color }}>
              {counts[key]}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {label}
            </p>
          </motion.button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "verified", "warning", "not_found", "error"] as CitFilter[]).map((f) => {
          if (f !== "all" && counts[f] === 0) return null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filter === f ? "var(--accent-blue)" : "var(--bg-secondary)",
                color: filter === f ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${filter === f ? "var(--accent-blue)" : "var(--border)"}`,
              }}
            >
              {f === "all" ? "All" : f === "not_found" ? "Not Found" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span style={{ opacity: 0.75 }}> ({counts[f]})</span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--text-secondary)" }}>
            No citations in this category.
          </p>
        ) : (
          filtered.map((r, i) => (
            <motion.div
              key={r.citation.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.07 }}
            >
              <CitationCard result={r} index={i} />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Jurisdiction tab ─────────────────────────────────────────────────────────

function JurisdictionTab({ report }: { report: AnalysisReport }) {
  const clauses = report.clauses ?? [];

  if (clauses.length === 0) {
    return (
      <div className="space-y-8">
        <div
          className="rounded-xl px-6 py-10 text-center"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <Scale size={28} style={{ color: "var(--text-secondary)", margin: "0 auto 12px" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            No contract clauses detected
          </p>
          <p className="text-xs mt-1.5 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
            BriefCase scans for non-compete, arbitration, NDA, liability cap, and
            non-solicitation clauses automatically.
          </p>
          <p className="text-xs mt-4" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
            Or check a clause manually:
          </p>
          <div className="mt-4 text-left max-w-lg mx-auto">
            <JurisdictionChecker showSampleButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {clauses.map((clauseResult, i) => (
        <div
          key={i}
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          {/* Clause header */}
          <div
            className="px-5 py-3 flex items-center gap-3"
            style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}
          >
            <Scale size={14} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
            <div className="min-w-0">
              <span
                className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(59,130,246,0.12)",
                  color: "var(--accent-blue)",
                  border: "1px solid rgba(59,130,246,0.25)",
                }}
              >
                {clauseResult.clauseType.replace(/-/g, " ")}
              </span>
              <p className="mt-1.5 text-xs italic line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                &ldquo;{clauseResult.clause.slice(0, 160)}{clauseResult.clause.length > 160 ? "…" : ""}&rdquo;
              </p>
            </div>
          </div>
          <div className="p-4">
            <JurisdictionChecker result={clauseResult} />
          </div>
        </div>
      ))}

      {/* Manual check */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-secondary)" }}>
          Check another clause manually
        </p>
        <JurisdictionChecker showSampleButton />
      </div>
    </div>
  );
}

// ─── AI Disclosure Modal ──────────────────────────────────────────────────────

function generateDisclosureText(report: AnalysisReport): string {
  const verified = report.results.filter((r) => r.status === "verified");
  const flagged = report.results.filter((r) => r.status !== "verified");
  const verifiedList = verified.length
    ? verified.map((r) => `    • ${r.citation.rawText}`).join("\n")
    : "    • (none)";
  const flaggedList = flagged.length
    ? flagged
        .map((r) => {
          const reason =
            r.status === "not_found"
              ? "not found in legal database"
              : r.status === "warning"
              ? `negative citator treatment: ${r.overallTreatment ?? "see report"}`
              : "verification error";
          return `    • ${r.citation.rawText} (${reason})`;
        })
        .join("\n")
    : "    • (none — all citations verified)";
  const date = new Date(report.analyzedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `CERTIFICATION REGARDING USE OF ARTIFICIAL INTELLIGENCE

Pursuant to applicable court rules governing the use of artificial intelligence
tools in the preparation of court filings, undersigned counsel certifies as
follows:

1. SCOPE OF AI USE. Artificial intelligence tools were used in the preparation
   of the attached filing. Specifically, BriefCase, an AI-powered legal
   citation verification tool, was used to review and analyze citations
   contained in this document.

2. ATTORNEY SUPERVISION. All AI-generated output was reviewed and approved by
   undersigned counsel. The legal arguments, conclusions, and citations in this
   filing represent the independent professional judgment of counsel.

3. VERIFIED CITATIONS. The following citations were verified as valid and
   retrievable in the Midpage legal database as of the date of this filing:

${verifiedList}

4. CITATIONS REQUIRING ATTENTION. The following citations were flagged during
   AI-assisted review and have been independently verified by counsel prior
   to filing:

${flaggedList}

5. ACCURACY. Counsel has independently confirmed the accuracy and current
   validity of all citations contained in this filing.

Dated: ${date}

Respectfully submitted,

/s/ ________________________
[Attorney Name]
[Bar Number]
[Firm Name]
[Address]
[Phone]
[Email]

Counsel for [Party]`;
}

function AIDisclosureModal({ report, onClose }: { report: AnalysisReport; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = generateDisclosureText(report);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}
        >
          <div className="flex items-center gap-2">
            <FileText size={16} style={{ color: "var(--accent-blue)" }} />
            <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>
              AI Disclosure Statement
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: copied ? "rgba(22,163,74,0.12)" : "var(--accent-blue)",
                color: copied ? "#16A34A" : "#fff",
                border: `1px solid ${copied ? "rgba(22,163,74,0.3)" : "var(--accent-blue)"}`,
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <pre
            className="text-xs leading-relaxed whitespace-pre-wrap"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}
          >
            {text}
          </pre>
        </div>
        <div
          className="px-6 py-3 shrink-0 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--bg-tertiary)" }}
        >
          Review and edit before filing. Requirements vary by jurisdiction.
        </div>
      </motion.div>
    </div>
  );
}

// ─── Deposition Questions Panel ───────────────────────────────────────────────

function DepositionTopicAccordion({ topic, defaultOpen }: { topic: DepositionTopic; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const flaggedCount = topic.questions.filter((q) => q.challengeFlag).length;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
        style={{ background: open ? "var(--bg-tertiary)" : "var(--bg-secondary)" }}
      >
        <div className="flex items-center gap-3">
          {open ? (
            <ChevronDown size={15} style={{ color: "var(--accent-blue)", flexShrink: 0 }} />
          ) : (
            <ChevronRight size={15} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
          )}
          <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>
            {topic.name}
          </span>
          {flaggedCount > 0 && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(220,38,38,0.1)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.2)" }}
            >
              {flaggedCount} attacking flagged {flaggedCount === 1 ? "citation" : "citations"}
            </span>
          )}
        </div>
        <span className="text-xs ml-2 shrink-0" style={{ color: "var(--text-tertiary)" }}>
          {topic.questions.length} questions
        </span>
      </button>
      {open && (
        <div
          className="divide-y"
          style={{ borderTop: "1px solid var(--border)", background: "var(--bg-primary)" }}
        >
          {topic.questions.map((q, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex gap-3">
                <span
                  className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{
                    background: q.challengeFlag ? "rgba(220,38,38,0.1)" : "var(--bg-tertiary)",
                    color: q.challengeFlag ? "#DC2626" : "var(--text-secondary)",
                    border: `1px solid ${q.challengeFlag ? "rgba(220,38,38,0.25)" : "var(--border)"}`,
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {q.text}
                  </p>
                  {q.citation && (
                    <p className="mt-1 text-xs" style={{ color: "var(--accent-blue)" }}>
                      Re: {q.citation}
                    </p>
                  )}
                  {q.tip && (
                    <p className="mt-1.5 text-xs italic" style={{ color: "var(--text-secondary)" }}>
                      Tip: {q.tip}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DepositionPanel({ report, onClose }: { report: AnalysisReport; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [outline, setOutline] = useState<DepositionOutline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [witnessRole, setWitnessRole] = useState("adverse party / 30(b)(6) corporate designee");

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/deposition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report, witnessRole }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg ?? "Request failed");
      }
      const data: DepositionOutline = await res.json();
      setOutline(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "0 25px 60px rgba(0,0,0,0.25)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-tertiary)" }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={16} style={{ color: "var(--accent-blue)" }} />
            <span className="font-semibold text-sm" style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}>
              Deposition Question Generator
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!outline ? (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Generate targeted deposition questions based on the citation analysis.
                Claude will identify weaknesses — hallucinated cases, overruled precedents,
                and questionable propositions — and craft questions to exploit them.
              </p>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Witness / deponent role
                </label>
                <input
                  value={witnessRole}
                  onChange={(e) => setWitnessRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  placeholder="e.g. adverse party, expert witness, corporate designee"
                />
              </div>
              {error && (
                <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
                  {error}
                </p>
              )}
              <button
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: loading ? "var(--bg-tertiary)" : "var(--accent-blue)",
                  color: loading ? "var(--text-secondary)" : "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  border: "none",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Generating questions…
                  </>
                ) : (
                  <>
                    <MessageSquare size={15} />
                    Generate Deposition Outline
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  Deponent: {outline.witness}
                </p>
                <button
                  onClick={() => setOutline(null)}
                  className="text-xs underline"
                  style={{ color: "var(--accent-blue)" }}
                >
                  Regenerate
                </button>
              </div>
              {outline.topics.map((topic, i) => (
                <DepositionTopicAccordion key={i} topic={topic} defaultOpen={i === 0} />
              ))}
            </div>
          )}
        </div>

        <div
          className="px-6 py-3 shrink-0 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--text-tertiary)", background: "var(--bg-tertiary)" }}
        >
          For attorney use only. Review all questions before use in deposition.
        </div>
      </motion.div>
    </div>
  );
}

// ─── Dashboard (main export) ──────────────────────────────────────────────────

interface DashboardProps {
  report: AnalysisReport;
  onReset: () => void;
}

const TAB_CFG = [
  { key: "citations" as DashTab, label: "Citation Verification", icon: BookOpen },
  { key: "jurisdiction" as DashTab, label: "Jurisdiction Analysis", icon: Scale },
  { key: "regulatory" as DashTab, label: "Regulatory Radar", icon: Radio },
] as const;

export default function Dashboard({ report, onReset }: DashboardProps) {
  const [tab, setTab] = useState<DashTab>("citations");
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [showDeposition, setShowDeposition] = useState(false);

  // ── Trust score (deduction-based, starts at 100) ────────────────────────────
  const { trustScore, citationPct, jurisdictionPct, regulatoryPct } = useMemo(() => {
    let score = 100;

    // Citations: -15 per not_found, -10 per warning, -5 per error
    for (const r of report.results) {
      if (r.status === "not_found") score -= 15;
      else if (r.status === "warning") score -= 10;
      else if (r.status === "error") score -= 5;
    }

    // Jurisdiction: -10 per void clause, -5 per partially enforceable
    const allJ = (report.clauses ?? []).flatMap((c) => c.jurisdictions);
    for (const j of allJ) {
      if (j.status === "void") score -= 10;
      else if (j.status === "partially_enforceable") score -= 5;
    }

    // Regulatory: -2 per significant rule (awareness penalty)
    const significantCount = (report.regulatoryAlerts ?? []).filter(
      (a) => a.significantRule
    ).length;
    score -= significantCount * 2;

    const trustScore = Math.max(0, Math.min(100, score));

    // Breakdown bars — per-pillar health as a percentage
    const cPct =
      report.totalCitations > 0
        ? (report.verified / report.totalCitations) * 100
        : 100;
    const jPct =
      allJ.length > 0
        ? (allJ.filter((j) => j.status === "enforceable").length / allJ.length) * 100
        : 100;
    const alertCount = (report.regulatoryAlerts ?? []).length;
    const rPct = alertCount === 0 ? 100 : Math.max(20, 100 - alertCount * 7);

    return { trustScore, citationPct: cPct, jurisdictionPct: jPct, regulatoryPct: rPct };
  }, [report]);

  // ── Tab badge counts ─────────────────────────────────────────────────────────
  const tabBadges: Record<DashTab, number | null> = {
    citations: report.totalCitations,
    jurisdiction: (report.clauses ?? []).length || null,
    regulatory: (report.regulatoryAlerts ?? []).length || null,
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  function downloadJSON() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `briefcase-${report.fileName.replace(/\.[^.]+$/, "")}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
    <AnimatePresence>
      {showDisclosure && (
        <AIDisclosureModal report={report} onClose={() => setShowDisclosure(false)} />
      )}
      {showDeposition && (
        <DepositionPanel report={report} onClose={() => setShowDeposition(false)} />
      )}
    </AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-4xl mx-auto space-y-6"
    >
      {/* ── Header card ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", boxShadow: "var(--card-shadow)" }}
      >
        <div className="flex items-start justify-between gap-6 flex-wrap mb-6">
          <div>
            <h2
              className="text-2xl"
              style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-primary)" }}
            >
              Legal Intelligence Report
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {report.fileName} &middot; {new Date(report.analyzedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setShowDisclosure(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              title="Generate AI disclosure statement for court filing"
            >
              <FileText size={13} />
              AI Disclosure
            </button>
            <button
              onClick={() => setShowDeposition(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              title="Generate deposition questions targeting citation weaknesses"
            >
              <MessageSquare size={13} />
              Deposition Questions
            </button>
            <button
              onClick={downloadJSON}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
              title="Export full analysis as JSON"
            >
              <Download size={13} />
              Export JSON
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "var(--bg-tertiary)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <RotateCcw size={13} />
              New Brief
            </button>
          </div>
        </div>

        {/* Trust score gauge + breakdown */}
        <TrustGauge
          score={trustScore}
          citationPct={citationPct}
          jurisdictionPct={jurisdictionPct}
          regulatoryPct={regulatoryPct}
        />
      </div>

      {/* ── Tab navigation ───────────────────────────────────────────────────── */}
      <div
        style={{ borderBottom: "1px solid var(--border)" }}
        className="flex gap-0"
      >
        {TAB_CFG.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const badge = tabBadges[key];
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors"
              style={{
                color: active ? "var(--accent-blue)" : "var(--text-secondary)",
              }}
            >
              <Icon size={15} />
              <span className="hidden sm:inline">{label}</span>
              {badge !== null && badge !== undefined && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    background: active ? "rgba(59,130,246,0.15)" : "var(--bg-tertiary)",
                    color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                  }}
                >
                  {badge}
                </span>
              )}
              {/* Animated underline indicator */}
              {active && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full"
                  style={{ background: "var(--accent-blue)" }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "citations" && <CitationsTab report={report} />}
          {tab === "jurisdiction" && <JurisdictionTab report={report} />}
          {tab === "regulatory" && (
            <RegulatoryRadar
              alerts={report.regulatoryAlerts ?? []}
              topics={report.regulatoryTopics ?? []}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
    </>
  );
}

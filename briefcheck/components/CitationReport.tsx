"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, Download, RotateCcw, Scale, Radio } from "lucide-react";
import type { AnalysisReport, VerificationResult } from "@/lib/types";
import CitationCard from "./CitationCard";
import JurisdictionChecker from "./JurisdictionChecker";
import RegulatoryRadar from "./RegulatoryRadar";

type Filter = "all" | "verified" | "warning" | "not_found" | "error";
type MainTab = "citations" | "contracts" | "regulatory";

const STAT_CONFIG = [
  {
    key: "verified" as Filter,
    label: "Verified",
    icon: CheckCircle,
    color: "var(--accent-green)",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
  },
  {
    key: "warning" as Filter,
    label: "Warnings",
    icon: AlertTriangle,
    color: "var(--accent-amber)",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
  },
  {
    key: "not_found" as Filter,
    label: "Not Found",
    icon: XCircle,
    color: "var(--accent-red)",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
  },
] as const;

interface CitationReportProps {
  report: AnalysisReport;
  onReset: () => void;
}

export default function CitationReport({ report, onReset }: CitationReportProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [mainTab, setMainTab] = useState<MainTab>("citations");

  const hasClauses = report.clauses && report.clauses.length > 0;
  const hasRegulatory = report.regulatoryAlerts && report.regulatoryAlerts.length > 0;

  const counts: Record<Filter, number> = {
    all: report.totalCitations,
    verified: report.verified,
    warning: report.warnings,
    not_found: report.notFound,
    error: report.errors,
  };

  const filtered: VerificationResult[] =
    filter === "all"
      ? report.results
      : report.results.filter((r) => r.status === filter);

  function downloadReport() {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `briefcheck-${report.fileName.replace(/\.[^.]+$/, "")}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const trustPct =
    report.totalCitations > 0
      ? Math.round((report.verified / report.totalCitations) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-3xl mx-auto space-y-6"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
          >
            Analysis Complete
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {report.fileName} &middot; {new Date(report.analyzedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <Download size={14} />
            Export JSON
          </button>
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <RotateCcw size={14} />
            New brief
          </button>
        </div>
      </div>

      {/* Trust score + stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="col-span-1 rounded-xl p-4 flex flex-col justify-between"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Trust Score
          </p>
          <p
            className="text-4xl font-bold mt-2"
            style={{
              color:
                trustPct >= 80
                  ? "var(--accent-green)"
                  : trustPct >= 50
                  ? "var(--accent-amber)"
                  : "var(--accent-red)",
            }}
          >
            {trustPct}%
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
            {report.totalCitations} citations
          </p>
        </motion.div>

        {STAT_CONFIG.map(({ key, label, icon: Icon, color, bg, border }, i) => (
          <motion.button
            key={key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: (i + 1) * 0.06 }}
            onClick={() => { setFilter(filter === key ? "all" : key); setMainTab("citations"); }}
            className="col-span-1 rounded-xl p-4 flex flex-col justify-between text-left transition-all"
            style={{
              background: filter === key && mainTab === "citations" ? bg : "var(--bg-secondary)",
              border: `1px solid ${filter === key && mainTab === "citations" ? border : "var(--border)"}`,
              cursor: "pointer",
            }}
          >
            <Icon size={18} style={{ color }} strokeWidth={2} />
            <div className="mt-2">
              <p className="text-2xl font-bold" style={{ color }}>
                {counts[key]}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                {label}
              </p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Main tabs: Citations | Contract Clauses */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", width: "fit-content" }}
      >
        <button
          onClick={() => setMainTab("citations")}
          className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: mainTab === "citations" ? "var(--accent-blue)" : "transparent",
            color: mainTab === "citations" ? "#fff" : "var(--text-secondary)",
          }}
        >
          Citations ({report.totalCitations})
        </button>
        <button
          onClick={() => setMainTab("contracts")}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: mainTab === "contracts" ? "var(--accent-blue)" : "transparent",
            color: mainTab === "contracts" ? "#fff" : "var(--text-secondary)",
          }}
        >
          <Scale size={13} />
          Contracts
          {hasClauses && (
            <span
              className="px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: mainTab === "contracts" ? "rgba(255,255,255,0.2)" : "rgba(59,130,246,0.2)",
                color: mainTab === "contracts" ? "#fff" : "var(--accent-blue)",
              }}
            >
              {report.clauses.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setMainTab("regulatory")}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: mainTab === "regulatory" ? "var(--accent-blue)" : "transparent",
            color: mainTab === "regulatory" ? "#fff" : "var(--text-secondary)",
          }}
        >
          <Radio size={13} />
          Regulatory
          {hasRegulatory && (
            <span
              className="px-1.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: mainTab === "regulatory" ? "rgba(255,255,255,0.2)" : "rgba(59,130,246,0.2)",
                color: mainTab === "regulatory" ? "#fff" : "var(--accent-blue)",
              }}
            >
              {report.regulatoryAlerts.length}
            </span>
          )}
        </button>
      </div>

      {/* ── CITATIONS TAB ── */}
      {mainTab === "citations" && (
        <>
          {/* Filter pills */}
          <div className="flex gap-1 flex-wrap">
            {(["all", "verified", "warning", "not_found", "error"] as Filter[]).map((f) => {
              if (f !== "all" && counts[f] === 0) return null;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: filter === f ? "var(--accent-blue)" : "var(--bg-tertiary)",
                    color: filter === f ? "#fff" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {f === "all" ? "All" : f === "not_found" ? "Not Found" : f.charAt(0).toUpperCase() + f.slice(1)}
                  {" "}
                  <span style={{ opacity: 0.75 }}>({counts[f]})</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: "var(--text-secondary)" }}>
                No citations in this category.
              </p>
            ) : (
              filtered.map((result, i) => (
                <CitationCard key={result.citation.id} result={result} index={i} />
              ))
            )}
          </div>
        </>
      )}

      {/* ── REGULATORY TAB ── */}
      {mainTab === "regulatory" && (
        <RegulatoryRadar
          alerts={report.regulatoryAlerts ?? []}
          topics={report.regulatoryTopics ?? []}
        />
      )}

      {/* ── CONTRACTS TAB ── */}
      {mainTab === "contracts" && (
        <div className="space-y-8">
          {!hasClauses ? (
            <div
              className="rounded-xl px-6 py-10 text-center"
              style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <Scale size={28} style={{ color: "var(--text-secondary)", margin: "0 auto 12px" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                No contract clauses detected
              </p>
              <p className="text-xs mt-1.5 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
                BriefCheck scans for non-compete, arbitration, NDA, liability cap, and non-solicitation clauses automatically.
              </p>
              <p className="text-xs mt-4" style={{ color: "var(--text-secondary)", opacity: 0.7 }}>
                Or check a clause manually below:
              </p>
              <div className="mt-4 text-left max-w-lg mx-auto">
                <JurisdictionChecker />
              </div>
            </div>
          ) : (
            <>
              {report.clauses.map((clauseResult, i) => (
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
                      <p
                        className="mt-1.5 text-xs italic line-clamp-2"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        &ldquo;{clauseResult.clause.slice(0, 160)}{clauseResult.clause.length > 160 ? "…" : ""}&rdquo;
                      </p>
                    </div>
                  </div>
                  {/* Jurisdiction table */}
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
                <JurisdictionChecker />
              </div>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

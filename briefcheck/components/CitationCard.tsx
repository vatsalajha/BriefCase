"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, Scale, Calendar, BookOpen, Database } from "lucide-react";
import type { VerificationResult } from "@/lib/types";

const STATUS_CONFIG = {
  verified: {
    icon: CheckCircle,
    color: "#16A34A",
    border: "#16A34A",
    bg: "rgba(22,163,74,0.05)",
    label: "Verified",
    badgeBg: "rgba(22,163,74,0.12)",
  },
  warning: {
    icon: AlertTriangle,
    color: "#D97706",
    border: "#D97706",
    bg: "rgba(217,119,6,0.05)",
    label: "Warning",
    badgeBg: "rgba(217,119,6,0.12)",
  },
  not_found: {
    icon: XCircle,
    color: "#DC2626",
    border: "#DC2626",
    bg: "rgba(220,38,38,0.05)",
    label: "Not Found",
    badgeBg: "rgba(220,38,38,0.12)",
  },
  error: {
    icon: XCircle,
    color: "var(--text-secondary)",
    border: "var(--border)",
    bg: "var(--bg-tertiary)",
    label: "Error",
    badgeBg: "rgba(156,148,136,0.15)",
  },
} as const;

const TREATMENT_COLORS: Record<string, string> = {
  Positive: "#16A34A",
  Negative: "#DC2626",
  Caution: "#D97706",
  Neutral: "var(--text-secondary)",
};

interface CitationCardProps {
  result: VerificationResult;
  index: number;
}

export default function CitationCard({ result, index }: CitationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[result.status];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: cfg.bg,
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${cfg.border}`,
        boxShadow: "var(--card-shadow)",
      }}
    >
      {/* Card header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-start gap-4 px-5 py-4 text-left"
      >
        {/* Status icon */}
        <Icon size={20} style={{ color: cfg.color, marginTop: 2, flexShrink: 0 }} strokeWidth={2} />

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="text-base font-semibold truncate"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-serif)", fontWeight: 600 }}
            >
              {result.caseName ?? result.citation.caseName}
            </span>
            <span
              className="px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
              style={{
                fontFamily: "var(--font-mono)",
                background: "var(--bg-tertiary)",
                color: "var(--text-tertiary)",
                border: "1px solid var(--border)",
              }}
            >
              {result.citation.citation}
            </span>
            {/* Status badge */}
            <span
              className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0"
              style={{ background: cfg.badgeBg, color: cfg.color }}
            >
              {cfg.label}
            </span>
          </div>

          {/* Proposition */}
          {result.citation.proposition && (
            <p className="text-sm italic leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              "{result.citation.proposition}"
            </p>
          )}
        </div>

        {/* Expand chevron */}
        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          <ChevronDown size={16} style={{ color: "var(--text-secondary)" }} />
        </motion.div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              className="px-5 pb-5 pt-1 space-y-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {/* Metadata row */}
              <div className="flex flex-wrap gap-4 pt-3">
                {result.court && (
                  <div className="flex items-center gap-2">
                    <Scale size={13} style={{ color: "var(--text-secondary)" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {result.court}
                    </span>
                  </div>
                )}
                {result.dateFiled && (
                  <div className="flex items-center gap-2">
                    <Calendar size={13} style={{ color: "var(--text-secondary)" }} />
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {result.dateFiled}
                    </span>
                  </div>
                )}
                {result.overallTreatment && (
                  <div className="flex items-center gap-2">
                    <BookOpen size={13} style={{ color: "var(--text-secondary)" }} />
                    <span
                      className="text-xs font-semibold"
                      style={{
                        color: TREATMENT_COLORS[result.overallTreatment] ?? "var(--text-secondary)",
                      }}
                    >
                      {result.overallTreatment} treatment
                    </span>
                  </div>
                )}
              </div>

              {/* Holding analysis */}
              {result.holdingAnalysis && (
                <div
                  className="rounded-lg p-4 space-y-2"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                      Holding Analysis
                    </span>
                    {result.holdingMatch !== null && (
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          background: result.holdingMatch
                            ? "rgba(22,163,74,0.12)"
                            : "rgba(220,38,38,0.12)",
                          color: result.holdingMatch ? "var(--accent-green)" : "var(--accent-red)",
                        }}
                      >
                        {result.holdingMatch ? "Supports proposition" : "Does not support"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                    {result.holdingAnalysis}
                  </p>
                </div>
              )}

              {/* Context in brief */}
              {result.citation.contextInBrief && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                    In the brief
                  </span>
                  <p
                    className="text-sm leading-relaxed italic pl-3"
                    style={{
                      color: "var(--text-secondary)",
                      borderLeft: "2px solid var(--border)",
                    }}
                  >
                    {result.citation.contextInBrief}
                  </p>
                </div>
              )}

              {/* Verification source badge */}
              {result.verificationSource && (
                <div className="flex items-center gap-1.5">
                  <Database size={11} style={{ color: "var(--text-secondary)" }} />
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    Verified by{" "}
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {result.verificationSource === "trustfoundry" ? "TrustFoundry" : "Midpage"}
                    </span>
                  </span>
                </div>
              )}

              {/* Not-found note */}
              {result.status === "not_found" && (
                <p className="text-sm" style={{ color: "var(--accent-red)" }}>
                  This citation could not be found in any legal database. Verify manually.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

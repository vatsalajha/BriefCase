"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, Shield, AlertTriangle, CheckCircle, XCircle, HelpCircle, Loader2 } from "lucide-react";
import type { JurisdictionResult, ClauseStatus } from "@/lib/types";

const ALL_STATES = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

const DEFAULT_STATES = ["CA", "TX", "NY", "DE", "FL"];

const STATUS_CONFIG: Record<ClauseStatus, {
  label: string;
  icon: typeof CheckCircle;
  color: string;
  bg: string;
  border: string;
}> = {
  enforceable: {
    label: "Enforceable",
    icon: CheckCircle,
    color: "#16A34A",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.2)",
  },
  partially_enforceable: {
    label: "Partial",
    icon: AlertTriangle,
    color: "#D97706",
    bg: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.2)",
  },
  void: {
    label: "Void",
    icon: XCircle,
    color: "#DC2626",
    bg: "rgba(220,38,38,0.08)",
    border: "rgba(220,38,38,0.2)",
  },
  uncertain: {
    label: "Uncertain",
    icon: HelpCircle,
    color: "var(--text-secondary)",
    bg: "rgba(156,148,136,0.08)",
    border: "rgba(156,148,136,0.2)",
  },
};

function StatusBadge({ status }: { status: ClauseStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

interface JurisdictionCheckerProps {
  /** Pre-populate clause text (e.g. from brief auto-detection) */
  initialClause?: string;
  /** Pre-computed result to display immediately */
  result?: JurisdictionResult;
  /** Show a "Try sample clause" button that loads the demo file */
  showSampleButton?: boolean;
}

export default function JurisdictionChecker({
  initialClause = "",
  result: initialResult,
  showSampleButton = false,
}: JurisdictionCheckerProps) {
  const [clause, setClause] = useState(initialClause);
  const [selectedStates, setSelectedStates] = useState<string[]>(DEFAULT_STATES);
  const [result, setResult] = useState<JurisdictionResult | null>(initialResult ?? null);
  const [loading, setLoading] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSampleClause() {
    setSampleLoading(true);
    try {
      const res = await fetch("/demo/demo-contract-clause.txt");
      if (res.ok) {
        const text = await res.text();
        setClause(text.trim());
        setResult(null);
      }
    } catch {
      // non-fatal
    } finally {
      setSampleLoading(false);
    }
  }

  function toggleState(code: string) {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]
    );
  }

  async function handleCheck() {
    if (!clause.trim() || selectedStates.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jurisdiction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clause: clause.trim(), states: selectedStates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }
      const data = await res.json() as JurisdictionResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const clauseTypeLabel = result?.clauseType
    ? result.clauseType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  return (
    <div className="space-y-5">
      {/* Clause input — only show if no pre-populated result */}
      {!initialResult && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label
                className="block text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                Contract Clause
              </label>
              {showSampleButton && (
                <button
                  onClick={loadSampleClause}
                  disabled={sampleLoading}
                  className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md transition-opacity disabled:opacity-50"
                  style={{
                    background: "rgba(37,99,235,0.08)",
                    color: "var(--accent-blue)",
                    border: "1px solid rgba(37,99,235,0.2)",
                  }}
                >
                  {sampleLoading ? <Loader2 size={10} className="animate-spin" /> : null}
                  Try sample clause
                </button>
              )}
            </div>
            <textarea
              value={clause}
              onChange={(e) => setClause(e.target.value)}
              placeholder="Paste a contract clause here — e.g. a non-compete, arbitration, NDA, or liability cap..."
              rows={4}
              className="w-full resize-none rounded-xl px-4 py-3 text-sm focus:outline-none"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* State selector */}
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              Check These States
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATES.map(({ code, name }) => {
                const active = selectedStates.includes(code);
                return (
                  <button
                    key={code}
                    onClick={() => toggleState(code)}
                    title={name}
                    className="px-2 py-1 rounded-md text-xs font-mono font-semibold transition-all"
                    style={{
                      background: active ? "rgba(37,99,235,0.1)" : "var(--bg-secondary)",
                      color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                      border: `1px solid ${active ? "rgba(37,99,235,0.3)" : "var(--border)"}`,
                    }}
                  >
                    {code}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "var(--accent-red)",
            }}>
              {error}
            </p>
          )}

          <button
            onClick={handleCheck}
            disabled={loading || !clause.trim() || selectedStates.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity"
            style={{
              background: "var(--accent-blue)",
              border: "1px solid var(--accent-blue)",
              color: "#ffffff",
            }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Scale size={15} />}
            {loading ? "Analyzing…" : "Check Enforceability"}
          </button>
        </div>
      )}

      {/* Results table */}
      <AnimatePresence>
        {result && result.jurisdictions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            {clauseTypeLabel && (
              <div className="flex items-center gap-2">
                <Shield size={14} style={{ color: "var(--accent-blue)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                  Detected clause type:
                </span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(59,130,246,0.12)",
                    color: "var(--accent-blue)",
                    border: "1px solid rgba(59,130,246,0.25)",
                  }}
                >
                  {clauseTypeLabel}
                </span>
              </div>
            )}

            {/* Table */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)", width: "110px" }}>State</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)", width: "120px" }}>Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Key Statute</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {result.jurisdictions.map((j, i) => {
                    const cfg = STATUS_CONFIG[j.status];
                    return (
                      <tr
                        key={j.stateCode}
                        style={{
                          borderBottom: i < result.jurisdictions.length - 1 ? "1px solid var(--border)" : "none",
                          background: i % 2 === 0 ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-xs" style={{ color: cfg.color }}>
                            {j.stateCode}
                          </span>
                          <span className="block text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            {j.state}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={j.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                            {j.keyStatute || "—"}
                          </span>
                          {j.recentChanges && (
                            <span
                              className="block mt-1 text-xs px-1.5 py-0.5 rounded"
                              style={{ background: "rgba(245,158,11,0.1)", color: "var(--accent-amber)" }}
                            >
                              ⚡ {j.recentChanges.length > 80 ? j.recentChanges.slice(0, 80) + "…" : j.recentChanges}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {j.explanation}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

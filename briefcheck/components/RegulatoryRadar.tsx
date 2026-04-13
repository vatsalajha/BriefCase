"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ExternalLink, ChevronDown, ChevronUp, Clock, AlertTriangle, Zap } from "lucide-react";
import type { RegulatoryAlert } from "@/lib/types";

// ── Type badge config ────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  Rule: {
    label: "Final Rule",
    color: "#16A34A",
    bg: "rgba(22,163,74,0.08)",
    border: "rgba(22,163,74,0.2)",
  },
  "Proposed Rule": {
    label: "Proposed Rule",
    color: "#D97706",
    bg: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.2)",
  },
  Notice: {
    label: "Notice",
    color: "#2563EB",
    bg: "rgba(37,99,235,0.08)",
    border: "rgba(37,99,235,0.2)",
  },
  "Presidential Document": {
    label: "Presidential",
    color: "#7C3AED",
    bg: "rgba(124,58,237,0.08)",
    border: "rgba(124,58,237,0.2)",
  },
};

function getTypeConfig(type: string) {
  return (
    TYPE_CONFIG[type] ?? {
      label: type,
      color: "var(--text-secondary)",
      bg: "rgba(136,146,164,0.08)",
      border: "rgba(136,146,164,0.2)",
    }
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = getTypeConfig(type);
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

// ── Days until deadline helper ────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Single alert card ────────────────────────────────────────────────────────

function AlertCard({ alert, index }: { alert: RegulatoryAlert; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const commentDays = alert.commentEndDate ? daysUntil(alert.commentEndDate) : null;
  const commentUrgent = commentDays !== null && commentDays >= 0 && commentDays <= 14;
  const commentPast = commentDays !== null && commentDays < 0;

  const hasAbstract = alert.abstract.trim().length > 0;
  const abstractShort =
    hasAbstract && alert.abstract.length > 200
      ? alert.abstract.slice(0, 200) + "…"
      : alert.abstract;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.05 }}
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Card header */}
      <div
        className="px-5 py-4"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div className="flex items-start gap-3">
          {/* Left: badges + title */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <TypeBadge type={alert.type} />
              {alert.significantRule && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{
                    background: "rgba(245,158,11,0.1)",
                    color: "var(--accent-amber)",
                    border: "1px solid rgba(245,158,11,0.25)",
                  }}
                >
                  <Zap size={10} />
                  Significant
                </span>
              )}
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {formatDate(alert.publicationDate)}
              </span>
            </div>

            <a
              href={alert.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold leading-snug hover:underline inline-flex items-start gap-1.5"
              style={{ color: "var(--text-primary)" }}
            >
              {alert.title}
              <ExternalLink size={12} className="shrink-0 mt-0.5 opacity-50" />
            </a>

            {/* Agency */}
            {alert.agencies.length > 0 && (
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                {alert.agencies.slice(0, 2).join(" · ")}
                {alert.agencies.length > 2 && ` +${alert.agencies.length - 2} more`}
              </p>
            )}
          </div>

          {/* Right: relevance score */}
          <div
            className="shrink-0 text-right"
            title={alert.relevanceExplanation}
          >
            <p
              className="text-xl font-bold tabular-nums"
              style={{
                color:
                  alert.relevanceScore >= 80
                    ? "#16A34A"
                    : alert.relevanceScore >= 60
                    ? "#D97706"
                    : "var(--text-secondary)",
              }}
            >
              {alert.relevanceScore}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              relevance
            </p>
          </div>
        </div>

        {/* Comment deadline banner */}
        {alert.commentEndDate && !commentPast && (
          <div
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
            style={{
              background: commentUrgent
                ? "rgba(220,38,38,0.08)"
                : "rgba(217,119,6,0.08)",
              border: `1px solid ${commentUrgent ? "rgba(220,38,38,0.2)" : "rgba(217,119,6,0.2)"}`,
              color: commentUrgent ? "var(--accent-red)" : "var(--accent-amber)",
            }}
          >
            <Clock size={12} />
            {commentDays === 0
              ? "Comments close today"
              : `Comments close in ${commentDays} day${commentDays !== 1 ? "s" : ""}`}
            <span className="ml-auto opacity-75">{formatDate(alert.commentEndDate)}</span>
          </div>
        )}
        {alert.commentEndDate && commentPast && (
          <div
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{
              background: "var(--bg-tertiary)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <Clock size={12} />
            Comment period closed {formatDate(alert.commentEndDate)}
          </div>
        )}

        {/* Effective date */}
        {alert.effectiveDate && (
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            Effective: {formatDate(alert.effectiveDate)}
          </p>
        )}
      </div>

      {/* Abstract (expandable) */}
      {hasAbstract && (
        <div
          className="px-5 py-3 border-t"
          style={{
            borderColor: "var(--border)",
            background: "transparent",
          }}
        >
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {expanded ? alert.abstract : abstractShort}
          </p>
          {alert.abstract.length > 200 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1.5 flex items-center gap-1 text-xs font-medium"
              style={{ color: "var(--accent-blue)" }}
            >
              {expanded ? (
                <>
                  <ChevronUp size={12} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={12} /> Read more
                </>
              )}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface RegulatoryRadarProps {
  alerts: RegulatoryAlert[];
  topics: string[];
}

export default function RegulatoryRadar({ alerts, topics }: RegulatoryRadarProps) {
  const [activeTopics, setActiveTopics] = useState<Set<string>>(
    new Set(topics)
  );

  function toggleTopic(topic: string) {
    setActiveTopics((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) {
        // Don't allow deselecting the last topic
        if (next.size === 1) return prev;
        next.delete(topic);
      } else {
        next.add(topic);
      }
      return next;
    });
  }

  // Filter alerts by matching any active topic in title/abstract (case-insensitive)
  const filtered = alerts.filter((alert) => {
    if (activeTopics.size === topics.length) return true; // all selected = show all
    return [...activeTopics].some((topic) => {
      const lcTopic = topic.toLowerCase();
      return (
        alert.title.toLowerCase().includes(lcTopic) ||
        alert.abstract.toLowerCase().includes(lcTopic) ||
        alert.relevanceExplanation.toLowerCase().includes(lcTopic)
      );
    });
  });

  if (alerts.length === 0) {
    return (
      <div
        className="rounded-xl px-6 py-10 text-center"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <Radio size={28} style={{ color: "var(--text-secondary)", margin: "0 auto 12px" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          No recent regulations found
        </p>
        <p className="text-xs mt-1.5 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
          The Federal Register search returned no matching rules or notices for the topics
          extracted from this brief in the past 90 days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--text-secondary)" }}>
            Federal Register · Past 90 days
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {alerts.length} regulation{alerts.length !== 1 ? "s" : ""} matching the topics in this brief
          </p>
        </div>
        {filtered.length !== alerts.length && (
          <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            Showing {filtered.length} of {alerts.length}
          </span>
        )}
      </div>

      {/* Topic filter chips */}
      {topics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {topics.map((topic) => {
            const active = activeTopics.has(topic);
            return (
              <button
                key={topic}
                onClick={() => toggleTopic(topic)}
                className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: active ? "rgba(37,99,235,0.1)" : "var(--bg-secondary)",
                  color: active ? "var(--accent-blue)" : "var(--text-secondary)",
                  border: `1px solid ${active ? "rgba(37,99,235,0.25)" : "var(--border)"}`,
                }}
              >
                {topic}
              </button>
            );
          })}
        </div>
      )}

      {/* Alert list */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            No regulations match the selected topics.
          </motion.p>
        ) : (
          <div className="space-y-3">
            {filtered.map((alert, i) => (
              <AlertCard key={alert.documentNumber} alert={alert} index={i} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Warning disclaimer */}
      <div
        className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs"
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.15)",
          color: "var(--text-secondary)",
        }}
      >
        <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: "var(--accent-amber)" }} />
        Regulatory Radar is informational only. Verify all regulations directly on the{" "}
        <a
          href="https://www.federalregister.gov"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
          style={{ color: "var(--accent-blue)" }}
        >
          Federal Register
        </a>{" "}
        before advising clients.
      </div>
    </div>
  );
}

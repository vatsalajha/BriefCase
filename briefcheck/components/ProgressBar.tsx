"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Citation } from "@/lib/types";

interface ProgressBarProps {
  index: number;
  total: number;
  message: string;
  foundCitations: Citation[];
}

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="rounded-xl px-5 py-4 flex items-start gap-4"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderLeft: "3px solid var(--border)",
      }}
    >
      {/* Icon placeholder */}
      <motion.div
        className="w-5 h-5 rounded-full shrink-0 mt-0.5"
        style={{ background: "var(--bg-tertiary)" }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay }}
      />
      <div className="flex-1 space-y-2.5">
        {/* Case name */}
        <motion.div
          className="h-4 rounded-md w-3/5"
          style={{ background: "var(--bg-tertiary)" }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay }}
        />
        {/* Proposition */}
        <motion.div
          className="h-3 rounded-md w-4/5"
          style={{ background: "var(--bg-tertiary)" }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.15 }}
        />
        <motion.div
          className="h-3 rounded-md w-2/5"
          style={{ background: "var(--bg-tertiary)" }}
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: delay + 0.3 }}
        />
      </div>
      {/* Badge placeholder */}
      <motion.div
        className="w-16 h-5 rounded-full shrink-0"
        style={{ background: "var(--bg-tertiary)" }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </motion.div>
  );
}

export default function ProgressBar({ index, total, message, foundCitations }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((index / total) * 100) : 0;
  // Number of skeleton cards to show: remaining unverified, or 6 if we don't know total yet
  const skeletonCount = total > 0 ? total - index : Math.min(foundCitations.length || 6, 6);

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Status + pulsing dot */}
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0">
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
            style={{ background: "var(--accent-blue)" }}
          />
          <span
            className="relative inline-flex h-3 w-3 rounded-full"
            style={{ background: "var(--accent-blue)" }}
          />
        </span>
        <p className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
          {message}
        </p>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <span>Verifying citation {index} of {total}</span>
            <span>{pct}%</span>
          </div>
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--accent-blue)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ ease: "easeOut", duration: 0.4 }}
            />
          </div>
        </div>
      )}

      {/* Skeleton cards — shown while verifying */}
      {(total > 0 || foundCitations.length > 0) && (
        <div className="space-y-3">
          <p
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-secondary)" }}
          >
            {total > 0 ? "Verifying citations…" : "Citations found"}
          </p>

          {/* Already-found citation list (before verification starts) */}
          <AnimatePresence initial={false}>
            {total === 0 &&
              foundCitations.map((c) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "var(--text-secondary)" }}
                  />
                  <span
                    className="text-sm font-mono truncate"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {c.rawText}
                  </span>
                </motion.div>
              ))}
          </AnimatePresence>

          {/* Skeleton placeholders for unverified cards */}
          {total > 0 &&
            Array.from({ length: skeletonCount }).map((_, i) => (
              <SkeletonCard key={i} delay={i * 0.07} />
            ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, Plus, X, FileText } from "lucide-react";
import type { Session } from "@/lib/store";

// ── Sidebar-specific design tokens (always dark, regardless of theme) ─────────

const S = {
  bg: "var(--bg-secondary)",
  border: "var(--border)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  hover: "var(--bg-tertiary)",
  activeBg: "rgba(37,99,235,0.08)",
  activeBorder: "rgba(37,99,235,0.2)",
  activeText: "var(--accent-blue)",
  btnBg: "var(--bg-tertiary)",
  btnBorder: "var(--border)",
  btnText: "var(--text-secondary)",
};

interface SidebarProps {
  open: boolean;
  sessions: Session[];
  activeSessionId: string | null;
  onClose: () => void;
  onNewAnalysis: () => void;
  onSelectSession: (session: Session) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusSummary({ session }: { session: Session }) {
  if (session.status === "processing") {
    return (
      <span className="text-xs" style={{ color: S.textSecondary }}>
        Processing…
      </span>
    );
  }
  if (session.status === "failed") {
    return (
      <span className="text-xs" style={{ color: "#F87171" }}>
        Failed
      </span>
    );
  }
  const parts: string[] = [];
  if (session.verified > 0) parts.push(`${session.verified}✅`);
  if (session.warnings > 0) parts.push(`${session.warnings}⚠️`);
  if (session.errors > 0) parts.push(`${session.errors}❌`);
  if (session.notFound > 0) parts.push(`${session.notFound}🔍`);
  return (
    <span className="text-xs" style={{ color: S.textSecondary }}>
      {parts.join("  ") || "0 citations"}
    </span>
  );
}

function SessionItem({
  session,
  active,
  onClick,
}: {
  session: Session;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg flex flex-col gap-1 transition-colors"
      style={{
        background: active ? S.activeBg : "transparent",
        border: active ? `1px solid ${S.activeBorder}` : "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = S.hover;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText
          size={12}
          style={{ color: active ? S.activeText : S.textSecondary, flexShrink: 0 }}
        />
        <span
          className="text-sm font-medium truncate"
          style={{ color: S.textPrimary }}
        >
          {session.fileName === "pasted-text" ? "Pasted text" : session.fileName.replace(/\.pdf$/i, "")}
        </span>
      </div>
      <div className="flex items-center justify-between pl-4">
        <StatusSummary session={session} />
        <span className="text-xs" style={{ color: S.textSecondary, opacity: 0.7 }}>
          {formatDate(session.createdAt)}
        </span>
      </div>
    </button>
  );
}

export default function Sidebar({
  open,
  sessions,
  activeSessionId,
  onClose,
  onNewAnalysis,
  onSelectSession,
}: SidebarProps) {
  const SIDEBAR_W = 280;

  const sidebarContent = (
    <div
      className="flex flex-col h-full"
      style={{
        background: S.bg,
        borderRight: `1px solid var(--border)`,
        width: SIDEBAR_W,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${S.border}` }}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} style={{ color: S.textSecondary }} />
          <span
            className="text-sm font-semibold"
            style={{ color: S.textPrimary }}
          >
            History
          </span>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md"
          style={{ color: S.textSecondary }}
        >
          <X size={16} />
        </button>
      </div>

      {/* New Analysis */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <button
          onClick={onNewAnalysis}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{
            background: S.btnBg,
            border: `1px solid ${S.btnBorder}`,
            color: S.btnText,
          }}
        >
          <Plus size={14} />
          New Analysis
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sessions.length === 0 ? (
          <div className="mt-6 text-center px-4">
            <p className="text-xs" style={{ color: S.textSecondary }}>
              No past analyses yet.
              <br />Upload a brief to get started.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 mt-1">
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                active={s.id === activeSessionId}
                onClick={() => onSelectSession(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop: push layout ── */}
      <motion.div
        animate={{ width: open ? SIDEBAR_W : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden md:block shrink-0 overflow-hidden"
        style={{ height: "100%" }}
      >
        {sidebarContent}
      </motion.div>

      {/* ── Mobile: overlay from left ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={onClose}
              className="md:hidden fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.5)" }}
            />
            {/* Drawer */}
            <motion.div
              key="drawer"
              initial={{ x: -SIDEBAR_W }}
              animate={{ x: 0 }}
              exit={{ x: -SIDEBAR_W }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50"
              style={{ width: SIDEBAR_W }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

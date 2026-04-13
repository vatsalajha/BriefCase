"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, PanelLeftOpen,
  BookOpen, Scale, Radio, Check, Loader2,
} from "lucide-react";
import type { AnalysisReport, Citation, VerificationResult } from "@/lib/types";
import type { Session } from "@/lib/store";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import ProgressBar from "@/components/ProgressBar";
import Dashboard from "@/components/Dashboard";
import Sidebar from "@/components/Sidebar";

// ─── Types ────────────────────────────────────────────────────────────────────

type AppState = "upload" | "analyzing" | "results";
type StageStatus = "pending" | "processing" | "complete";

interface Stages {
  citations: StageStatus;
  jurisdiction: StageStatus;
  regulatory: StageStatus;
}

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

const STAGE_CFG = [
  {
    key: "citations" as const,
    icon: BookOpen,
    label: "Citation Verification",
    desc: "Extract & verify case citations against Midpage",
  },
  {
    key: "jurisdiction" as const,
    icon: Scale,
    label: "Jurisdiction Analysis",
    desc: "Check contract clause enforceability across states",
  },
  {
    key: "regulatory" as const,
    icon: Radio,
    label: "Regulatory Radar",
    desc: "Scan Federal Register for relevant regulations",
  },
] as const;

const INITIAL_STAGES: Stages = {
  citations: "pending",
  jurisdiction: "pending",
  regulatory: "pending",
};

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

function humaniseError(raw: string): string {
  if (raw.includes("10 MB"))
    return "That file is over 10 MB. Try a smaller PDF or paste the text directly.";
  if (raw.includes("ANTHROPIC_API_KEY"))
    return "API key not configured. Add ANTHROPIC_API_KEY to .env.local and restart.";
  if (
    raw.includes("unreachable") ||
    raw.includes("fetch failed") ||
    raw.includes("ECONNREFUSED")
  )
    return "Network error reaching Midpage. Check your connection and try again.";
  if (raw.includes("No citations"))
    return "No case citations were found in this document. Try a different brief.";
  return raw;
}

// ─── Stage indicator component ────────────────────────────────────────────────

function StageIndicator({ stages }: { stages: Stages }) {
  return (
    <div className="flex flex-col gap-4 w-full max-w-sm">
      {STAGE_CFG.map(({ key, icon: Icon, label, desc }) => {
        const status = stages[key];
        return (
          <div key={key} className="flex items-center gap-4">
            {/* Status icon */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all"
              style={{
                background:
                  status === "complete"
                    ? "rgba(22,163,74,0.1)"
                    : status === "processing"
                    ? "rgba(37,99,235,0.1)"
                    : "var(--bg-tertiary)",
                border: `1px solid ${
                  status === "complete"
                    ? "rgba(22,163,74,0.25)"
                    : status === "processing"
                    ? "rgba(37,99,235,0.25)"
                    : "var(--border)"
                }`,
              }}
            >
              {status === "complete" ? (
                <Check size={15} style={{ color: "var(--accent-green)" }} />
              ) : status === "processing" ? (
                <Loader2 size={15} className="animate-spin" style={{ color: "var(--accent-blue)" }} />
              ) : (
                <Icon size={15} style={{ color: "var(--text-secondary)" }} />
              )}
            </div>

            {/* Text */}
            <div>
              <p
                className="text-sm font-semibold"
                style={{
                  color:
                    status === "complete"
                      ? "var(--accent-green)"
                      : status === "processing"
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                }}
              >
                {label}
              </p>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {status === "complete"
                  ? "Done"
                  : status === "processing"
                  ? desc
                  : "Waiting…"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("upload");
  const [statusMessage, setStatusMessage] = useState("Preparing analysis…");
  const [verifyIndex, setVerifyIndex] = useState(0);
  const [verifyTotal, setVerifyTotal] = useState(0);
  const [foundCitations, setFoundCitations] = useState<Citation[]>([]);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFormData, setLastFormData] = useState<FormData | null>(null);
  const [stages, setStages] = useState<Stages>(INITIAL_STAGES);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Mark citations complete when all results received
  useEffect(() => {
    if (verifyIndex > 0 && verifyTotal > 0 && verifyIndex === verifyTotal) {
      setStages((s) => ({ ...s, citations: "complete" }));
    }
  }, [verifyIndex, verifyTotal]);

  // Keyboard shortcut: Cmd+D / Ctrl+D → load demo brief
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        if (appState === "upload") handleDemo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState]);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = (await res.json()) as { sessions: Session[] };
        setSessions(data.sessions);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  async function runAnalysis(formData: FormData) {
    setLastFormData(formData);
    setAppState("analyzing");
    setStatusMessage("Extracting text from brief…");
    setVerifyIndex(0);
    setVerifyTotal(0);
    setFoundCitations([]);
    setErrorMsg(null);
    setActiveSessionId(null);
    setStages(INITIAL_STAGES);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body: formData });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Server error ${res.status}`
        );
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: SseEvent;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              setStatusMessage(event.message);
              break;

            case "citations_found":
              setFoundCitations(event.citations);
              setStages((s) => ({ ...s, citations: "processing" }));
              setStatusMessage(
                event.count === 0
                  ? "No citations found in document."
                  : `Found ${event.count} citation${event.count !== 1 ? "s" : ""}. Verifying against Midpage…`
              );
              break;

            case "verifying":
              setVerifyIndex(event.index);
              setVerifyTotal(event.total);
              setStatusMessage(`Verifying "${event.citation}"…`);
              break;

            case "result":
              break;

            case "clauses_found":
              setStages((s) => ({ ...s, jurisdiction: "processing" }));
              setStatusMessage(
                `Found ${event.count} contract clause${event.count !== 1 ? "s" : ""}. Analyzing jurisdictions…`
              );
              break;

            case "regulatory_searching":
              setStages((s) => ({ ...s, regulatory: "processing" }));
              setStatusMessage(
                `Scanning Federal Register for: ${event.topics.slice(0, 2).join(", ")}…`
              );
              break;

            case "jurisdiction_complete":
              setStages((s) => ({ ...s, jurisdiction: "complete" }));
              break;

            case "regulatory_complete":
              setStages((s) => ({ ...s, regulatory: "complete" }));
              break;

            case "complete":
              setStages({ citations: "complete", jurisdiction: "complete", regulatory: "complete" });
              setReport(event.report);
              setAppState("results");
              await fetchSessions();
              break;

            case "error":
              throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Something went wrong.";
      setErrorMsg(humaniseError(raw));
      setAppState("upload");
      fetchSessions();
    }
  }

  function handleFile(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    runAnalysis(fd);
  }

  function handleText(text: string) {
    const fd = new FormData();
    fd.append("text", text);
    runAnalysis(fd);
  }

  async function handleDemo() {
    const res = await fetch("/demo/demo-brief.txt");
    const text = await res.text();
    handleText(text);
  }

  function reset() {
    setAppState("upload");
    setReport(null);
    setErrorMsg(null);
    setFoundCitations([]);
    setVerifyIndex(0);
    setVerifyTotal(0);
    setActiveSessionId(null);
    setStages(INITIAL_STAGES);
  }

  async function handleSelectSession(session: Session) {
    setActiveSessionId(session.id);
    if (session.status === "completed" && session.report) {
      setReport(session.report);
      setAppState("results");
    } else if (session.status === "completed") {
      try {
        const res = await fetch(`/api/sessions/${session.id}`);
        if (res.ok) {
          const data = (await res.json()) as {
            session: Session;
            results: { result: VerificationResult }[];
          };
          if (data.session.report) {
            setReport(data.session.report);
            setAppState("results");
          }
        }
      } catch {
        // ignore
      }
    }
    setSidebarOpen(false);
  }

  function handleNewAnalysis() {
    reset();
    setSidebarOpen(false);
  }

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onClose={() => setSidebarOpen(false)}
          onNewAnalysis={handleNewAnalysis}
          onSelectSession={handleSelectSession}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Sidebar toggle */}
          <div className="px-4 pt-4 pb-0 flex items-center">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                color: sidebarOpen ? "var(--accent-blue)" : "var(--text-secondary)",
                background: sidebarOpen ? "rgba(37,99,235,0.08)" : "transparent",
                border: `1px solid ${
                  sidebarOpen ? "rgba(37,99,235,0.2)" : "var(--border)"
                }`,
              }}
            >
              <PanelLeftOpen size={14} />
              <span className="hidden sm:inline">History</span>
            </button>
          </div>

          <main className="flex-1 flex flex-col items-center px-4 py-8">
            <AnimatePresence mode="wait">

              {/* ── UPLOAD ──────────────────────────────────────────────────── */}
              {appState === "upload" && (
                <motion.div
                  key="upload"
                  variants={PAGE_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="w-full flex flex-col items-center gap-8"
                >
                  {/* Hero */}
                  <div className="text-center max-w-2xl">
                    <h1
                      className="text-4xl sm:text-5xl font-bold leading-tight mb-4"
                      style={{
                        fontFamily: "var(--font-serif)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Legal Intelligence,
                      <br />
                      <span style={{ color: "var(--accent-blue)" }}>All in One Brief.</span>
                    </h1>
                    <p
                      className="text-base leading-relaxed mb-6"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Upload a brief and BriefCheck runs three simultaneous analyses —
                      verifying every citation, checking contract clause enforceability across
                      US states, and scanning the Federal Register for recent regulations.
                    </p>

                    {/* Feature cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                      {[
                        {
                          icon: BookOpen,
                          color: "#16A34A",
                          bg: "rgba(22,163,74,0.06)",
                          border: "rgba(22,163,74,0.15)",
                          title: "Citation Verification",
                          desc: "Every case citation verified against live databases. Holdings checked. Bad cites flagged.",
                        },
                        {
                          icon: Scale,
                          color: "#2563EB",
                          bg: "rgba(37,99,235,0.06)",
                          border: "rgba(37,99,235,0.15)",
                          title: "Jurisdiction Analysis",
                          desc: "Contract clauses auto-detected and checked for enforceability across CA, TX, NY, DE, FL.",
                        },
                        {
                          icon: Radio,
                          color: "#D97706",
                          bg: "rgba(217,119,6,0.06)",
                          border: "rgba(217,119,6,0.15)",
                          title: "Regulatory Radar",
                          desc: "Federal Register scanned for recent rules and notices relevant to your brief's topics.",
                        },
                      ].map(({ icon: Icon, color, bg, border, title, desc }) => (
                        <div
                          key={title}
                          className="rounded-xl p-4"
                          style={{ background: bg, border: `1px solid ${border}` }}
                        >
                          <Icon size={18} style={{ color }} className="mb-2" />
                          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                            {title}
                          </p>
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                            {desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Error banner */}
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full max-w-2xl flex items-start justify-between gap-4 px-4 py-3 rounded-xl text-sm"
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "var(--accent-red)",
                      }}
                    >
                      <span>{errorMsg}</span>
                      {lastFormData && (
                        <button
                          onClick={() => runAnalysis(lastFormData)}
                          className="flex items-center gap-1.5 shrink-0 font-medium underline underline-offset-2"
                        >
                          <RotateCcw size={13} />
                          Retry
                        </button>
                      )}
                    </motion.div>
                  )}

                  <UploadZone onFile={handleFile} onText={handleText} />
                </motion.div>
              )}

              {/* ── ANALYZING ───────────────────────────────────────────────── */}
              {appState === "analyzing" && (
                <motion.div
                  key="analyzing"
                  variants={PAGE_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="w-full flex flex-col items-center gap-10 pt-4"
                >
                  <div className="text-center">
                    <h2
                      className="text-3xl font-bold mb-2"
                      style={{
                        fontFamily: "var(--font-serif)",
                        color: "var(--text-primary)",
                      }}
                    >
                      Analyzing Brief
                    </h2>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      Three analyses running — 30–90 seconds depending on brief length.
                    </p>
                  </div>

                  {/* Three-stage progress */}
                  <div
                    className="w-full max-w-2xl rounded-2xl p-6"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <StageIndicator stages={stages} />
                  </div>

                  {/* Citation-level progress bar */}
                  <ProgressBar
                    index={verifyIndex}
                    total={verifyTotal}
                    message={statusMessage}
                    foundCitations={foundCitations}
                  />
                </motion.div>
              )}

              {/* ── RESULTS / DASHBOARD ─────────────────────────────────────── */}
              {appState === "results" && report && (
                <motion.div
                  key="results"
                  variants={PAGE_VARIANTS}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <Dashboard report={report} onReset={reset} />
                </motion.div>
              )}

            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer
            className="py-5 mt-8"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <p
              className="text-center text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              Powered by{" "}
              <a
                href="https://midpage.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2 transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                Midpage
              </a>
              {" · "}
              <a
                href="https://anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2 transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                Claude by Anthropic
              </a>
              {" · "}
              <a
                href="https://www.llamaindex.ai/llamaparse"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2 transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                LlamaParse by LlamaIndex
              </a>
              {" · "}
              <a
                href="https://www.federalregister.gov/reader-aids/developer-resources/rest-api"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline underline-offset-2 transition-colors"
                style={{ color: "var(--text-primary)" }}
              >
                Federal Register API
              </a>
              {" — LLM × Law Hackathon 2025"}
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}

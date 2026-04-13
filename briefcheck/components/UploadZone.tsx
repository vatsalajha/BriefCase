"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Upload, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { DEMO_BRIEF_TEXT } from "@/lib/demo-brief";

interface UploadZoneProps {
  onFile: (file: File) => void;
  onText: (text: string) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFile, onText, disabled }: UploadZoneProps) {
  function handleTryDemo() {
    if (!disabled) onText(DEMO_BRIEF_TEXT);
  }
  const [tab, setTab] = useState<"file" | "text">("file");
  const [pastedText, setPastedText] = useState("");

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0] && !disabled) onFile(accepted[0]);
    },
    [onFile, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    maxFiles: 1,
    disabled,
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* ── Try Demo button ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-5"
      >
        <motion.button
          onClick={handleTryDemo}
          disabled={disabled}
          whileHover={disabled ? {} : { y: -1, boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
          whileTap={disabled ? {} : { y: 0 }}
          className="w-full flex items-center justify-center gap-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            padding: "14px 24px",
            fontFamily: "var(--font-serif)",
            fontSize: "1rem",
            fontWeight: 600,
            border: "1px solid var(--border)",
            boxShadow: "var(--card-shadow)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <Sparkles size={16} style={{ flexShrink: 0, color: "var(--text-secondary)" }} />
          Try Demo — See BriefCase in Action
        </motion.button>
        <p
          className="text-center text-xs mt-2.5 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Analyzes a sample legal brief with 6 citations —
          including a hallucinated case and an overruled precedent.
        </p>
      </motion.div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          or upload your own brief
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Tab toggle */}
      <div
        className="flex rounded-lg p-1 mb-4 w-fit"
        style={{ background: "var(--bg-tertiary)" }}
      >
        {(["file", "text"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: tab === t ? "var(--bg-secondary)" : "transparent",
              color: tab === t ? "var(--accent-blue)" : "var(--text-secondary)",
              border: tab === t ? `1px solid var(--border)` : "1px solid transparent",
              fontWeight: tab === t ? 600 : 400,
            }}
          >
            {t === "file" ? "Upload file" : "Paste text"}
          </button>
        ))}
      </div>

      {tab === "file" ? (
        <div
          {...getRootProps()}
          className="relative flex flex-col items-center justify-center gap-5 rounded-2xl p-16 cursor-pointer transition-all"
          style={{
            border: `2px dashed ${isDragActive ? "var(--accent-blue)" : "var(--border)"}`,
            background: isDragActive ? "rgba(59,130,246,0.05)" : "var(--bg-secondary)",
            opacity: disabled ? 0.5 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
        >
          <input {...getInputProps()} />

          {/* Icon */}
          <motion.div
            animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: "var(--bg-tertiary)" }}
          >
            {isDragActive ? (
              <Upload size={28} style={{ color: "var(--accent-blue)" }} />
            ) : (
              <FileText size={28} style={{ color: "var(--text-secondary)" }} />
            )}
          </motion.div>

          {/* Text */}
          <div className="text-center">
            <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
              {isDragActive ? "Release to upload" : "Drop your legal brief here"}
            </p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              or{" "}
              <span style={{ color: "var(--accent-blue)" }} className="underline underline-offset-2">
                click to browse
              </span>
            </p>
          </div>

          {/* File type badges */}
          <div className="flex gap-2">
            {[".pdf", ".docx", ".txt"].map((ext) => (
              <span
                key={ext}
                className="px-2.5 py-1 rounded-md text-xs font-medium"
                style={{
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg-tertiary)",
                  color: "var(--text-tertiary)",
                  border: "1px solid var(--border)",
                }}
              >
                {ext}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
        >
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste the full text of your legal brief here…"
            rows={12}
            disabled={disabled}
            className="w-full bg-transparent resize-none outline-none text-sm leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={() => pastedText.trim() && onText(pastedText.trim())}
              disabled={!pastedText.trim() || disabled}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: pastedText.trim() && !disabled ? "var(--accent-blue)" : "var(--bg-tertiary)",
                color: pastedText.trim() && !disabled ? "#fff" : "var(--text-tertiary)",
                cursor: pastedText.trim() && !disabled ? "pointer" : "not-allowed",
                border: pastedText.trim() && !disabled ? "1px solid var(--accent-blue)" : "1px solid var(--border)",
              }}
            >
              Analyze brief
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { ShieldCheck } from "lucide-react";

export default function Header() {
  return (
    <header
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Shield icon — clean, no glow */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "var(--accent-blue)" }}
          >
            <ShieldCheck size={16} color="#fff" strokeWidth={2.5} />
          </div>

          <span
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
          >
            BriefCheck
          </span>
        </div>

        <span
          className="text-sm hidden sm:block"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-sans)" }}
        >
          Citation Verification for Legal Professionals
        </span>
      </div>
    </header>
  );
}

"use client";

import { useState, useCallback } from "react";

type DayData = { date: string; count: number };
type AdminStats = {
  total_analyses: number;
  total_citations: number;
  last_seen: string | null;
  today: number;
  service_enabled: boolean;
  daily_limit: number;
  daily: DayData[];
};

function formatTimestamp(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDay(dateStr: string) {
  const today = new Date().toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [keyInput, setKeyInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [savedKey, setSavedKey] = useState("");

  const [toggling, setToggling] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitMsg, setLimitMsg] = useState("");

  const fetchStats = useCallback(async (adminKey: string) => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { "x-admin-key": adminKey },
      });
      if (res.status === 401) {
        setLoginError("Wrong password.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "Could not load stats.");
        return;
      }
      setStats(data as AdminStats);
      setSavedKey(adminKey);
      setLimitInput(data.daily_limit > 0 ? String(data.daily_limit) : "");
    } catch {
      setLoginError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchStats(keyInput);
  };

  const handleToggle = async () => {
    if (!stats) return;
    setToggling(true);
    try {
      const res = await fetch("/api/admin/control", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": savedKey },
        body: JSON.stringify({ action: "toggle", enabled: !stats.service_enabled }),
      });
      if (res.ok) {
        setStats((s) => (s ? { ...s, service_enabled: !s.service_enabled } : s));
      }
    } finally {
      setToggling(false);
    }
  };

  const handleSetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLimitSaving(true);
    setLimitMsg("");
    try {
      const limit = parseInt(limitInput) || 0;
      const res = await fetch("/api/admin/control", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": savedKey },
        body: JSON.stringify({ action: "limit", limit }),
      });
      if (res.ok) {
        setStats((s) => (s ? { ...s, daily_limit: limit } : s));
        setLimitMsg(limit === 0 ? "No limit — service is unlimited." : `Limit set to ${limit} analyses/day.`);
        setTimeout(() => setLimitMsg(""), 4000);
      }
    } finally {
      setLimitSaving(false);
    }
  };

  // ─── Login screen ─────────────────────────────────────────────────────────
  if (!stats) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "44px 48px",
            width: "100%",
            maxWidth: 400,
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>⚖️</div>
            <h1
              style={{
                fontSize: "1.4rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                fontFamily: "'Source Serif 4', Georgia, serif",
              }}
            >
              BriefCase Admin
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 6 }}>
              Usage dashboard &amp; service controls
            </p>
          </div>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin password"
              autoFocus
              style={{
                width: "100%",
                padding: "11px 14px",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: "0.95rem",
                background: "var(--bg-tertiary)",
                color: "var(--text-primary)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {loginError && (
              <p style={{ color: "var(--accent-red)", fontSize: "0.82rem", marginTop: 8 }}>
                {loginError}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !keyInput}
              style={{
                width: "100%",
                marginTop: 16,
                padding: "12px",
                background: loading || !keyInput ? "var(--bg-tertiary)" : "var(--text-primary)",
                color: loading || !keyInput ? "var(--text-tertiary)" : "var(--bg-secondary)",
                border: "none",
                borderRadius: 8,
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: loading || !keyInput ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Checking…" : "Enter Dashboard"}
            </button>
          </form>

          <p style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text-tertiary)", marginTop: 20 }}>
            Set <code style={{ background: "var(--bg-tertiary)", padding: "1px 5px", borderRadius: 4 }}>ADMIN_KEY</code> in your environment to enable access.
          </p>
        </div>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  const maxBar = Math.max(...stats.daily.map((d) => d.count), 1);
  const todayDate = new Date().toISOString().split("T")[0];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
        padding: "32px 20px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.6rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                fontFamily: "'Source Serif 4', Georgia, serif",
              }}
            >
              ⚖️ BriefCase Admin
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 5 }}>
              Last activity: {formatTimestamp(stats.last_seen)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => fetchStats(savedKey)}
              style={{
                padding: "8px 16px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-secondary)",
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              Refresh
            </button>
            <button
              onClick={() => {
                setStats(null);
                setSavedKey("");
                setKeyInput("");
              }}
              style={{
                padding: "8px 16px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-secondary)",
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              🔒 Lock
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          {[
            { label: "Total Analyses", value: stats.total_analyses.toLocaleString(), color: "var(--accent-blue)" },
            { label: "Citations Verified", value: stats.total_citations.toLocaleString(), color: "var(--accent-green)" },
            { label: "Today", value: stats.today.toLocaleString(), color: "var(--accent-amber)" },
            {
              label: "Service",
              value: stats.service_enabled ? "Running" : "Paused",
              color: stats.service_enabled ? "var(--accent-green)" : "var(--accent-red)",
            },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "20px 24px",
                boxShadow: "var(--card-shadow)",
              }}
            >
              <p
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  margin: 0,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {label}
              </p>
              <p
                style={{
                  color,
                  fontSize: "1.9rem",
                  fontWeight: 700,
                  margin: "8px 0 0",
                  fontFamily: "'Source Serif 4', Georgia, serif",
                }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* 14-day bar chart */}
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "24px",
            marginBottom: 24,
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p
            style={{
              margin: "0 0 20px",
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Last 14 Days
          </p>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
            {stats.daily.map(({ date, count }) => {
              const isToday = date === todayDate;
              return (
                <div
                  key={date}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                >
                  <div
                    title={`${shortDay(date)}: ${count} ${count === 1 ? "analysis" : "analyses"}`}
                    style={{
                      width: "100%",
                      height: `${Math.max(4, (count / maxBar) * 84)}px`,
                      background: isToday
                        ? "var(--accent-blue)"
                        : count > 0
                        ? "var(--border-strong)"
                        : "var(--bg-tertiary)",
                      borderRadius: "4px 4px 2px 2px",
                      transition: "height 0.3s ease",
                      cursor: "default",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "0.58rem",
                      color: isToday ? "var(--accent-blue)" : "var(--text-tertiary)",
                      fontWeight: isToday ? 700 : 400,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {shortDay(date).replace(/[A-Za-z]+ /, d => d.slice(0, 3))}
                  </span>
                </div>
              );
            })}
          </div>

          {stats.total_analyses === 0 && (
            <p
              style={{
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: "0.82rem",
                marginTop: 16,
              }}
            >
              No analyses yet — bars will appear once people start using the app.
            </p>
          )}
        </div>

        {/* Service controls */}
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "24px",
            boxShadow: "var(--card-shadow)",
          }}
        >
          <p
            style={{
              margin: "0 0 20px",
              fontWeight: 600,
              fontSize: "0.9rem",
              color: "var(--text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Service Controls
          </p>

          {/* Kill switch */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingBottom: 20,
              marginBottom: 20,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                Kill Switch
              </p>
              <p style={{ margin: "5px 0 0", fontSize: "0.82rem", color: "var(--text-secondary)", maxWidth: 480 }}>
                {stats.service_enabled
                  ? "Service is running normally. Toggle off to block all incoming analysis requests with a maintenance message."
                  : "Service is paused. All /api/analyze requests are returning 503. Toggle on to re-enable."}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              style={{
                padding: "10px 28px",
                background: stats.service_enabled
                  ? "var(--accent-green)"
                  : "var(--accent-red)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: "0.9rem",
                cursor: toggling ? "not-allowed" : "pointer",
                minWidth: 90,
                flexShrink: 0,
                marginLeft: 24,
                transition: "background 0.2s",
              }}
            >
              {toggling ? "…" : stats.service_enabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* Daily limit */}
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
              Daily Analysis Limit
            </p>
            <p style={{ margin: "0 0 14px", fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Auto-pauses when the daily count is reached. Resets at midnight UTC. Set to 0 for unlimited.
              {stats.daily_limit > 0 && (
                <>
                  {" "}Current:{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {stats.today}/{stats.daily_limit}
                  </strong>{" "}
                  used today.
                </>
              )}
            </p>
            <form onSubmit={handleSetLimit} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="number"
                min="0"
                value={limitInput}
                onChange={(e) => {
                  setLimitInput(e.target.value);
                  setLimitMsg("");
                }}
                placeholder="0 = unlimited"
                style={{
                  padding: "9px 14px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  width: 160,
                  background: "var(--bg-tertiary)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={limitSaving}
                style={{
                  padding: "9px 22px",
                  background: "var(--text-primary)",
                  color: "var(--bg-secondary)",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: limitSaving ? "not-allowed" : "pointer",
                }}
              >
                {limitSaving ? "Saving…" : "Save"}
              </button>
              {limitMsg && (
                <span style={{ color: "var(--accent-green)", fontSize: "0.85rem" }}>{limitMsg}</span>
              )}
            </form>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "0.72rem",
            marginTop: 28,
          }}
        >
          BriefCase Admin · Powered by Vercel KV · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

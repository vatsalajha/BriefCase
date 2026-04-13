import type { VerificationResult, AnalysisReport } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type SessionStatus = "processing" | "completed" | "failed";

export interface Session {
  id: string;
  fileName: string;
  status: SessionStatus;
  totalCitations: number;
  verified: number;
  warnings: number;
  errors: number;
  notFound: number;
  createdAt: string;
  updatedAt: string;
  report: AnalysisReport | null;
}

export interface StoredCitationResult {
  sessionId: string;
  index: number;
  result: VerificationResult;
  createdAt: string;
}

// ── In-memory store ────────────────────────────────────────────────────────
// Uses a global Map so state persists across requests within the same process.
// On Vercel, each serverless function instance has its own memory — this is
// fine for demo/hackathon use. Swap to a real DB by keeping these signatures.

const sessions = new Map<string, Session>();
const results = new Map<string, StoredCitationResult[]>(); // keyed by sessionId

// ── Session CRUD ───────────────────────────────────────────────────────────

export function createSession(fileName: string): Session {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session: Session = {
    id,
    fileName,
    status: "processing",
    totalCitations: 0,
    verified: 0,
    warnings: 0,
    errors: 0,
    notFound: 0,
    createdAt: now,
    updatedAt: now,
    report: null,
  };
  sessions.set(id, session);
  results.set(id, []);
  return session;
}

export function updateSession(
  id: string,
  patch: Partial<Omit<Session, "id" | "createdAt">>
): Session | null {
  const session = sessions.get(id);
  if (!session) return null;
  const updated: Session = {
    ...session,
    ...patch,
    id,
    createdAt: session.createdAt,
    updatedAt: new Date().toISOString(),
  };
  sessions.set(id, updated);
  return updated;
}

export function addCitationResult(
  sessionId: string,
  index: number,
  result: VerificationResult
): void {
  const list = results.get(sessionId) ?? [];
  list.push({ sessionId, index, result, createdAt: new Date().toISOString() });
  results.set(sessionId, list);
}

export function getSession(id: string): Session | null {
  return sessions.get(id) ?? null;
}

export function getAllSessions(limit = 50): Session[] {
  return [...sessions.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getSessionResults(sessionId: string): StoredCitationResult[] {
  return (results.get(sessionId) ?? []).sort((a, b) => a.index - b.index);
}

export function deleteSession(id: string): boolean {
  const existed = sessions.has(id);
  sessions.delete(id);
  results.delete(id);
  return existed;
}

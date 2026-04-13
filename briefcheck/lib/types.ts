export interface Citation {
  id: string;
  rawText: string;        // e.g. "Smith v. Jones, 542 U.S. 296 (2004)"
  caseName: string;       // e.g. "Smith v. Jones"
  citation: string;       // e.g. "542 U.S. 296"
  year: string;           // e.g. "2004"
  proposition: string;    // What the brief claims this case stands for
  contextInBrief: string; // The surrounding paragraph from the brief
}

export interface VerificationResult {
  citation: Citation;
  status: "verified" | "warning" | "error" | "not_found";
  midpageFound: boolean;
  caseName: string | null;
  court: string | null;
  dateFiled: string | null;
  overallTreatment: string | null; // Positive, Negative, Caution, Neutral
  holdingMatch: boolean | null;    // Does the case support the brief's claim?
  holdingAnalysis: string;         // Claude's explanation
  midpageOpinionId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  citations: any[];                // All citation formats from Midpage
  verificationSource?: "midpage" | "trustfoundry" | null; // Which DB found the case
}

// ── Jurisdiction types ──────────────────────────────────────────────────────

export type ClauseStatus =
  | "enforceable"
  | "partially_enforceable"
  | "void"
  | "uncertain";

export interface JurisdictionAnalysis {
  state: string;
  stateCode: string;
  status: ClauseStatus;
  explanation: string;
  keyStatute: string;
  recentChanges: string | null;
}

export interface JurisdictionResult {
  clause: string;       // The raw clause text
  clauseType: string;   // e.g. 'non-compete' | 'arbitration' | 'nda' | etc.
  jurisdictions: JurisdictionAnalysis[];
}

// ── Regulatory radar types ───────────────────────────────────────────────────

export interface RegulatoryAlert {
  title: string;
  type: string;          // 'Rule' | 'Proposed Rule' | 'Notice' | 'Presidential Document'
  abstract: string;
  agencies: string[];
  publicationDate: string;
  effectiveDate: string | null;
  commentEndDate: string | null;
  htmlUrl: string;
  pdfUrl: string;
  documentNumber: string;
  significantRule: boolean;
  relevanceScore: number;       // 0-100
  relevanceExplanation: string;
}

// ── Report ──────────────────────────────────────────────────────────────────

export interface AnalysisReport {
  fileName: string;
  totalCitations: number;
  verified: number;
  warnings: number;
  errors: number;
  notFound: number;
  results: VerificationResult[];
  clauses: JurisdictionResult[];       // Contract clauses + jurisdiction analysis
  regulatoryAlerts: RegulatoryAlert[]; // Federal Register hits
  regulatoryTopics: string[];          // Topics used for the regulatory search
  analyzedAt: string;
}

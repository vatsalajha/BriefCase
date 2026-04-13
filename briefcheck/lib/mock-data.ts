import type { Citation, VerificationResult, AnalysisReport } from "./types";

export const MOCK_CITATIONS: Citation[] = [
  {
    id: "1",
    rawText: "Carpenter v. United States, 585 U.S. 296 (2018)",
    caseName: "Carpenter v. United States",
    citation: "585 U.S. 296",
    year: "2018",
    proposition:
      "The government generally needs a warrant to access cell-site location information from wireless carriers",
    contextInBrief:
      "As the Supreme Court held in Carpenter v. United States, 585 U.S. 296 (2018), the Fourth Amendment protects individuals' reasonable expectation of privacy in their physical movements as captured through cell-site location information.",
  },
  {
    id: "2",
    rawText: "Miranda v. Arizona, 384 U.S. 436 (1966)",
    caseName: "Miranda v. Arizona",
    citation: "384 U.S. 436",
    year: "1966",
    proposition:
      "The Fifth Amendment requires that suspects be informed of their rights before custodial interrogation",
    contextInBrief:
      "The procedural safeguards established in Miranda v. Arizona, 384 U.S. 436 (1966), require law enforcement to advise suspects of their constitutional rights prior to any custodial interrogation.",
  },
  {
    id: "3",
    rawText: "Roe v. Wade, 410 U.S. 113 (1973)",
    caseName: "Roe v. Wade",
    citation: "410 U.S. 113",
    year: "1973",
    proposition:
      "The right to privacy under the Due Process Clause extends to personal autonomy decisions",
    contextInBrief:
      "The foundational privacy framework established in Roe v. Wade, 410 U.S. 113 (1973), recognized that the Due Process Clause of the Fourteenth Amendment encompasses a right to privacy that extends to deeply personal decisions.",
  },
  {
    id: "4",
    rawText: "Citizens United v. FEC, 558 U.S. 310 (2010)",
    caseName: "Citizens United v. Federal Election Commission",
    citation: "558 U.S. 310",
    year: "2010",
    proposition:
      "Individuals have a constitutional right to privacy in their political speech and associations",
    contextInBrief:
      "The Court in Citizens United v. FEC, 558 U.S. 310 (2010), established that individuals possess an inherent constitutional right to maintain privacy in their political speech and associations, free from government surveillance.",
  },
  {
    id: "5",
    rawText: "Henderson v. TechCorp Solutions, 847 F.3d 1092 (9th Cir. 2019)",
    caseName: "Henderson v. TechCorp Solutions",
    citation: "847 F.3d 1092",
    year: "2019",
    proposition:
      "Data controllers owe fiduciary duties to users whose personal information they collect and process",
    contextInBrief:
      "The Ninth Circuit in Henderson v. TechCorp Solutions, 847 F.3d 1092 (9th Cir. 2019), held that entities acting as data controllers owe fiduciary duties to the users whose personal information they collect, store, and process.",
  },
  {
    id: "6",
    rawText: "Brown v. Board of Education, 347 U.S. 483 (1954)",
    caseName: "Brown v. Board of Education",
    citation: "347 U.S. 483",
    year: "1954",
    proposition:
      "The Equal Protection Clause prohibits discriminatory treatment by state actors",
    contextInBrief:
      "As the Court established in Brown v. Board of Education, 347 U.S. 483 (1954), the Equal Protection Clause of the Fourteenth Amendment prohibits state actors from engaging in discriminatory treatment.",
  },
];

export const MOCK_RESULTS: VerificationResult[] = [
  {
    citation: MOCK_CITATIONS[0],
    status: "verified",
    midpageFound: true,
    caseName: "Carpenter v. United States",
    court: "Supreme Court of the United States",
    dateFiled: "2018-06-22",
    overallTreatment: "Positive",
    holdingMatch: true,
    holdingAnalysis:
      "The brief correctly states the holding of Carpenter. The Supreme Court held that accessing historical cell-site location information constitutes a search under the Fourth Amendment, generally requiring a warrant.",
    midpageOpinionId: "4716953",
    citations: [{ cited_as: "585 U.S. 296", volume: "585", reporter: "U.S.", page: "296" }],
  },
  {
    citation: MOCK_CITATIONS[1],
    status: "verified",
    midpageFound: true,
    caseName: "Miranda v. Arizona",
    court: "Supreme Court of the United States",
    dateFiled: "1966-06-13",
    overallTreatment: "Positive",
    holdingMatch: true,
    holdingAnalysis:
      "The brief accurately represents Miranda's core holding. The Court established that the prosecution may not use statements arising from custodial interrogation unless procedural safeguards were followed.",
    midpageOpinionId: "108497",
    citations: [{ cited_as: "384 U.S. 436", volume: "384", reporter: "U.S.", page: "436" }],
  },
  {
    citation: MOCK_CITATIONS[2],
    status: "warning",
    midpageFound: true,
    caseName: "Roe v. Wade",
    court: "Supreme Court of the United States",
    dateFiled: "1973-01-22",
    overallTreatment: "Negative",
    holdingMatch: true,
    holdingAnalysis:
      "While the brief correctly describes Roe's original holding on privacy rights, this case has NEGATIVE treatment — it was effectively overruled by Dobbs v. Jackson Women's Health Organization (2022). Citing this case as current authority is risky.",
    midpageOpinionId: "108713",
    citations: [{ cited_as: "410 U.S. 113", volume: "410", reporter: "U.S.", page: "113" }],
  },
  {
    citation: MOCK_CITATIONS[3],
    status: "warning",
    midpageFound: true,
    caseName: "Citizens United v. Federal Election Commission",
    court: "Supreme Court of the United States",
    dateFiled: "2010-01-21",
    overallTreatment: "Positive",
    holdingMatch: false,
    holdingAnalysis:
      "HOLDING MISMATCH: The brief claims this case established privacy rights in political speech. In reality, Citizens United held that the First Amendment prohibits government restrictions on independent political expenditures by corporations and unions. The case is about corporate political spending, not individual privacy.",
    midpageOpinionId: "1801",
    citations: [{ cited_as: "558 U.S. 310", volume: "558", reporter: "U.S.", page: "310" }],
  },
  {
    citation: MOCK_CITATIONS[4],
    status: "not_found",
    midpageFound: false,
    caseName: null,
    court: null,
    dateFiled: null,
    overallTreatment: null,
    holdingMatch: null,
    holdingAnalysis:
      "CASE NOT FOUND: No case matching 'Henderson v. TechCorp Solutions, 847 F.3d 1092' was found in any federal or state court database. This citation appears to be fabricated or hallucinated. This is exactly the kind of AI-generated citation that has led to sanctions in courts nationwide.",
    midpageOpinionId: null,
    citations: [],
  },
  {
    citation: MOCK_CITATIONS[5],
    status: "verified",
    midpageFound: true,
    caseName: "Brown v. Board of Education",
    court: "Supreme Court of the United States",
    dateFiled: "1954-05-17",
    overallTreatment: "Positive",
    holdingMatch: true,
    holdingAnalysis:
      "The brief correctly represents the core principle from Brown. The Court held that racial segregation in public schools violates the Equal Protection Clause, establishing a broader principle against discriminatory state action.",
    midpageOpinionId: "105711",
    citations: [{ cited_as: "347 U.S. 483", volume: "347", reporter: "U.S.", page: "483" }],
  },
];

export function buildMockReport(fileName: string): AnalysisReport {
  return {
    fileName,
    totalCitations: MOCK_RESULTS.length,
    verified: MOCK_RESULTS.filter((r) => r.status === "verified").length,
    warnings: MOCK_RESULTS.filter((r) => r.status === "warning").length,
    errors: MOCK_RESULTS.filter((r) => r.status === "error").length,
    notFound: MOCK_RESULTS.filter((r) => r.status === "not_found").length,
    results: MOCK_RESULTS,
    clauses: [],
    regulatoryAlerts: [],
    regulatoryTopics: [],
    analyzedAt: new Date().toISOString(),
  };
}

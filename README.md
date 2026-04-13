# BriefCase — Legal Intelligence, All in One Brief

[![Live Demo](https://img.shields.io/badge/Live%20Demo-briefcheck.vercel.app-2563EB?style=for-the-badge)](https://briefcheck.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![Claude](https://img.shields.io/badge/Claude-Sonnet%204.6-D97706?style=for-the-badge)](https://anthropic.com)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)

> Upload a legal brief and instantly verify every citation, analyze contract clauses across jurisdictions, and scan for relevant federal regulations — all in one shot.

---

## What It Does

Lawyers and legal professionals spend hours manually checking whether citations are real, still good law, and actually support the propositions claimed. BriefCase automates all of that.

**Three analyses run simultaneously the moment you upload a brief:**

### 1. Citation Verification
- Extracts every case law citation using Claude AI
- Verifies each against the **Midpage** case law database
- Flags hallucinated or fabricated citations (a growing problem with AI-assisted drafting)
- Checks citator treatment — is the case still good law, or has it been overruled?
- Analyzes whether the case actually supports the proposition the brief claims it does

### 2. Jurisdiction Analysis
- Auto-detects contract clauses (non-compete, arbitration, NDA, liability cap, non-solicitation)
- Checks enforceability across **California, Texas, New York, Delaware, and Florida**
- Powered by Claude with real statute and case law knowledge per state

### 3. Regulatory Radar
- Extracts legal topics from the brief
- Searches the **Federal Register** for recent rules, proposed rules, and notices
- Surfaces regulatory developments that could affect the matter — things that often get missed

---

## Live Demo

**[https://briefcheck.vercel.app](https://briefcheck.vercel.app)**

Upload a `.pdf`, `.docx`, or `.txt` brief — or paste text directly. Try the built-in demo brief to see all three analyses in action.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| AI / LLM | Anthropic Claude Sonnet 4.6 |
| Citation DB | Midpage API |
| PDF Parsing | LlamaIndex LlamaParse |
| Backup Citation DB | TrustFoundry |
| Regulatory Data | Federal Register REST API |
| Styling | Tailwind CSS v4 + CSS variables |
| Animations | Framer Motion |
| Deployment | Vercel |
| MCP Server | Model Context Protocol (Claude Desktop) |

---

## Project Structure

```
LawLLM/
├── briefcheck/              # Next.js web application
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/     # Main SSE analysis endpoint
│   │   │   ├── deposition/  # Deposition question generator
│   │   │   ├── gpt/         # OpenAI Custom GPT endpoints
│   │   │   │   ├── verify-citation/
│   │   │   │   ├── check-brief/
│   │   │   │   └── health/
│   │   │   ├── jurisdiction/
│   │   │   ├── regulatory/
│   │   │   └── sessions/
│   │   ├── privacy/         # Privacy policy page
│   │   └── page.tsx         # Main UI
│   ├── components/
│   │   ├── Dashboard.tsx    # Results dashboard
│   │   ├── CitationCard.tsx # Per-citation result card
│   │   ├── CitationReport.tsx
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx      # Session history
│   │   ├── UploadZone.tsx
│   │   ├── JurisdictionChecker.tsx
│   │   └── RegulatoryRadar.tsx
│   ├── lib/
│   │   ├── claude.ts        # Anthropic API client + holding analysis
│   │   ├── midpage.ts       # Midpage citation lookup
│   │   ├── jurisdiction.ts  # Clause extraction + jurisdiction analysis
│   │   ├── federal-register.ts
│   │   ├── llamaparse.ts
│   │   ├── trustfoundry.ts
│   │   └── types.ts
│   └── public/
│       └── openapi.json     # OpenAPI spec for Custom GPT
└── briefcheck-mcp/          # MCP server for Claude Desktop
    ├── index.ts             # verify_citation + check_brief tools
    └── dist/                # Compiled output
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- API keys (see below)

### Setup

```bash
# Clone
git clone https://github.com/vatsalajha/BriefCase.git
cd BriefCase/briefcheck

# Install
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...        # console.anthropic.com
MIDPAGE_API_KEY=ak_...              # app.midpage.ai
LLAMAPARSE_API_KEY=llx-...          # cloud.llamaindex.ai

# Optional
TRUSTFOUNDARY_API_KEY=api_...       # Backup citation database
USE_MOCK_DATA=false                 # Set true to use demo data (no API calls)
```

---

## API Reference

All endpoints accept and return JSON.

### Core Analysis

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/analyze` | Full brief analysis (SSE stream) |
| `POST` | `/api/jurisdiction` | Analyze a single contract clause |
| `POST` | `/api/regulatory` | Search Federal Register |
| `POST` | `/api/deposition` | Generate deposition question outline |

### GPT Integration (Public, CORS-enabled)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/gpt/health` | Health check |
| `POST` | `/api/gpt/verify-citation` | Verify a single citation |
| `POST` | `/api/gpt/check-brief` | Extract + verify all citations from text |

**Example:**
```bash
curl -X POST https://briefcheck.vercel.app/api/gpt/verify-citation \
  -H "Content-Type: application/json" \
  -d '{"citation": "384 U.S. 436"}'
```

---

## Claude Desktop MCP

BriefCase includes an MCP (Model Context Protocol) server that lets Claude Desktop verify citations directly in chat.

### Setup

```bash
cd briefcheck-mcp
npm install
npx tsc
```

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "briefcase": {
      "command": "node",
      "args": ["/path/to/LawLLM/briefcheck-mcp/dist/index.js"],
      "env": {
        "MIDPAGE_API_KEY": "your-key-here"
      }
    }
  }
}
```

Restart Claude Desktop. Then in any chat:
> *"Verify the citation 410 U.S. 113"*

### Available MCP Tools

| Tool | Description |
|---|---|
| `verify_citation` | Look up a single citation in Midpage |
| `check_brief` | Extract and verify all citations from pasted text |

---

## Custom GPT (ChatGPT Integration)

BriefCase can be used as a ChatGPT Custom GPT Action.

- **OpenAPI Spec:** [https://briefcheck.vercel.app/openapi.json](https://briefcheck.vercel.app/openapi.json)
- **Privacy Policy:** [https://briefcheck.vercel.app/privacy](https://briefcheck.vercel.app/privacy)

In the GPT builder, add a new Action and import the schema from the URL above.

---

## How the Analysis Works

```
User uploads brief
        ↓
LlamaParse (PDF) / mammoth (DOCX) / plain text
        ↓
Text normalization (fix PDF line-breaks, strip markdown)
        ↓
┌─────────────────────────────────────────────────────┐
│  Claude extracts citations    Claude extracts clauses│
│         ↓                              ↓            │
│  Midpage lookup (+ TrustFoundry   Claude jurisdiction│
│  fallback if not found)           analysis × 5 states│
│         ↓                              ↓            │
│  Claude holding analysis      Federal Register search│
│  (or knowledge fallback if    (topic extraction →    │
│  no opinion text available)    API search)           │
└─────────────────────────────────────────────────────┘
        ↓
SSE stream → live UI updates → final report
```

---

## Built For

**LLM × Law Hackathon 2025**

Powered by [Midpage](https://midpage.ai) · [Claude by Anthropic](https://anthropic.com) · [LlamaParse](https://cloud.llamaindex.ai) · [Federal Register API](https://www.federalregister.gov/reader-aids/developer-resources/rest-api)

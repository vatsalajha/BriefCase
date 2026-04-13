# BriefCheck MCP Server

Exposes BriefCheck citation verification as an MCP tool for Claude Desktop and Claude.ai.

## Tools

| Tool | Description |
|------|-------------|
| `verify_citation` | Verify a single citation (e.g. `"410 U.S. 113"`) against Midpage |
| `check_brief` | Extract and verify all citations from a full brief text |

## Setup

### 1. Install and build

```bash
cd briefcheck-mcp
npm install
npm run build
```

### 2. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "briefcheck": {
      "command": "node",
      "args": ["/absolute/path/to/briefcheck-mcp/dist/index.js"],
      "env": {
        "MIDPAGE_API_KEY": "your_midpage_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. You should see "BriefCheck" in the tools panel.

### 3. Test it

Ask Claude:

> "Is 410 U.S. 113 still good law?"

> "Check the citations in this brief: [paste brief text]"

Claude will automatically call `verify_citation` or `check_brief` and show the results inline.

## Example output

**verify_citation:**
```
✅ CITATION VERIFIED

Case:       Carpenter v. United States
Citation:   585 U.S. 296
Court:      U.S. Supreme Court
Date Filed: 2018-06-22
Treatment:  ✅ Positive
```

**check_brief:**
```
BRIEFCHECK CITATION REPORT
==================================================
Found 4 unique citations. 3 verified · 1 not found

✅ 410 U.S. 113
   Case: Roe v. Wade | Court: U.S. Supreme Court | Treatment: Negative ⚠️

❌ 847 F.3d 1092
   NOT FOUND — possible hallucination or formatting error
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MIDPAGE_API_KEY` | ✅ | Your Midpage API key — get it at app.midpage.ai |

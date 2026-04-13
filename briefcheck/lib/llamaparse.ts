import { LlamaParseReader } from "@llamaindex/cloud/reader";
import * as pdfParseModule from "pdf-parse";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;

/**
 * Parse a PDF buffer using LlamaParse for high-quality structured extraction.
 * Falls back to pdf-parse if LlamaParse is unavailable or fails.
 */
export async function parsePDFWithLlama(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const apiKey = process.env.LLAMAPARSE_API_KEY;

  if (!apiKey) {
    console.warn("[llamaparse] LLAMAPARSE_API_KEY not set — using pdf-parse fallback");
    return pdfParseFallback(buffer);
  }

  try {
    console.log(`[llamaparse] parsing "${fileName}" via LlamaParse`);
    const reader = new LlamaParseReader({
      apiKey,
      resultType: "markdown",
      verbose: false,
      // Instruction tailored for legal briefs
      parsingInstruction:
        "This is a legal brief or court document. Preserve all case citations exactly as written, including reporter format (e.g. '410 U.S. 113'). Preserve section headings, footnotes, and quoted text.",
    });

    // loadDataAsContent avoids writing a temp file — pass buffer directly
    const documents = await reader.loadDataAsContent(buffer, fileName);
    const text = documents.map((d) => d.text).join("\n\n");

    if (!text.trim()) {
      console.warn("[llamaparse] empty result — falling back to pdf-parse");
      return pdfParseFallback(buffer);
    }

    console.log(`[llamaparse] success — ${text.length} chars extracted`);
    return text;
  } catch (err) {
    console.error("[llamaparse] error — falling back to pdf-parse:", err);
    return pdfParseFallback(buffer);
  }
}

async function pdfParseFallback(buffer: Buffer): Promise<string> {
  const result = await pdfParse(buffer);
  return result.text as string;
}

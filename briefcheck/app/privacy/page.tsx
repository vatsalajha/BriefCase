export default function PrivacyPolicy() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "Georgia, serif", color: "#1A1A1A" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#6B6356", marginBottom: 32, fontSize: "0.9rem" }}>Last updated: April 2025</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>Overview</h2>
        <p style={{ lineHeight: 1.7, color: "#333" }}>
          BriefCase is a legal citation verification tool. This policy explains what data we
          handle when you use the service, including through the BriefCase Custom GPT.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>Data We Process</h2>
        <p style={{ lineHeight: 1.7, color: "#333" }}>
          When you submit a legal brief or citation for analysis, the text is sent to:
        </p>
        <ul style={{ lineHeight: 2, paddingLeft: 24, color: "#333" }}>
          <li><strong>Anthropic (Claude)</strong> — to extract citations and analyze holdings</li>
          <li><strong>Midpage</strong> — to verify citations against their case law database</li>
          <li><strong>LlamaIndex LlamaParse</strong> — to parse PDF documents (PDF uploads only)</li>
          <li><strong>Federal Register API</strong> — to search for relevant regulations (public API, no data sent)</li>
        </ul>
        <p style={{ lineHeight: 1.7, color: "#333", marginTop: 12 }}>
          We do not store the content of your briefs or documents on our servers beyond the duration
          of a single analysis session. Session data (citation results) is held in memory and cleared
          when the session ends.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>What We Do Not Do</h2>
        <ul style={{ lineHeight: 2, paddingLeft: 24, color: "#333" }}>
          <li>We do not sell your data to third parties</li>
          <li>We do not use your brief content to train AI models</li>
          <li>We do not require account creation or collect personal information</li>
          <li>We do not set tracking cookies</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>Custom GPT Usage</h2>
        <p style={{ lineHeight: 1.7, color: "#333" }}>
          When you use BriefCase through the ChatGPT Custom GPT integration, citation text you
          provide is sent to the BriefCase API (hosted on Vercel) solely to perform verification.
          No conversation history or personal data from ChatGPT is accessed or stored by BriefCase.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>Third-Party Services</h2>
        <p style={{ lineHeight: 1.7, color: "#333" }}>
          This service is hosted on <strong>Vercel</strong>. Vercel may collect standard server
          logs (IP addresses, request metadata) as part of their infrastructure. See{" "}
          <a href="https://vercel.com/legal/privacy-policy" style={{ color: "#2563EB" }}>
            Vercel&apos;s Privacy Policy
          </a>{" "}
          for details.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: 8 }}>Contact</h2>
        <p style={{ lineHeight: 1.7, color: "#333" }}>
          For questions about this privacy policy, contact the project maintainer via{" "}
          <a href="https://github.com/vatsalajha/BriefCase" style={{ color: "#2563EB" }}>
            GitHub
          </a>.
        </p>
      </section>

      <p style={{ fontSize: "0.8rem", color: "#9C9488", borderTop: "1px solid #E2DCD0", paddingTop: 24 }}>
        BriefCase — Legal Intelligence, All in One Brief.
      </p>
    </div>
  );
}

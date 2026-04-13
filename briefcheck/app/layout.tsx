import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BriefCase — Citation Verification for Legal Professionals",
  description:
    "Upload a legal brief and instantly verify every case citation against real case law. Catch hallucinations before they catch you.",
  openGraph: {
    title: "BriefCase — Citation Verification for Legal Professionals",
    description:
      "Upload a legal brief and instantly verify every case citation against real case law. Catch hallucinations before they catch you.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

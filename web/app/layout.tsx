import type { Metadata } from "next";
import { Bricolage_Grotesque, Courier_Prime, IBM_Plex_Sans } from "next/font/google";
import { AuthProvider } from "@/components/providers/AuthProvider";
import "./globals.css";

/**
 * The Writer's Room type trio:
 * - Bricolage Grotesque — expressive display face for headlines.
 * - IBM Plex Sans — clean, readable body/UI text (and a nod to IBM).
 * - Courier Prime — the screenplay monospace, for script/sequence labels.
 */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const script = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: "The Writers' Room",
  description:
    "An AI agent crew that debates, disagrees, and pitches your story on a spatial canvas — powered by IBM Granite on watsonx.ai. Your AI crew argues; you direct.",
  openGraph: {
    title: "The Writers' Room",
    description:
      "Your AI crew argues; you direct. A spatial canvas where seven specialist agents draft, critique, and revise your story — powered by IBM Granite.",
    siteName: "The Writers' Room",
    type: "website",
    // SVG is hand-authored so the build never depends on the network. Strict
    // social scrapers (Twitter/LinkedIn/Facebook) sometimes prefer a raster
    // image; if a card renders blank, convert public/banner.svg to a PNG once
    // and point images[] at it. The SVG is the file you drop into the BeMyApp
    // gallery banner slot directly.
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "The Writers' Room — your AI crew argues, you direct." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Writers' Room",
    description:
      "Your AI crew argues; you direct. A spatial canvas where seven specialist agents draft, critique, and revise your story — powered by IBM Granite.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${display.variable} ${sans.variable} ${script.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

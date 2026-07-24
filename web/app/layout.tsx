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
  title: "The Writers' Room",
  description:
    "An AI agent crew that debates, disagrees, and pitches creative directions — powered by IBM Granite.",
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

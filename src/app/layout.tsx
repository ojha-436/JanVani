import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, Noto_Sans_Devanagari } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

// Display: characterful editorial serif → civic trust.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
});

// Body: warm, highly legible grotesque → accessibility.
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

// Hindi / Devanagari coverage.
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JanVaani — Your area's voice, mapped and acted on",
  description:
    "A multilingual civic platform. Citizens speak, type, or photograph what their area needs; JanVaani turns thousands of voices into a ranked, evidence-backed plan MPs can act on.",
  keywords: ["civic tech", "development", "MP", "citizen voice", "India", "grievance", "multilingual"],
  openGraph: {
    title: "JanVaani — Citizen voice, measured and mapped",
    description: "Turn thousands of citizen voices into a ranked, evidence-backed development plan.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#16221d",
  width: "device-width",
  initialScale: 1,
};

// Runs before paint so a saved dark preference never flashes light.
// Kept dependency-free and inline: it must execute before hydration.
const themeInitScript = `(function(){try{var p=localStorage.getItem("janvaani.theme");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable} ${notoDevanagari.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--color-ink)] focus:px-4 focus:py-2 focus:text-[var(--color-paper)]"
        >
          Skip to content
        </a>
        <ThemeProvider>
          <I18nProvider>
            <SessionProvider>{children}</SessionProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PRAMANA — AI Image Authenticity Verifier",
  description:
    "Open-protocol, on-chain verdicts for AI-generated image authenticity. Non-commercial research prototype on Base Sepolia testnet.",
  keywords: ["AI image detection", "authenticity", "blockchain", "EAS", "Base Sepolia", "open source"],
  robots: "index,follow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className={cn("min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-slate-50 font-sans")}>
        {/* Nav */}
        <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
          <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link href="/" className="flex items-center gap-2.5 font-semibold text-slate-900">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white text-sm font-bold">
                P
              </div>
              <span className="text-lg tracking-tight">PRAMANA</span>
              <span className="hidden sm:inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                testnet · research prototype
              </span>
            </Link>
            <div className="flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="/" className="hover:text-slate-900 transition-colors">
                Verify
              </Link>
              <Link href="/models" className="hover:text-slate-900 transition-colors">
                Models
              </Link>
              <Link href="/canary" className="hover:text-slate-900 transition-colors">
                Canaries
              </Link>
              <Link href="/attesters" className="hover:text-slate-900 transition-colors">
                Attesters
              </Link>
              <Link href="/limitations" className="hover:text-slate-900 transition-colors">
                Limitations
              </Link>
              <a
                href="https://github.com/sahilll05/PRAMANA"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-900 transition-colors"
              >
                GitHub ↗
              </a>
            </div>
          </nav>
        </header>

        {/* Mandatory disclaimer banner */}
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">
          <strong>Research prototype</strong> · AI-generated image analysis only · Base Sepolia testnet (non-commercial) ·{" "}
          <Link href="/limitations" className="underline underline-offset-2 hover:text-amber-900">
            See all limitations →
          </Link>
        </div>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>

        <footer className="mt-20 border-t border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
          <p className="max-w-2xl mx-auto">
            PRAMANA is a non-commercial research prototype. Verdicts represent model-assessed likelihoods,
            not rulings. MVP covers still images only. All data stays in your browser.{" "}
            <Link href="/limitations" className="underline hover:text-slate-700">
              Full limitations →
            </Link>
          </p>
          <p className="mt-3 text-xs text-slate-400">
            Base Sepolia testnet · CC-BY-NC-SA-4.0 · Zero-spend project · v0.1.0-draft
          </p>
        </footer>
      </body>
    </html>
  );
}

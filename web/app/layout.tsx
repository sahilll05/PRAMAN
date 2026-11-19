import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "PRAMANA — AI Image Authenticity Verifier",
  description:
    "Open-protocol, on-chain verdicts for AI-generated image authenticity. Non-commercial research prototype on Base Sepolia testnet.",
  keywords: ["AI image detection", "authenticity", "blockchain", "EAS", "Base Sepolia", "open source"],
  robots: "index,follow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('pramana-theme');
                if (stored === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-brand-500/20 selection:text-brand-400 transition-colors duration-200 relative">
        {/* Ambient background glow mesh */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          <div className="absolute -top-[300px] left-1/2 -translate-x-1/2 w-[900px] h-[550px] bg-gradient-to-br from-sky-500/10 via-brand-600/10 to-indigo-600/10 dark:from-sky-500/15 dark:via-brand-600/15 dark:to-indigo-600/15 blur-[120px] rounded-full" />
          <div className="absolute top-[60%] -left-[200px] w-[500px] h-[400px] bg-sky-500/5 dark:bg-sky-500/10 blur-[100px] rounded-full" />
          <div className="absolute top-[80%] -right-[200px] w-[500px] h-[400px] bg-brand-500/5 dark:bg-brand-500/10 blur-[100px] rounded-full" />
        </div>

        {/* Global Navbar */}
        <Navbar />

        {/* Mandatory Research Prototype Banner */}
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-300 backdrop-blur-sm">
          <div className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>Research prototype</span>
            <span className="opacity-60">·</span>
            <span>AI-generated image analysis only</span>
            <span className="opacity-60">·</span>
            <span>Base Sepolia testnet</span>
            <span className="opacity-60">·</span>
            <Link href="/limitations" className="underline underline-offset-2 hover:text-amber-600 dark:hover:text-amber-200">
              See all limitations →
            </Link>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 min-h-[calc(100vh-280px)]">
          {children}
        </main>

        {/* Global Footer */}
        <Footer />
      </body>
    </html>
  );
}

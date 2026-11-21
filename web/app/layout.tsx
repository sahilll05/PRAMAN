import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "PRAMAN — AI Image Authenticity Verifier",
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
                const stored = localStorage.getItem('praman-theme') || localStorage.getItem('pramana-theme');
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
      <body className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800 selection:text-zinc-900 dark:selection:text-zinc-100 transition-colors duration-150 relative">
        {/* Global Navbar */}
        <Navbar />

        {/* Minimal Research Prototype Disclosure Banner */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 px-4 py-1.5 text-center text-xs text-zinc-600 dark:text-zinc-400">
          <div className="inline-flex items-center gap-1.5 font-normal">
            <AlertTriangle className="h-3 w-3 text-zinc-500" />
            <span>Research prototype</span>
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
            <span>Still image analysis only</span>
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
            <span>Base Sepolia testnet</span>
            <span className="text-zinc-400 dark:text-zinc-600">/</span>
            <Link href="/limitations" className="underline underline-offset-2 hover:text-zinc-950 dark:hover:text-zinc-100">
              Limitations
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

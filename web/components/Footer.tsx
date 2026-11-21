import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-colors">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Brand & Sanskrit Bio */}
          <div className="space-y-4 md:col-span-2">
            <Logo showSubtitle={true} />
            <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md leading-relaxed">
              In classical epistemology, <strong className="text-zinc-900 dark:text-zinc-200 font-sanskrit font-medium">प्रमाण</strong> (<em>Pramāṇa</em>) signifies the means and standard of valid knowledge. PRAMAN anchors model-assessed AI image verdicts onto Base Sepolia via Ethereum Attestation Service (EAS).
            </p>
            <div className="inline-flex items-center gap-2 rounded-md bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 font-mono">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Base Sepolia Testnet · Non-Commercial Research
            </div>
          </div>

          {/* Column 2: Protocol & Verification */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Protocol & Verification
            </h4>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li>
                <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  In-Browser Verifier
                </Link>
              </li>
              <li>
                <Link href="/models" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  Registered Models
                </Link>
              </li>
              <li>
                <Link href="/canary" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  Canary Health Stream
                </Link>
              </li>
              <li>
                <Link href="/attesters" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  Allowlisted Attesters
                </Link>
              </li>
              <li>
                <Link href="/limitations" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                  System Limitations & Scope
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Open Source & Code */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Architecture & Research
            </h4>
            <ul className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
              <li>
                <a
                  href="https://github.com/sahilll05/PRAMAN"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                  GitHub Repository <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span className="font-mono">Specification: v0.1.0-draft</span>
              </li>
              <li>
                <span className="font-mono">EAS Schemas: Verdict & Challenge</span>
              </li>
              <li>
                <span className="font-mono">License: CC-BY-NC-SA-4.0</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Banner with Made by Sahil Powar */}
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-0.5">
            <p>
              Media never leaves your browser. Evaluated models represent calibrated statistical likelihoods, not infallible rulings.
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              © {new Date().getFullYear()} PRAMAN Protocol. All rights reserved.
            </p>
          </div>

          {/* Creator Attribution Badge — Minimal, Crisp */}
          <div className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-3.5 py-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <span className="text-zinc-400 dark:text-zinc-500">Made by</span>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">Sahil Powar</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

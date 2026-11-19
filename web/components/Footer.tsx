import Link from "next/link";
import { Shield, GitBranch, Terminal, ExternalLink, Heart, Sparkles } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-slate-200/80 bg-white/50 dark:border-slate-800/80 dark:bg-slate-950/50 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Brand & Bio */}
          <div className="space-y-4 md:col-span-2">
            <Logo showSubtitle={true} />
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              PRAMANA is an open, decentralized authenticity verification protocol anchoring model-assessed AI image verdicts onto Base Sepolia via Ethereum Attestation Service (EAS).
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Base Sepolia Testnet · Zero-Spend Research Prototype
            </div>
          </div>

          {/* Column 2: Protocol & Network */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Protocol & Verification
            </h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  In-Browser Verifier
                </Link>
              </li>
              <li>
                <Link href="/models" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  Registered Models
                </Link>
              </li>
              <li>
                <Link href="/canary" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  Canary Health Stream
                </Link>
              </li>
              <li>
                <Link href="/attesters" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  Allowlisted Attesters
                </Link>
              </li>
              <li>
                <Link href="/limitations" className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                  System Limitations & Scope
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Open Source & Code */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200">
              Developers & Architecture
            </h4>
            <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
              <li>
                <a
                  href="https://github.com/sahilll05/PRAMANA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
                >
                  GitHub Repository <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span className="text-xs font-mono text-slate-400">Spec v0.1.0-draft</span>
              </li>
              <li>
                <span className="text-xs font-mono text-slate-400">EAS Schemas: Verdict & Challenge</span>
              </li>
              <li>
                <span className="text-xs font-mono text-slate-400">CC-BY-NC-SA-4.0 License</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Banner with Made by Sahil Powar */}
        <div className="pt-8 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
            <p>
              Media never leaves your browser. Evaluated models represent calibrated statistical likelihoods, not infallible rulings.
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-400">
              © {new Date().getFullYear()} PRAMANA Protocol. Non-commercial open research.
            </p>
          </div>

          {/* Creator Attribution Badge */}
          <div className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500/10 via-brand-500/10 to-indigo-500/10 dark:from-sky-900/30 dark:via-brand-900/30 dark:to-indigo-900/30 border border-brand-500/20 dark:border-brand-400/20 px-4 py-2 shadow-sm">
            <span className="text-xs text-slate-600 dark:text-slate-300">Made by</span>
            <span className="text-xs font-bold bg-gradient-to-r from-brand-600 via-sky-500 to-indigo-600 dark:from-brand-400 dark:via-sky-300 dark:to-indigo-300 bg-clip-text text-transparent">
              Sahil Powar
            </span>
            <Sparkles className="h-3.5 w-3.5 text-brand-500 dark:text-brand-400" />
          </div>
        </div>
      </div>
    </footer>
  );
}

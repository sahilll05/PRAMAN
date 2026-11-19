import Link from "next/link";

interface LogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export function Logo({ className = "", showSubtitle = true }: LogoProps) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-3 select-none ${className}`}>
      {/* Cryptographic Prism Emblem */}
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 via-brand-600 to-indigo-700 p-0.5 shadow-md shadow-brand-500/20 transition-transform duration-200 group-hover:scale-105">
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full rounded-[10px] bg-slate-950/40 p-1.5 backdrop-blur-sm"
        >
          {/* Hexagonal prism lattice */}
          <path
            d="M16 3L27.2583 9.5V22.5L16 29L4.74167 22.5V9.5L16 3Z"
            stroke="url(#pramana-stroke)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Inner refractive prism triangles */}
          <path
            d="M16 3V16M27.2583 22.5L16 16M4.74167 22.5L16 16"
            stroke="url(#pramana-inner)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Center core pulse */}
          <circle cx="16" cy="16" r="3" fill="#38BDF8" className="animate-pulse" />
          <defs>
            <linearGradient id="pramana-stroke" x1="4" y1="3" x2="28" y2="29" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="0.5" stopColor="#0EA5E9" />
              <stop offset="1" stopColor="#818CF8" />
            </linearGradient>
            <linearGradient id="pramana-inner" x1="16" y1="3" x2="16" y2="22.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7DD3FC" stopOpacity="0.8" />
              <stop offset="1" stopColor="#38BDF8" stopOpacity="0.3" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Typography */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-tight text-xl text-slate-900 dark:text-white">
            PRAMANA
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-brand-500/10 dark:bg-brand-400/10 border border-brand-500/20 dark:border-brand-400/20 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-300">
            v0.1.0-draft
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-400 uppercase">
            Verifiable Media Protocol
          </span>
        )}
      </div>
    </Link>
  );
}

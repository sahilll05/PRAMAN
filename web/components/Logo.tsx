import Link from "next/link";

interface LogoProps {
  className?: string;
  showSubtitle?: boolean;
}

export function Logo({ className = "", showSubtitle = true }: LogoProps) {
  return (
    <Link
      href="/"
      className={`group inline-flex items-center gap-3 select-none transition-opacity hover:opacity-90 ${className}`}
    >
      {/* Minimal Architectural Vector Emblem — The Lens of Pramāṇa (Means of Knowledge) */}
      <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-100 transition-colors">
        <svg
          viewBox="0 0 28 28"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          aria-hidden="true"
        >
          {/* Outer circle of measure */}
          <circle
            cx="14"
            cy="14"
            r="11"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* Horizontal verification axis */}
          <line
            x1="5"
            y1="14"
            x2="23"
            y2="14"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="1.5 2"
          />
          {/* Vertical plumb line */}
          <line
            x1="14"
            y1="5"
            x2="14"
            y2="23"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="1.5 2"
          />
          {/* Inner concentric focal lens of ground truth */}
          <circle
            cx="14"
            cy="14"
            r="4.5"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          {/* Central singular point of truth */}
          <circle cx="14" cy="14" r="1.5" fill="currentColor" />
        </svg>
      </div>

      {/* Typography with Sanskrit name प्रमाण */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-base text-zinc-900 dark:text-zinc-100 font-sans">
            PRAMAN
          </span>
          <span className="text-zinc-400 dark:text-zinc-600 font-light text-sm">/</span>
          <span
            className="font-sanskrit text-base font-semibold tracking-wide text-zinc-700 dark:text-zinc-300"
            title="Sanskrit: प्रमाण (Pramāṇa — Means of Valid Knowledge)"
          >
            प्रमाण
          </span>
          <span className="hidden sm:inline-flex items-center rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            v0.1.0-draft
          </span>
        </div>
        {showSubtitle && (
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono tracking-tight">
            Verifiable Media Protocol
          </span>
        )}
      </div>
    </Link>
  );
}

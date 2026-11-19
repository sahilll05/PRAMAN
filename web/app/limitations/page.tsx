import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle, Info, Shield, ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Limitations | PRAMANA",
  description: "Mandatory limitations and caveats for the PRAMANA AI image authenticity prototype.",
};

export default function LimitationsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-10 py-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 text-xs font-mono text-zinc-700 dark:text-zinc-300">
          <AlertTriangle className="h-3.5 w-3.5 text-zinc-500" />
          Mandatory disclosure before relying on any verdict
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          System Limitations & Scope
        </h1>
        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
          PRAMANA is an open research prototype. The following limitations are real and must be understood
          before interpreting any output.
        </p>
      </div>

      {/* Core limitations grid */}
      <div className="grid grid-cols-1 gap-3.5">
        {LIMITATIONS.map((lim) => (
          <LimitationCard key={lim.title} {...lim} />
        ))}
      </div>

      {/* Allowed and forbidden wording */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-6 sm:p-7 space-y-5">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Shield className="h-4 w-4 text-zinc-700 dark:text-zinc-300" />
            Permitted vs. Forbidden Communication Wording
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Strict epistemic integrity standards enforced across all reports and claims.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4 space-y-2.5">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 uppercase font-mono">
              <CheckCircle2 className="h-3.5 w-3.5" /> Permitted Wording
            </p>
            <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              {ALLOWED.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 p-4 space-y-2.5">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 uppercase font-mono">
              <XCircle className="h-3.5 w-3.5" /> Forbidden Wording
            </p>
            <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              {FORBIDDEN.map((w) => (
                <li key={w} className="flex gap-2">
                  <span className="text-rose-600 font-bold">✕</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Experiment citations */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/40 dark:bg-zinc-900/30 p-6 space-y-3">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-zinc-500" /> Key Measured Quantities (from internal experiments)
        </p>
        <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 leading-relaxed font-mono">
          <li>• In-domain AUC: 0.9891 (Model A), 0.9957 (Model B) — E1</li>
          <li>• Generator-disjoint AUC: 1.0000 (Model A) — E2</li>
          <li>• Cross-dataset recall on OpenFake Core (Flux, DALL·E 3, SD3.5): 83.9% / 90.8% — E2b</li>
          <li>• In-the-wild AUC (OpenFake reddit): 0.8571 — E2c (significant domain shift)</li>
          <li>• Calibrated ECE: 0.0399 (Model A), 0.0163 (Model B) — E1/T2.1</li>
          <li>• CPU-CPU determinism: 0 bps diff, 0.0% verdict mismatch — E5</li>
          <li>• CPU-GPU agreement: max 20 bps, mean 3.0 bps — E5b</li>
          <li>• Shortcut audit: metadata AUC 1.0 on raw format; equalized AUC ≥0.98 — E13</li>
        </ul>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-1">
          Source: internal experiments on CommunityForensics-Small + OpenFake datasets (CC-BY-NC-SA-4.0 / CC-BY-NC-4.0).
        </p>
      </div>

      <div className="text-center pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white px-5 py-2.5 text-xs font-semibold shadow-sm transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Verifier
        </Link>
      </div>
    </div>
  );
}

function LimitationCard({
  severity,
  title,
  body,
}: {
  severity: "high" | "medium" | "info";
  title: string;
  body: string;
}) {
  const styles = {
    high: {
      border: "border-rose-500/20 bg-rose-500/5",
      icon: <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />,
    },
    medium: {
      border: "border-amber-500/20 bg-amber-500/5",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />,
    },
    info: {
      border: "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50",
      icon: <Info className="h-4 w-4 text-zinc-500 flex-shrink-0 mt-0.5" />,
    },
  };
  const s = styles[severity];
  return (
    <div className={`rounded-xl border ${s.border} p-4 sm:p-5 flex gap-3.5 transition-colors`}>
      {s.icon}
      <div>
        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{title}</p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

const LIMITATIONS = [
  {
    severity: "high" as const,
    title: "Not a ruling — model-assessed likelihood only",
    body: "PRAMANA outputs a calibrated probability that an image is AI-generated. This is not a legal, journalistic, or authoritative ruling. Detectors can and do make mistakes. A 'LIKELY SYNTHETIC' label does not prove an image is fake.",
  },
  {
    severity: "high" as const,
    title: "MVP covers still images only",
    body: "This prototype analyzes JPEG, PNG, WebP and similar still images. Face-swap video deepfakes (e.g., FaceForensics++) are explicitly NOT supported. No audio, GAN-generated video, or face-crop analysis is performed.",
  },
  {
    severity: "high" as const,
    title: "Testnet only — Base Sepolia (non-commercial)",
    body: "All on-chain attestations live on the Base Sepolia testnet. This is a zero-spend, non-commercial research prototype. Attestations have no monetary value. Mainnet deployment is out of scope.",
  },
  {
    severity: "medium" as const,
    title: "Detectors degrade over time",
    body: "AI image generators improve rapidly. Detectors trained on current generators will degrade when new architectures emerge. PRAMANA uses canary tests (AUC/ECE on fresh batches) to detect degradation and flip verdicts to 'STALE'. Canary frequency and freshness are maintainer-controlled in v1.",
  },
  {
    severity: "medium" as const,
    title: "Centralized attester allowlist (v1)",
    body: "In v1, attesters are added by the contract owner (allowlist). This is a centralization trust assumption. Open bonded attester registration is a stretch goal. The challenge flow provides partial accountability but cannot replace open registration.",
  },
  {
    severity: "medium" as const,
    title: "Cross-dataset generalization is limited",
    body: "In-domain AUC is 0.99+ but cross-dataset recall on new generators (OpenFake Core) drops to 83.9%–90.8%. In-the-wild (OpenFake reddit) AUC is 0.8571. Performance on novel generators is uncertain.",
  },
  {
    severity: "medium" as const,
    title: "Shortcut audit (E13) disclosed",
    body: "Metadata features alone (file size, JPEG quality, EXIF) predict the raw training label with AUC 1.0. Under equalization (224×224 bicubic + JPEG Q85), the detector retains AUC ≥0.98 (semantic signal persists). Raw-format metrics should not be cited without disclosing this.",
  },
  {
    severity: "info" as const,
    title: "Canaries are maintainer-run in v1",
    body: "Canary evaluation batches (fresh locally-generated images used to monitor AUC/ECE) are created and submitted by the maintainer. This introduces a trust assumption. Future versions will allow community canary submission with commit-reveal.",
  },
  {
    severity: "info" as const,
    title: "Datasets have non-commercial licenses",
    body: "Models are trained on CommunityForensics-Small (CC-BY-NC-SA-4.0) and OpenFake (CC-BY-NC-4.0). Trained model weights may not be commercially redistributable. Consult the dataset cards before publishing weights.",
  },
  {
    severity: "info" as const,
    title: "Media never leaves your browser",
    body: "The PRAMANA web verifier computes SHA-256 and pHash locally using WebAssembly (hash-wasm). Image bytes are never uploaded. Only the computed fingerprints (hashes) are compared against on-chain records.",
  },
];

const ALLOWED = [
  '"model-assessed likelihood of synthetic origin"',
  '"calibrated P(synthetic) = X%"',
  '"in-domain AUC 0.9891 (Model A, E1)"',
  '"CPU ONNX fp32 canonical path"',
  '"Base Sepolia testnet (non-commercial)"',
  '"verdict may be superseded or challenged"',
];

const FORBIDDEN = [
  '"detects deepfakes with X% accuracy"',
  '"state-of-the-art"',
  '"trustless"',
  '"proves authenticity"',
  '"tamper-proof verdicts" (use: tamper-evident)',
  '"production-ready"',
  '"detects video deepfakes" (MVP: images only)',
  '"mainnet deployment"',
];

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, XCircle, Info, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "Limitations | PRAMANA",
  description: "Mandatory limitations and caveats for the PRAMANA AI image authenticity prototype.",
};

export default function LimitationsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10 py-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 border border-amber-200 px-4 py-1.5 text-sm font-medium text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          Required reading before relying on any verdict
        </div>
        <h1 className="text-4xl font-bold text-slate-900">Limitations</h1>
        <p className="text-lg text-slate-600">
          PRAMANA is an open research prototype. The following limitations are real and must be understood
          before interpreting any output.
        </p>
      </div>

      {/* Core limitations grid */}
      <div className="grid grid-cols-1 gap-5">
        {LIMITATIONS.map((lim) => (
          <LimitationCard key={lim.title} {...lim} />
        ))}
      </div>

      {/* Allowed wording */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Shield className="h-5 w-5 text-brand-600" />
          Permitted and forbidden wording
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-semibold text-green-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Permitted
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {ALLOWED.map((w) => <li key={w} className="flex gap-2"><span className="text-green-500">✓</span>{w}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1.5">
              <XCircle className="h-4 w-4" /> Forbidden
            </p>
            <ul className="space-y-1.5 text-sm text-slate-600">
              {FORBIDDEN.map((w) => <li key={w} className="flex gap-2"><span className="text-red-500">✕</span>{w}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* Experiment citations */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-4 space-y-2">
        <p className="font-semibold text-brand-900 flex items-center gap-2">
          <Info className="h-4 w-4" /> Key measurements (from internal experiments)
        </p>
        <ul className="text-sm text-brand-800 space-y-1">
          <li>• In-domain AUC: 0.9891 (Model A), 0.9957 (Model B) — E1</li>
          <li>• Generator-disjoint AUC: 1.0000 (Model A) — E2</li>
          <li>• Cross-dataset recall on OpenFake Core (Flux, DALL·E 3, SD3.5): 83.9% / 90.8% — E2b</li>
          <li>• In-the-wild AUC (OpenFake reddit): 0.8571 — E2c (significant domain shift)</li>
          <li>• Calibrated ECE: 0.0399 (Model A), 0.0163 (Model B) — E1/T2.1</li>
          <li>• CPU-CPU determinism: 0 bps diff, 0.0% verdict mismatch — E5</li>
          <li>• CPU-GPU agreement: max 20 bps, mean 3.0 bps — E5b</li>
          <li>• Shortcut audit: metadata AUC 1.0 on raw format; equalized AUC ≥0.98 — E13</li>
        </ul>
        <p className="text-xs text-brand-700">Source: internal experiments on CommunityForensics-Small + OpenFake datasets (CC-BY-NC-SA-4.0 / CC-BY-NC-4.0).</p>
      </div>

      <div className="text-center pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          Back to verifier
        </Link>
      </div>
    </div>
  );
}

function LimitationCard({ severity, title, body }: { severity: "high" | "medium" | "info"; title: string; body: string }) {
  const styles = {
    high: { border: "border-red-200", bg: "bg-red-50", icon: <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" /> },
    medium: { border: "border-amber-200", bg: "bg-amber-50", icon: <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" /> },
    info: { border: "border-slate-200", bg: "bg-white", icon: <Info className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" /> },
  };
  const s = styles[severity];
  return (
    <div className={`rounded-xl border ${s.border} ${s.bg} p-5 flex gap-3`}>
      {s.icon}
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-600 mt-1 leading-relaxed">{body}</p>
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

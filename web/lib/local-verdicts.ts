export interface StoredVerdict {
  uid: string;
  verdict: number; // 0=ABSTAIN, 1=LIKELY_AUTHENTIC, 2=LIKELY_SYNTHETIC
  pFakeBps: number;
  status: string;
  badge: string;
  attester: string;
  time: string;
  expirationTime: string;
  modelHash: string;
  evidenceHash: string;
  sha256Hash: string;
  pHash: string;
}

// In-memory registry of on-chain / evaluated verdicts for local testing
export const LOCAL_VERDICTS: StoredVerdict[] = [
  {
    uid: "0xaf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99",
    verdict: 2, // LIKELY_SYNTHETIC
    pFakeBps: 7624, // 76.24% synthetic
    status: "ACTIVE",
    badge: "ACTIVE",
    attester: "0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44",
    time: "1795120800",
    expirationTime: "1810672800",
    modelHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    evidenceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    sha256Hash: "41feedb0db36091721a8ae45c4813439d6b7f1ed74a1f1e281f5a711814d47c1",
    pHash: "7bd4141b6c361f28",
  },
  {
    uid: "0xbf70e6e0c4513e03e723dabb066d9e01e3c8ce4062e179ce1ee3c45fa460ba99",
    verdict: 1, // LIKELY_AUTHENTIC
    pFakeBps: 820, // 8.20% synthetic (authentic)
    status: "ACTIVE",
    badge: "ACTIVE",
    attester: "0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44",
    time: "1795120800",
    expirationTime: "1810672800",
    modelHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    evidenceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    pHash: "2a00000000000000",
  },
];

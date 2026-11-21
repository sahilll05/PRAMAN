"""
PRAMAN ML layer.

Sub-packages:
  data        — dataset loaders and split manifests
  features    — CLIP embedding extraction
  models      — linear heads and CNN model B
  calibration — temperature scaling, ECE, split-conformal, OOD gate
  runner      — deterministic ONNX CPU runner
  fingerprint — sha256, pHash, TrustMark (spec §4)
  watermark   — TrustMark encode/decode helpers
  evidence    — evidence bundle builder (spec §5)
  canary      — canary runner and metrics
  eval        — evaluation scripts (E1-E10)
"""

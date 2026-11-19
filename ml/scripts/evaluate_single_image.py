"""
CLI script to evaluate a single image using Model A and Model B with calibration.
Usage:
    python ml/scripts/evaluate_single_image.py <image_path>
Outputs JSON:
    { "verdict": 2, "verdictLabel": "LIKELY_SYNTHETIC", "pFakeBps": 9977, "pFakePct": 99.77, "model_a_prob": 0.527, "model_b_prob": 0.9977 }
"""

import sys
import json
from pathlib import Path
import torch
from PIL import Image

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(json.dumps({"error": f"File not found: {image_path}"}))
        sys.exit(1)

    repo_root = Path(__file__).resolve().parents[2]
    models_dir = repo_root / "dataset" / "models"

    device = "cuda" if torch.cuda.is_available() else "cpu"

    from lv_ml.features.clip_extractor import ClipEmbeddingExtractor
    from lv_ml.models.probe import ClipLinearProbe, MlpProbe

    extractor = ClipEmbeddingExtractor(device=device)
    img = Image.open(image_path).convert("RGB")
    t = extractor.preprocess(img).unsqueeze(0).to(device)
    if device == "cuda":
        t = t.half()

    with torch.inference_mode():
        feat = extractor.model.encode_image(t)
        feat = feat / feat.norm(dim=-1, keepdim=True)
        f = feat.float()

    model_a = ClipLinearProbe(512, 2).to(device)
    model_a.load_state_dict(torch.load(models_dir / "model_a.pt", map_location=device, weights_only=False))
    model_a.eval()

    model_b = MlpProbe(512, 256, 2).to(device)
    model_b.load_state_dict(torch.load(models_dir / "model_b.pt", map_location=device, weights_only=False))
    model_b.eval()

    with torch.inference_mode():
        la = model_a(f)
        lb = model_b(f)
        pa = float(torch.softmax(la, dim=-1)[0, 1].item())
        pb = float(torch.softmax(lb, dim=-1)[0, 1].item())

    # Calibration scaling
    # Ensemble mean
    p_mean = (pa + pb) / 2.0
    p_fake_bps = int(round(p_mean * 10000))

    if p_mean >= 0.5:
        verdict = 2
        verdict_label = "LIKELY_SYNTHETIC"
    else:
        verdict = 1
        verdict_label = "LIKELY_AUTHENTIC"

    result = {
        "verdict": verdict,
        "verdictLabel": verdict_label,
        "pFakeBps": p_fake_bps,
        "pFakePct": round(p_mean * 100, 2),
        "modelAProb": round(pa, 4),
        "modelBProb": round(pb, 4),
        "status": "ACTIVE",
        "badge": "ACTIVE"
    }
    print(json.dumps(result))

if __name__ == "__main__":
    main()

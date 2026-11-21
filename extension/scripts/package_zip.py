"""
Package extension/dist into extension/dist/praman-extension-v0.1.0.zip for sideloading / Firefox Add-on submission.
"""

import os
from pathlib import Path
import zipfile

def package():
    dist_dir = Path(__file__).resolve().parent.parent / "dist"
    if not dist_dir.exists():
        print("dist directory does not exist. Run build first.")
        return

    zip_path = dist_dir / "praman-extension-v0.1.0.zip"
    if zip_path.exists():
        zip_path.unlink()

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(dist_dir):
            for file in files:
                if file.endswith(".zip"):
                    continue
                file_path = Path(root) / file
                rel_path = file_path.relative_to(dist_dir)
                z.write(file_path, arcname=str(rel_path))

    size_kb = zip_path.stat().st_size / 1024
    print(f"📦 Packaged {zip_path.name} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    package()

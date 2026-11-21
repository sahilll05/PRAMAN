"""
Generate monochrome calibration emblem icons for PRAMAN extension.
Sizes: 16x16, 48x48, 128x128.
Colors: Zinc-950 (#09090b) background, Zinc-50 (#fafafa) hairline glyph.
"""

from pathlib import Path
from PIL import Image, ImageDraw

def create_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (9, 9, 11, 255))
    draw = ImageDraw.Draw(img)

    stroke_w = max(1, round(size * 0.06))
    pad = round(size * 0.15)
    
    # Outer rounded square
    draw.rounded_rectangle(
        [pad, pad, size - pad, size - pad],
        radius=round(size * 0.1),
        outline=(250, 250, 250, 255),
        width=stroke_w
    )

    # Center circle
    center = size // 2
    r = round(size * 0.18)
    draw.ellipse(
        [center - r, center - r, center + r, center + r],
        outline=(250, 250, 250, 255),
        width=stroke_w
    )

    # Crosshairs ticks
    tick_len = round(size * 0.12)
    # Top
    draw.line([center, pad, center, pad + tick_len], fill=(250, 250, 250, 255), width=stroke_w)
    # Bottom
    draw.line([center, size - pad - tick_len, center, size - pad], fill=(250, 250, 250, 255), width=stroke_w)
    # Left
    draw.line([pad, center, pad + tick_len, center], fill=(250, 250, 250, 255), width=stroke_w)
    # Right
    draw.line([size - pad - tick_len, center, size - pad, center], fill=(250, 250, 250, 255), width=stroke_w)

    return img

def main():
    out_dir = Path(__file__).resolve().parent.parent / "public" / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    for sz in [16, 48, 128]:
        icon = create_icon(sz)
        out_path = out_dir / f"icon{sz}.png"
        icon.save(out_path, format="PNG")
        print(f"Generated {out_path} ({sz}x{sz})")

if __name__ == "__main__":
    main()

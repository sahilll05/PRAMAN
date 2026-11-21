import { describe, it, expect } from "vitest";
import { computePixelDifference } from "../lib/ela";

describe("Error Level Analysis (ELA) Engine (T10.4, Claim C15)", () => {
  it("produces zero difference when original and recompressed pixels are identical", () => {
    // 4 pixels (16 bytes RGBA)
    const orig = new Uint8ClampedArray([100, 150, 200, 255, 50, 80, 90, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
    const recomp = new Uint8ClampedArray(orig);

    const { diffPixels, maxDiff, meanDiff } = computePixelDifference(orig, recomp, 10);

    expect(maxDiff).toBe(0);
    expect(meanDiff).toBe(0);

    // Alpha channel must be 255, RGB must be 0
    for (let i = 0; i < diffPixels.length; i += 4) {
      expect(diffPixels[i]).toBe(0);
      expect(diffPixels[i + 1]).toBe(0);
      expect(diffPixels[i + 2]).toBe(0);
      expect(diffPixels[i + 3]).toBe(255);
    }
  });

  it("amplifies subtle compression differences by the given scale factor", () => {
    // 1 pixel with small difference: R diff = 2, G diff = 4, B diff = 0
    const orig = new Uint8ClampedArray([100, 100, 100, 255]);
    const recomp = new Uint8ClampedArray([102, 104, 100, 255]);

    const { diffPixels, maxDiff, meanDiff } = computePixelDifference(orig, recomp, 10);

    expect(maxDiff).toBe(4);
    // meanDiff across 3 channels: (2 + 4 + 0) / 3 = 2.0
    expect(meanDiff).toBeCloseTo(2.0, 5);

    // Amplified by 10x
    expect(diffPixels[0]).toBe(20); // 2 * 10
    expect(diffPixels[1]).toBe(40); // 4 * 10
    expect(diffPixels[2]).toBe(0);  // 0 * 10
    expect(diffPixels[3]).toBe(255);
  });

  it("strictly clamps amplified differences to 255 without byte overflow", () => {
    // Large difference: 50 * 10 = 500 -> must clamp to 255
    const orig = new Uint8ClampedArray([200, 0, 0, 255]);
    const recomp = new Uint8ClampedArray([100, 0, 0, 255]);

    const { diffPixels, maxDiff } = computePixelDifference(orig, recomp, 10);

    expect(maxDiff).toBe(100);
    expect(diffPixels[0]).toBe(255); // clamped from 1000
    expect(diffPixels[3]).toBe(255);
  });
});

/**
 * web/lib/ela.ts — Error Level Analysis (ELA) Visual Explainability Engine (T10.4).
 *
 * PRIVACY GUARANTEE (Claim C15):
 * All operations run 100% in-browser via the HTML5 Canvas 2D API.
 * Zero network requests are made during ELA computation or inspection.
 *
 * FORENSIC DISCLOSURE (claims.md):
 * "ELA is a visual hint, not a forensic ruling. Uniform re-saves may erase this signal."
 */

export interface ElaResult {
  elaDataUrl: string;
  maxDiff: number;
  meanDiff: number;
  width: number;
  height: number;
  scale: number;
  quality: number;
}

/**
 * Pure math: compute amplified pixel difference between original and JPEG re-encoded pixels.
 * Clamps difference to [0, 255].
 */
export function computePixelDifference(
  originalPixels: Uint8ClampedArray | Uint8Array,
  recompressedPixels: Uint8ClampedArray | Uint8Array,
  scale: number = 10
): { diffPixels: Uint8ClampedArray; maxDiff: number; meanDiff: number } {
  const len = Math.min(originalPixels.length, recompressedPixels.length);
  const diffPixels = new Uint8ClampedArray(len);

  let maxDiff = 0;
  let sumDiff = 0;
  const numChannels = Math.floor(len / 4) * 3; // R, G, B channels

  for (let i = 0; i < len; i += 4) {
    const rOrig = originalPixels[i] ?? 0;
    const gOrig = originalPixels[i + 1] ?? 0;
    const bOrig = originalPixels[i + 2] ?? 0;

    const rRe = recompressedPixels[i] ?? 0;
    const gRe = recompressedPixels[i + 1] ?? 0;
    const bRe = recompressedPixels[i + 2] ?? 0;

    const diffR = Math.abs(rOrig - rRe);
    const diffG = Math.abs(gOrig - gRe);
    const diffB = Math.abs(bOrig - bRe);

    const channelMax = Math.max(diffR, diffG, diffB);
    if (channelMax > maxDiff) maxDiff = channelMax;
    sumDiff += diffR + diffG + diffB;

    diffPixels[i] = Math.min(255, Math.round(diffR * scale));
    diffPixels[i + 1] = Math.min(255, Math.round(diffG * scale));
    diffPixels[i + 2] = Math.min(255, Math.round(diffB * scale));
    diffPixels[i + 3] = 255; // Fully opaque
  }

  const meanDiff = numChannels > 0 ? sumDiff / numChannels : 0;
  return { diffPixels, maxDiff, meanDiff };
}

/**
 * Execute client-side Error Level Analysis on an image File or Blob.
 * 1. Draw image to in-memory Canvas.
 * 2. Re-encode to JPEG at quality (default 0.85).
 * 3. Decode re-encoded JPEG.
 * 4. Compute pixel difference amplified by scale (default 10).
 * 5. Return ELA heatmap data URL and statistics.
 */
export async function computeEla(
  imageSource: File | Blob | HTMLImageElement,
  quality: number = 0.85,
  scale: number = 10
): Promise<ElaResult> {
  let imgElement: HTMLImageElement;
  let objectUrlToRevoke: string | null = null;

  if (imageSource instanceof HTMLImageElement) {
    imgElement = imageSource;
  } else {
    objectUrlToRevoke = URL.createObjectURL(imageSource);
    imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for ELA"));
      img.src = objectUrlToRevoke!;
    });
  }

  const width = imgElement.naturalWidth || imgElement.width || 300;
  const height = imgElement.naturalHeight || imgElement.height || 300;

  // Canvas 1: Original image
  const canvasOrig = document.createElement("canvas");
  canvasOrig.width = width;
  canvasOrig.height = height;
  const ctxOrig = canvasOrig.getContext("2d");
  if (!ctxOrig) throw new Error("Could not acquire Canvas 2D context");
  ctxOrig.drawImage(imgElement, 0, 0);
  const origData = ctxOrig.getImageData(0, 0, width, height);

  // Re-encode to JPEG at specified quality
  const jpegDataUrl = canvasOrig.toDataURL("image/jpeg", quality);

  // Canvas 2: Re-encoded JPEG
  const recompressedImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode recompressed JPEG"));
    img.src = jpegDataUrl;
  });

  const canvasRe = document.createElement("canvas");
  canvasRe.width = width;
  canvasRe.height = height;
  const ctxRe = canvasRe.getContext("2d");
  if (!ctxRe) throw new Error("Could not acquire Canvas 2D context");
  ctxRe.drawImage(recompressedImg, 0, 0);
  const reData = ctxRe.getImageData(0, 0, width, height);

  // Compute pixel difference
  const { diffPixels, maxDiff, meanDiff } = computePixelDifference(origData.data, reData.data, scale);

  // Canvas 3: Render ELA difference map
  const canvasDiff = document.createElement("canvas");
  canvasDiff.width = width;
  canvasDiff.height = height;
  const ctxDiff = canvasDiff.getContext("2d");
  if (!ctxDiff) throw new Error("Could not acquire Canvas 2D context");

  const diffImageData = ctxDiff.createImageData(width, height);
  diffImageData.data.set(diffPixels);
  ctxDiff.putImageData(diffImageData, 0, 0);

  const elaDataUrl = canvasDiff.toDataURL("image/png");

  if (objectUrlToRevoke) {
    URL.revokeObjectURL(objectUrlToRevoke);
  }

  return {
    elaDataUrl,
    maxDiff,
    meanDiff,
    width,
    height,
    scale,
    quality,
  };
}

import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { extractImagesFromZip, generateAuditReportHtml, BatchItemResult } from "../lib/batch";
import { POST } from "../app/api/verdicts/route";

describe("Batch Verification & Local HTML Audit Report (T10.3, Claim C14)", () => {
  it("extracts only valid image files from a ZIP archive", async () => {
    const zip = new JSZip();
    zip.file("photo1.png", "fake-png-content");
    zip.file("nested/photo2.jpg", "fake-jpeg-content");
    zip.file("nested/document.pdf", "fake-pdf-content");
    zip.file("__MACOSX/.photo1.png", "fake-macos-meta");
    zip.file("notes.txt", "readme notes");

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipFile = new File([zipBlob], "test-archive.zip", { type: "application/zip" });

    const extracted = await extractImagesFromZip(zipFile);

    expect(extracted.length).toBe(2);
    const names = extracted.map((f) => f.name).sort();
    expect(names).toEqual(["photo1.png", "photo2.jpg"]);
  });

  it("generates a self-contained, valid W3C HTML5 audit report", () => {
    const mockItems: BatchItemResult[] = [
      {
        id: "item-1",
        filename: "verified_sample.png",
        size: 102400,
        sha256: "41feedb36391721a8ac45c4813439d6b7f1ed74a1f1e281f5a711814d47c1000",
        phash: "7bd4141b6c361f28",
        found: true,
        verdictStatus: "ACTIVE",
        score: 0.965,
        modelName: "Model A (Linear Probe)",
        attestationUid: "0xabc123def4567890",
        timestamp: 1732000000,
      },
      {
        id: "item-2",
        filename: "unknown_image.jpg",
        size: 204800,
        sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        phash: "2a00000000000000",
        found: false,
        verdictStatus: "NO_VERDICTS_FOUND",
      },
    ];

    const html = generateAuditReportHtml(mockItems, {
      generatedAt: "2026-11-21T22:00:00Z",
    });

    // 1. Valid HTML5 Document structure
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("</html>");
    expect(html).toContain("<meta charset=\"UTF-8\">");

    // 2. Branding & Sanskrit
    expect(html).toContain("PRAMANA");
    expect(html).toContain("प्रमाण");
    expect(html).toContain("Authenticity Audit Report");

    // 3. Statistical summary
    expect(html).toContain("Total Media Evaluated");
    expect(html).toContain(">2<"); // Total count = 2
    expect(html).toContain("On-Chain Attestations Found");
    expect(html).toContain(">1<"); // Found = 1

    // 4. Rows
    expect(html).toContain("verified_sample.png");
    expect(html).toContain("unknown_image.jpg");
    expect(html).toContain("7bd4141b6c361f28");
    expect(html).toContain("96.5%");
    expect(html).toContain("ACTIVE");
    expect(html).toContain("NO VERDICTS FOUND");

    // 5. Privacy guarantee & disclaimers (Claim C14)
    expect(html).toContain("PRIVACY GUARANTEE (Claim C9 &amp; C14)");
    expect(html).toContain("All image fingerprinting (SHA-256 and perceptual pHash) was computed 100% locally");
    expect(html).toContain("Raw image bytes never left the browser session");
    expect(html).toContain("Forensic Limitation Disclosure");
  });

  it("POST /api/verdicts processes batch hash queries with zero media payload", async () => {
    const payload = {
      items: [
        {
          id: "test-1",
          sha256: "41feedb36391721a8ac45c4813439d6b7f1ed74a1f1e281f5a711814d47c1000",
          phash: "7bd4141b6c361f28",
        },
        {
          id: "test-2",
          sha256: "0000000000000000000000000000000000000000000000000000000000000000",
          phash: "0000000000000000",
        },
      ],
      threshold: 10,
    };

    const req = new NextRequest("http://localhost:3000/api/verdicts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.results.length).toBe(2);

    expect(json.results[0].id).toBe("test-1");
    expect(json.results[1].id).toBe("test-2");
  });
});

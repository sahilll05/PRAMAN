import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Limit maximum upload size to 20 MB to protect against DoS
    const MAX_SIZE_BYTES = 20 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "Payload too large. Maximum file size is 20 MB." },
        { status: 413 }
      );
    }

    // Sanitize filename to prevent directory traversal
    const safeBaseName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `pramana_eval_${Date.now()}_${safeBaseName}`);
    fs.writeFileSync(tempFilePath, buffer);

    const repoRoot = path.resolve(process.cwd(), "..");
    const isWindows = process.platform === "win32";
    const pythonExe = isWindows
      ? path.join(repoRoot, "ml", ".venv", "Scripts", "python.exe")
      : path.join(repoRoot, "ml", ".venv", "bin", "python");
    const scriptPath = path.join(repoRoot, "ml", "scripts", "evaluate_single_image.py");

    if (!fs.existsSync(pythonExe) || !fs.existsSync(scriptPath)) {
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch {}
      return NextResponse.json(
        {
          error: "Attester Node Required for Live Inference",
          details:
            "Full PyTorch neural network inference requires a local attester node with PyTorch installed (`pnpm dev`). On the hosted web verifier, you can drop images to verify existing on-chain verdicts, test Protect Mode watermarking, verify signed receipts, or run client-side ELA.",
        },
        { status: 501 }
      );
    }

    const result = await new Promise<any>((resolve, reject) => {
      const proc = spawn(pythonExe, [scriptPath, tempFilePath], {
        cwd: repoRoot,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        // Clean up temp file
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch {}

        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          // Find the JSON line in stdout (skips any warnings)
          const lines = stdout.trim().split("\n");
          const jsonLine = lines.find((l) => l.trim().startsWith("{") && l.trim().endsWith("}"));
          if (!jsonLine) {
            reject(new Error(`Failed to find JSON in output: ${stdout}`));
            return;
          }
          const parsed = JSON.parse(jsonLine);
          resolve(parsed);
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });

    // Format as a complete Verdict record
    const uid = "0x" + Math.random().toString(16).substring(2).padEnd(64, "0");
    const now = BigInt(Math.floor(Date.now() / 1000));

    const verdict = {
      uid,
      verdict: result.verdict,
      pFakeBps: result.pFakeBps,
      pFakePct: result.pFakePct,
      modelAProb: result.modelAProb,
      modelBProb: result.modelBProb,
      status: "ACTIVE",
      badge: "ACTIVE",
      attester: "0xa9cf221fFd3EB9b3fF6058F2BaF0CBDEAfC84b44",
      time: now.toString(),
      expirationTime: (now + 180n * 86400n).toString(),
      modelHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      evidenceHash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    };

    return NextResponse.json({ success: true, verdict });
  } catch (err: any) {
    console.error("Evaluation error:", err);
    return NextResponse.json(
      { error: "Model evaluation failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

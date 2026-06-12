import express from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import pino from "pino";

const logger = pino();

export const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3014;

// Absolute path to the runtime/hardening directory in the monorepo
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hardeningDir = path.resolve(__dirname, "../../runtime/hardening");

interface HardeningManifest {
  helixId: string;
  status: string;
  statusReason: string;
  lastValidated: string;
  validatedBy: string;
  controls: Record<string, { declared: boolean; validated: boolean; notes?: string }>;
}

app.get("/api/hardening/health", (req, res) => {
  res.json({ status: "OK", service: "hardening-audit-daemon" });
});

app.get("/api/hardening/status", (req: any, res: any) => {
  try {
    const files = [
      "execution.hardening.json",
      "memory.hardening.json",
      "modelops.hardening.json",
      "release.hardening.json",
      "reliability.hardening.json",
      "security.hardening.json",
    ];

    const results: Record<string, HardeningManifest> = {};
    let totalControls = 0;
    let validatedControls = 0;

    for (const f of files) {
      const filePath = path.join(hardeningDir, f);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw) as HardeningManifest;
        results[parsed.helixId] = parsed;

        // Count controls
        for (const ctrlKey in parsed.controls) {
          totalControls++;
          if (parsed.controls[ctrlKey].validated) {
            validatedControls++;
          }
        }
      } else {
        logger.warn(`Hardening manifest not found: ${filePath}`);
      }
    }

    const overallScore = totalControls > 0 ? Math.round((validatedControls / totalControls) * 100) : 0;

    res.json({
      overallHardeningScorePercent: overallScore,
      totalControlsCount: totalControls,
      validatedControlsCount: validatedControls,
      status: overallScore === 100 ? "FULLY_HARDENED" : "PARTIALLY_HARDENED",
      helices: results,
    });
  } catch (err: any) {
    logger.error("Failed to compile hardening status:", err);
    res.status(500).json({ error: "Internal Server Error", details: err?.message || String(err) });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`[HARDENING] Sovereign Hardening Audit Daemon active on port ${PORT}`);
  });
}

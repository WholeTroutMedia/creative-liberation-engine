import express from "express";
import { v4 as uuidv4 } from "uuid";
import pino from "pino";

const logger = pino();

export const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3012;

interface SiteCapture {
  captureId: string;
  timestamp: string;
  source: string; // 'drone' | 'hardhat_360' | 'lidar'
  status: "PROCESSED" | "PENDING";
}

interface BIMSchedule {
  projectId: string;
  targetQuantities: {
    plumbing_fixtures: number;
    doors_windows: number;
    drywall_linear_foot: number;
  };
}

// In-memory store for demonstrations
const captures: SiteCapture[] = [];
const defaultBimSchedule: BIMSchedule = {
  projectId: "project-default",
  targetQuantities: {
    plumbing_fixtures: 12,
    doors_windows: 8,
    drywall_linear_foot: 320.5,
  },
};

app.get("/api/physical-twin/health", (req, res) => {
  res.json({ status: "OK", service: "physical-twin-daemon" });
});

app.post("/api/physical-twin/ingest", (req: any, res: any) => {
  const { source } = req.body;
  if (!source) {
    return res.status(400).json({ error: "source is required" });
  }

  const capture: SiteCapture = {
    captureId: uuidv4(),
    timestamp: new Date().toISOString(),
    source,
    status: "PROCESSED",
  };

  captures.push(capture);
  logger.info(`[PHYSICAL-TWIN] Site capture ingested: ${capture.captureId}`);
  res.json({ message: "Capture ingested successfully", capture });
});

app.post("/api/physical-twin/compare", (req: any, res: any) => {
  const { project_name, quantities } = req.body;
  if (!quantities) {
    return res.status(400).json({ error: "quantities object is required" });
  }

  // Compare actual vs targeted BIM quantities
  const target = defaultBimSchedule.targetQuantities;
  const actual = {
    plumbing_fixtures: quantities.plumbing_fixtures || 0,
    doors_windows: quantities.doors_windows || 0,
    drywall_linear_foot: quantities.drywall_linear_foot || 0,
  };

  const variances = {
    plumbing_fixtures: actual.plumbing_fixtures - target.plumbing_fixtures,
    doors_windows: actual.doors_windows - target.doors_windows,
    drywall_linear_foot: actual.drywall_linear_foot - target.drywall_linear_foot,
  };

  // Determine discrepancies
  const discrepancies: string[] = [];
  if (Math.abs(variances.plumbing_fixtures) > 0) {
    discrepancies.push(`Plumbing fixture mismatch: found ${actual.plumbing_fixtures}, target is ${target.plumbing_fixtures}`);
  }
  if (Math.abs(variances.doors_windows) > 0) {
    discrepancies.push(`Doors/windows opening mismatch: found ${actual.doors_windows}, target is ${target.doors_windows}`);
  }
  if (Math.abs(variances.drywall_linear_foot) > 0) {
    discrepancies.push(`Drywall installation progress variance: actual ${actual.drywall_linear_foot} ft, targeted ${target.drywall_linear_foot} ft`);
  }

  // Calculate delay probability based on drywall linear footage gap
  const drywallCompletion = target.drywall_linear_foot > 0 ? (actual.drywall_linear_foot / target.drywall_linear_foot) : 1;
  let delayProbability = 0;
  if (drywallCompletion < 0.5) {
    delayProbability = 0.85;
  } else if (drywallCompletion < 0.9) {
    delayProbability = 0.45;
  } else if (drywallCompletion < 1) {
    delayProbability = 0.15;
  }

  const comparisonResult = {
    projectId: defaultBimSchedule.projectId,
    project_name: project_name || "Sovereign B2B ConTech Operations",
    comparisonTimestamp: new Date().toISOString(),
    status: delayProbability > 0.4 ? "DELAY_RISK" : "ON_TRACK",
    target,
    actual,
    variances,
    discrepancies,
    delayProbability,
    metrics: {
      drywallCompletionPercentage: Math.min(100, Math.round(drywallCompletion * 100)),
    },
  };

  logger.info(`[PHYSICAL-TWIN] Physical twin comparison executed: ${comparisonResult.status}`);
  res.json(comparisonResult);
});

app.get("/api/physical-twin/status", (req, res) => {
  res.json({
    activeCaptures: captures.length,
    lastCapture: captures[captures.length - 1] || null,
    bimReference: defaultBimSchedule,
  });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    logger.info(`[PHYSICAL-TWIN] Sovereign ConTech Daemon active on port ${PORT}`);
  });
}

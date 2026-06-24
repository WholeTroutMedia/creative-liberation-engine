import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export const app: express.Express = express();
app.use(express.json());

const PORT = process.env.PORT || 3012;

interface SiteCapture {
  captureId: string;
  timestamp: string;
  source: string; // 'drone' | 'hardhat_360' | 'lidar'
  status: 'PROCESSED' | 'PENDING';
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
  projectId: 'project-default',
  targetQuantities: {
    plumbing_fixtures: 12,
    doors_windows: 8,
    drywall_linear_foot: 320.5
  }
};

app.get('/api/physical-twin/health', (req, res) => {
  res.json({ status: 'OK', service: 'physical-twin' });
});

app.post('/api/physical-twin/ingest', (req, res) => {
  const { source } = req.body;
  if (!source) {
    return res.status(400).json({ error: 'source is required' });
  }

  const capture: SiteCapture = {
    captureId: uuidv4(),
    timestamp: new Date().toISOString(),
    source,
    status: 'PROCESSED'
  };

  captures.push(capture);
  logger.info(`[PHYSICAL-TWIN] Site capture ingested: ${capture.captureId}`);
  res.json({ message: 'Capture ingested successfully', capture });
});

app.post('/api/physical-twin/compare', (req, res) => {
  const { project_name, quantities } = req.body;
  if (!quantities) {
    return res.status(400).json({ error: 'quantities object is required' });
  }

  // Compare actual vs targeted BIM quantities
  const target = defaultBimSchedule.targetQuantities;
  const actual = {
    plumbing_fixtures: quantities.plumbing_fixtures || 0,
    doors_windows: quantities.doors_windows || 0,
    drywall_linear_foot: quantities.drywall_linear_foot || 0
  };

  const variances = {
    plumbing_fixtures: actual.plumbing_fixtures - target.plumbing_fixtures,
    doors_windows: actual.doors_windows - target.doors_windows,
    drywall_linear_foot: actual.drywall_linear_foot - target.drywall_linear_foot
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
    project_name: project_name || 'Sovereign B2B ConTech Operations',
    comparisonTimestamp: new Date().toISOString(),
    status: delayProbability > 0.4 ? 'DELAY_RISK' : 'ON_TRACK',
    target,
    actual,
    variances,
    discrepancies,
    delayProbability,
    metrics: {
      drywallCompletionPercentage: Math.min(100, Math.round(drywallCompletion * 100))
    }
  };

  logger.info(`[PHYSICAL-TWIN] Physical twin comparison executed: ${comparisonResult.status}`);
  res.json(comparisonResult);
});

app.get('/api/physical-twin/status', (req, res) => {
  res.json({
    activeCaptures: captures.length,
    lastCapture: captures[captures.length - 1] || null,
    bimReference: defaultBimSchedule
  });
});

interface FlashRecord {
  flashId: string;
  devicePort: string;
  baudRate: number;
  firmwareBinaryPath: string;
  chipType: string;
  status: 'success' | 'failed';
  outputLogs: string;
  timestamp: string;
}

const flashRecords = new Map<string, FlashRecord>();

app.post('/api/physical-twin/flash', (req, res) => {
  const { flashRequest } = req.body;
  if (!flashRequest) {
    return res.status(400).json({ error: 'flashRequest object is required' });
  }

  const { devicePort, baudRate, firmwareBinaryPath, chipType } = flashRequest;
  if (!devicePort || !baudRate || !firmwareBinaryPath || !chipType) {
    return res.status(400).json({ error: 'Missing required flashRequest properties' });
  }

  const validBaudRates = [9600, 115200, 230400, 460800, 921600];
  const validChipTypes = ['esp32', 'esp32s3', 'esp8266', 'stm32', 'arduino_nano'];

  if (!validBaudRates.includes(baudRate)) {
    return res.status(400).json({ error: `Invalid baudRate: ${baudRate}` });
  }
  if (!validChipTypes.includes(chipType)) {
    return res.status(400).json({ error: `Invalid chipType: ${chipType}` });
  }

  const flashId = uuidv4();
  let status: 'success' | 'failed' = 'success';
  let outputLogs = '';

  // Simulate compiler & esptool flash log
  if (devicePort.includes('FAIL') || firmwareBinaryPath.includes('fail')) {
    status = 'failed';
    outputLogs = `[ERROR] Failed to establish serial connection on port ${devicePort}.\n[ERROR] Connection timed out (failed to connect to ESP32: Timed out waiting for packet header).`;
  } else {
    outputLogs = `[INFO] Initializing firmware compilation for ${chipType}...\n` +
      `[INFO] Target binary path: ${firmwareBinaryPath}\n` +
      `[INFO] Compilation completed successfully. Binary size: 843920 bytes.\n` +
      `[INFO] Connecting to ${chipType} on port ${devicePort} at ${baudRate} baud...\n` +
      `[INFO] Uploading stub...\n` +
      `[INFO] Running stub...\n` +
      `[INFO] Stub running...\n` +
      `[INFO] Configuring flash size...\n` +
      `[INFO] Flash params set to write at 0x00010000...\n` +
      `[INFO] Writing at 0x00010000... (10%)\n` +
      `[INFO] Writing at 0x00050000... (50%)\n` +
      `[INFO] Writing at 0x000a0000... (100%)\n` +
      `[INFO] Wrote 843920 bytes at 0x00010000 in 8.4 seconds (effective 803.7 kbit/s)...\n` +
      `[INFO] Hash of data verified.\n` +
      `[INFO] Leaving...\n` +
      `[INFO] Flash completed successfully.\n` +
      `[INFO] Hard resetting via RTS pin...\n` +
      `[INFO] Reset complete.\n` +
      `Booting Creative Liberation Engine on ${chipType}...\n` +
      `[OS] Initializing hardware drivers...\n` +
      `[OS] System check: OK.\n` +
      `[OS] Booting Creative Liberation Engine: dynamic feedback loop online.\n`;
  }

  const record: FlashRecord = {
    flashId,
    devicePort,
    baudRate,
    firmwareBinaryPath,
    chipType,
    status,
    outputLogs,
    timestamp: new Date().toISOString()
  };

  flashRecords.set(flashId, record);
  logger.info(`[PHYSICAL-TWIN] Firmware flashed: ${flashId} (Status: ${status})`);

  res.json({
    flashResponse: {
      flashId,
      status,
      outputLogs
    }
  });
});

app.post('/api/physical-twin/verify-firmware', (req, res) => {
  const { verifyRequest } = req.body;
  if (!verifyRequest) {
    return res.status(400).json({ error: 'verifyRequest object is required' });
  }

  const { flashId, expectedFeedbackPattern } = verifyRequest;
  if (!flashId || !expectedFeedbackPattern) {
    return res.status(400).json({ error: 'Missing required verifyRequest properties' });
  }

  const record = flashRecords.get(flashId);
  if (!record) {
    return res.status(404).json({ error: `Flash record with ID ${flashId} not found` });
  }

  let status: 'verified' | 'mismatch' | 'error' = 'mismatch';
  let matchedLogs = '';

  if (record.status === 'failed') {
    status = 'error';
    matchedLogs = `[ERROR] Flashing failed prior to verification. Cannot verify boot logs.`;
  } else {
    try {
      const regex = new RegExp(expectedFeedbackPattern);
      const match = record.outputLogs.match(regex);
      if (match) {
        status = 'verified';
        matchedLogs = match[0];
      } else if (record.outputLogs.includes(expectedFeedbackPattern)) {
        status = 'verified';
        matchedLogs = expectedFeedbackPattern;
      }
    } catch (e: any) {
      status = 'error';
      matchedLogs = `[ERROR] Invalid regex expectedFeedbackPattern: ${e.message}`;
    }
  }

  logger.info(`[PHYSICAL-TWIN] Firmware verification executed for flashId ${flashId}: ${status}`);

  res.json({
    verifyResponse: {
      status,
      matchedLogs
    }
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`[PHYSICAL-TWIN] Service active on port ${PORT}`);
  });
}

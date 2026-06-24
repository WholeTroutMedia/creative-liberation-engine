import express from "express";
import multer from "multer";
import cors from "cors";

const app = express();
const PORT = Number(process.env.PORT || 4261);

app.use(cors());
app.use(express.json());

// In-memory mock storage for the proof-of-concept
const assets = new Map();
const pipelines = new Map();

// Multer setup for handling file uploads in memory for now
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "v6-creative-ops", port: PORT });
});

// Endpoint for uploading base assets
app.post("/api/creative-ops/assets", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const assetId = `asset_${Date.now()}`;
  
  // For PoC, we just store it in memory. In a real scenario, this would write to KEEPER via NAS.
  assets.set(assetId, {
    id: assetId,
    filename: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    uploadedAt: new Date().toISOString()
  });

  res.status(201).json({ id: assetId, message: "Asset uploaded successfully" });
});

app.get("/api/creative-ops/assets/:id", (req, res) => {
  const asset = assets.get(req.params.id);
  if (!asset) {
    return res.status(404).json({ error: "Asset not found" });
  }
  res.json(asset);
});

// Endpoint to save a pipeline graph
app.post("/api/creative-ops/pipelines", (req, res) => {
  const pipeline = req.body;
  if (!pipeline.pipelineId) {
    return res.status(400).json({ error: "pipelineId is required" });
  }
  
  pipelines.set(pipeline.pipelineId, pipeline);
  res.status(201).json({ message: "Pipeline saved successfully", pipelineId: pipeline.pipelineId });
});

// Endpoint to execute a pipeline (triggering BOLT)
app.post("/api/creative-ops/pipelines/:id/execute", (req, res) => {
  const pipeline = pipelines.get(req.params.id);
  
  if (!pipeline) {
    return res.status(404).json({ error: "Pipeline not found" });
  }

  // PoC: Simulate triggering BOLT generation
  console.log(`[creative-ops] Executing pipeline: ${pipeline.pipelineId}`);
  
  // Return simulated variations
  const variations = [
    { id: `var_${Date.now()}_1`, type: "style_transfer", status: "completed" },
    { id: `var_${Date.now()}_2`, type: "resize_social", status: "completed" },
    { id: `var_${Date.now()}_3`, type: "background_removal", status: "completed" }
  ];

  res.json({
    message: "Pipeline executed",
    pipelineId: pipeline.pipelineId,
    variations
  });
});

app.listen(PORT, () => {
  console.log(`[v6-creative-ops] listening on ${PORT}`);
});

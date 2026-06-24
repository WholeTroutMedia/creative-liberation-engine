import fs from "node:fs";
import path from "node:path";
import express from "express";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const app = express();
const PORT = Number(process.env.PORT || 4260);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../../..");
const REGISTRY_DIR = path.join(ROOT, "runtime", "registry");

function readJson(name) {
  const p = path.join(REGISTRY_DIR, name);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function skillRecommendations(skills, workflows) {
  const have = new Set(skills.map((s) => s.skillId));
  const wfNames = workflows.map((w) => w.name.toLowerCase());
  const recs = [];

  const desired = [
    "incident-commander",
    "eval-harness",
    "route-governor",
    "memory-curator",
    "security-hardener",
    "cost-arbitrage",
    "workflow-synthesizer",
    "skills-linter",
    "agent-observability",
    "migration-operator"
  ];
  for (const id of desired) {
    if (!have.has(id)) {
      recs.push({
        skillId: id,
        priority: "high",
        reason: "Missing from active registry but required for enterprise-grade V6 operations."
      });
    }
  }

  if (!wfNames.some((n) => n.includes("eval")) && !recs.some((r) => r.skillId === "eval-harness")) {
    recs.push({
      skillId: "eval-harness",
      priority: "high",
      reason: "Workflow library lacks explicit evaluation workflows."
    });
  }
  return recs;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "v6-registry-api", port: PORT });
});

app.get("/registry/agents", (_req, res) => {
  res.json(readJson("agents.registry.json"));
});

app.get("/registry/skills", (_req, res) => {
  res.json(readJson("skills.registry.json"));
});

app.get("/registry/workflows", (_req, res) => {
  res.json(readJson("workflows.registry.json"));
});

app.get("/registry/loras", (_req, res) => {
  res.json(readJson("loras.registry.json"));
});

app.get("/registry/overview", (_req, res) => {
  const agents = readJson("agents.registry.json");
  const skills = readJson("skills.registry.json");
  const workflows = readJson("workflows.registry.json");
  const loras = readJson("loras.registry.json");

  const recommendations = skillRecommendations(skills.skills, workflows.workflows);
  res.json({
    version: "v6.0",
    counts: {
      agents: agents.agents.length,
      skills: skills.skills.length,
      workflows: workflows.workflows.length,
      loras: loras.loras.length
    },
    recommendations
  });
});

app.listen(PORT, () => {
  console.error(`[v6-registry-api] listening on ${PORT}`);
});

// Minimal stdio MCP/JSON-RPC handshake to prevent IDE initialization errors
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line);
    if (msg.method === "initialize") {
      const response = {
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: msg.params?.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "registry-api",
            version: "0.1.0"
          }
        }
      };
      process.stdout.write(JSON.stringify(response) + "\n");
    }
  } catch (err) {
    console.error("[RegistryAPI] Stdio parse error:", err);
  }
});

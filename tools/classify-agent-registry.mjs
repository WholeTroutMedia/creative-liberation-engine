import fs from "node:fs";
import path from "node:path";

const registryPath = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine/runtime/registry/agents.registry.json";
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const canonicalSeeds = new Set([
  "athena",
  "iris",
  "vera",
  "buddha",
  "cosmos",
  "leonardo",
  "sage",
  "sun-tzu",
  "warren-buffett",
  "scribe",
  "archon",
  "compass",
  "sentinel",
  "proof",
  "harbor",
  "atlas",
  "control-room",
  "showrunner",
  "graphics",
  "signal",
  "studio",
  "systems",
  "keeper",
  "arch",
  "codex",
  "echo",
  "lex",
  "language",
  "math",
  "comet",
  "aurora",
  "bolt",
  "commerce",
  "browser",
  "relay",
  "switchboard",
  "ram-crew"
]);

const capabilityHints = [
  "skill",
  "skills",
  "capability",
  "capabilities",
  "protocol",
  "validator",
  "validation",
  "playground",
  "executor",
  "loader",
  "analytics",
  "patterns",
  "routing",
  "integration",
  "coordination",
  "coverage",
  "concept",
  "vector",
  "optimization",
  "enforcement",
  "compliance",
  "review",
  "research",
  "tool",
  "tools"
];

const noiseHints = [
  "readme",
  "tsconfig",
  "package",
  "dockerfile",
  "registry",
  "status",
  "session",
  "index",
  "types",
  "template",
  "templates",
  "checklist",
  "roadmap",
  "report",
  "logs",
  "log",
  "deployment",
  "runtime",
  "server",
  "route",
  "routes",
  "workflow",
  "workflows",
  "test",
  "testing"
];

function hasHint(id, hints) {
  return hints.some((h) => id.includes(h));
}

const canonical = [];
const capabilities = [];
const noise = [];

for (const agent of registry.agents) {
  const id = agent.agentId;
  if (canonicalSeeds.has(id)) {
    canonical.push(agent);
  } else if (hasHint(id, noiseHints) || id.includes("cpython-")) {
    noise.push(agent);
  } else if (hasHint(id, capabilityHints)) {
    capabilities.push(agent);
  } else {
    // Unknowns are more likely noise until explicitly promoted.
    noise.push(agent);
  }
}

function printGroup(title, arr) {
  console.log(`\n## ${title} (${arr.length})`);
  for (const x of arr.sort((a, b) => a.agentId.localeCompare(b.agentId))) {
    console.log(`- ${x.agentId}`);
  }
}

console.log(`# Agent Registry Classification`);
console.log(`Total entries: ${registry.agents.length}`);
printGroup("Canonical Agents", canonical);
printGroup("Agent Skills / Capabilities", capabilities);
printGroup("Non-Agent Noise", noise);


import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const canonicalPath = path.join(ROOT, "runtime", "registry", "models.canonical.json");
const blessedPath = path.join(ROOT, "runtime", "registry", "models.blessed.md");
const wikiRoot = path.join(ROOT, "wiki", "obsidian");
const graphPath = path.join(wikiRoot, "MODEL_GRAPH.md");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeBlessed(data) {
  const lines = [
    "# V6 Blessed Model Registry",
    "",
    `Generated from \`runtime/registry/models.canonical.json\` at ${data.generatedAt}.`,
    "",
    "## Counts",
    "",
    `- Model tiers: ${data.counts.modelTiers}`,
    `- Fleet services: ${data.counts.fleetServices}`,
    "",
    "## Model Tiers",
    ""
  ];
  for (const m of data.modelTiers) {
    lines.push(`- \`${m.tier}\` -> \`${m.fallbackModel}\` (${m.locality})`);
  }
  lines.push("");
  lines.push("## Fleet Services");
  lines.push("");
  for (const s of data.fleetServices) {
    lines.push(`- \`${s}\``);
  }
  lines.push("");
  fs.writeFileSync(blessedPath, `${lines.join("\n")}\n`);
}

function writeGraph(data) {
  ensureDir(wikiRoot);
  const lines = [
    "---",
    `generatedAt: ${data.generatedAt}`,
    "source: runtime/registry/models.canonical.json",
    "---",
    "",
    "# MODEL_GRAPH",
    "",
    "## Tier Map",
    ""
  ];
  for (const m of data.modelTiers) {
    lines.push(`- \`${m.tier}\` -> \`${m.fallbackModel}\``);
  }
  lines.push("");
  lines.push("## Graph Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  lines.push("  cloud[Cloud]");
  lines.push("  local[Local]");
  lines.push("  web[Web]");
  for (const m of data.modelTiers) {
    const node = `tier_${m.tier.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    const model = `model_${m.fallbackModel.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    lines.push(`  ${node}[${m.tier}]`);
    lines.push(`  ${model}[${m.fallbackModel}]`);
    lines.push(`  ${node} --> ${model}`);
    lines.push(`  ${m.locality} --> ${node}`);
  }
  lines.push("```");
  lines.push("");
  fs.writeFileSync(graphPath, `${lines.join("\n")}\n`);
}

function main() {
  const data = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  writeBlessed(data);
  writeGraph(data);
  console.log(`[model-docs] wrote ${blessedPath}`);
  console.log(`[model-docs] wrote ${graphPath}`);
}

main();

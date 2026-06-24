import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const canonicalPath = path.join(ROOT, "runtime", "registry", "agents.canonical.json");
const blessedPath = path.join(ROOT, "runtime", "registry", "agents.blessed.md");
const wikiRoot = path.join(ROOT, "wiki", "obsidian");
const agentNotesDir = path.join(wikiRoot, "agents");
const graphPath = path.join(wikiRoot, "AGENT_GRAPH.md");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function noteName(agentId) {
  return `agent-${agentId}`;
}

function titleCase(input) {
  return input
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function writeBlessedMarkdown(data) {
  const lines = [];
  lines.push("# V6 Blessed Agent Registry");
  lines.push("");
  lines.push(`Generated from \`runtime/registry/agents.canonical.json\` at ${data.generatedAt}.`);
  lines.push("");
  lines.push("## Counts");
  lines.push("");
  lines.push(`- Total: ${data.counts.total}`);
  lines.push(`- Core agents: ${data.counts.core_agent}`);
  lines.push(`- Platform agents: ${data.counts.platform_agent}`);
  lines.push(`- LoRA layers: ${data.counts.lora_layer}`);
  lines.push("");

  const groups = ["core_agent", "platform_agent", "lora_layer"];
  for (const group of groups) {
    const list = data.agents
      .filter((a) => a.kind === group)
      .sort((a, b) => a.agentId.localeCompare(b.agentId));
    lines.push(`## ${group}`);
    lines.push("");
    for (const a of list) {
      lines.push(`- \`${a.agentId}\` — ${a.name} (hive: ${a.hive})`);
    }
    lines.push("");
  }

  fs.writeFileSync(blessedPath, `${lines.join("\n")}\n`);
}

function writeAgentNotes(data) {
  ensureDir(agentNotesDir);
  for (const a of data.agents) {
    const file = path.join(agentNotesDir, `${noteName(a.agentId)}.md`);
    const body = [
      "---",
      `agentId: ${a.agentId}`,
      `name: ${JSON.stringify(a.name)}`,
      `kind: ${a.kind}`,
      `status: ${a.status}`,
      `hive: ${JSON.stringify(a.hive)}`,
      `sources: [${a.sources.map((s) => JSON.stringify(s)).join(", ")}]`,
      `aliases: [${a.aliases.map((s) => JSON.stringify(s)).join(", ")}]`,
      "---",
      "",
      `# ${a.name}`,
      "",
      `- Canonical ID: \`${a.agentId}\``,
      `- Kind: \`${a.kind}\``,
      `- Hive: \`${a.hive}\``,
      `- Sources: ${a.sources.map((s) => `\`${s}\``).join(", ")}`,
      "",
      "## Graph Links",
      "",
      `- [[AGENT_GRAPH]]`,
      `- [[agent-hive-${a.hive.toLowerCase().replace(/[^a-z0-9]+/g, "-")}]]`
    ].join("\n");
    fs.writeFileSync(file, `${body}\n`);
  }
}

function writeGraph(data) {
  ensureDir(wikiRoot);
  const core = data.agents.filter((a) => a.kind === "core_agent").sort((a, b) => a.agentId.localeCompare(b.agentId));
  const byHive = new Map();
  for (const a of core) {
    const h = a.hive || "unknown";
    if (!byHive.has(h)) byHive.set(h, []);
    byHive.get(h).push(a);
  }

  const lines = [];
  lines.push("---");
  lines.push(`generatedAt: ${data.generatedAt}`);
  lines.push("source: runtime/registry/agents.canonical.json");
  lines.push("---");
  lines.push("");
  lines.push("# AGENT_GRAPH");
  lines.push("");
  lines.push("## Obsidian Node Index");
  lines.push("");
  for (const [hive, agents] of [...byHive.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`### Hive: ${hive}`);
    lines.push("");
    lines.push(`- [[agent-hive-${hive.toLowerCase().replace(/[^a-z0-9]+/g, "-")}]]`);
    for (const a of agents.sort((x, y) => x.agentId.localeCompare(y.agentId))) {
      lines.push(`- [[agents/${noteName(a.agentId)}|${a.agentId}]]`);
    }
    lines.push("");
  }

  lines.push("## Graph Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  for (const [hive, agents] of [...byHive.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const hiveNode = `hive_${hive.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
    lines.push(`  ${hiveNode}[${titleCase(hive)}]`);
    for (const a of agents) {
      const agentNode = `agent_${a.agentId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      lines.push(`  ${agentNode}[${a.agentId}]`);
      lines.push(`  ${hiveNode} --> ${agentNode}`);
    }
  }
  lines.push("```");
  lines.push("");

  fs.writeFileSync(graphPath, `${lines.join("\n")}\n`);

  // Also create hive hub notes for clean Obsidian traversal.
  for (const [hive, agents] of byHive.entries()) {
    const hiveFile = path.join(wikiRoot, `${`agent-hive-${hive.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}.md`);
    const hub = [
      `# Hive ${titleCase(hive)}`,
      "",
      "- [[AGENT_GRAPH]]",
      "",
      "## Agents",
      "",
      ...agents
        .sort((a, b) => a.agentId.localeCompare(b.agentId))
        .map((a) => `- [[agents/${noteName(a.agentId)}|${a.agentId}]]`)
    ].join("\n");
    fs.writeFileSync(hiveFile, `${hub}\n`);
  }
}

function main() {
  const data = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  writeBlessedMarkdown(data);
  writeAgentNotes(data);
  writeGraph(data);
  console.log(`[agent-docs] wrote ${blessedPath}`);
  console.log(`[agent-docs] wrote ${graphPath}`);
  console.log(`[agent-docs] wrote notes for ${data.agents.length} agents`);
}

main();

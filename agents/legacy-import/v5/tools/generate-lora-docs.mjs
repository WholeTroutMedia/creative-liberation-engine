import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const canonicalPath = path.join(ROOT, "runtime", "registry", "loras.canonical.json");
const blessedPath = path.join(ROOT, "runtime", "registry", "loras.blessed.md");
const wikiRoot = path.join(ROOT, "wiki", "obsidian");
const notesDir = path.join(wikiRoot, "loras");
const graphPath = path.join(wikiRoot, "LORA_GRAPH.md");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function titleCase(input) {
  return input
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function writeBlessed(data) {
  const lines = [
    "# V6 Blessed LoRA Registry",
    "",
    `Generated from \`runtime/registry/loras.canonical.json\` at ${data.generatedAt}.`,
    "",
    "## Counts",
    "",
    `- Total: ${data.counts.total}`,
    `- Enhancement LoRA: ${data.counts.enhancement_lora}`,
    `- Runtime LoRA: ${data.counts.runtime_lora}`,
    `- Adapter: ${data.counts.adapter}`,
    `- Legacy Artifact: ${data.counts.legacy_artifact}`,
    ""
  ];
  for (const kind of ["enhancement_lora", "runtime_lora", "adapter", "legacy_artifact"]) {
    lines.push(`## ${kind}`);
    lines.push("");
    for (const l of data.loras.filter((x) => x.kind === kind).sort((a, b) => a.loraId.localeCompare(b.loraId))) {
      lines.push(`- \`${l.loraId}\` — ${l.name}`);
    }
    lines.push("");
  }
  fs.writeFileSync(blessedPath, `${lines.join("\n")}\n`);
}

function writeNotes(data) {
  ensureDir(notesDir);
  for (const l of data.loras) {
    const file = path.join(notesDir, `lora-${l.loraId}.md`);
    const body = [
      "---",
      `loraId: ${l.loraId}`,
      `name: ${JSON.stringify(l.name)}`,
      `kind: ${l.kind}`,
      `source: ${JSON.stringify(l.source)}`,
      `path: ${JSON.stringify(l.path)}`,
      `aliases: [${l.aliases.map((x) => JSON.stringify(x)).join(", ")}]`,
      "---",
      "",
      `# ${l.name}`,
      "",
      `- Canonical ID: \`${l.loraId}\``,
      `- Kind: \`${l.kind}\``,
      "",
      "## Graph Links",
      "",
      "- [[LORA_GRAPH]]",
      `- [[lora-kind-${l.kind.replace(/_/g, "-")}]]`
    ].join("\n");
    fs.writeFileSync(file, `${body}\n`);
  }
}

function writeGraph(data) {
  ensureDir(wikiRoot);
  const groups = new Map();
  for (const l of data.loras) {
    if (!groups.has(l.kind)) groups.set(l.kind, []);
    groups.get(l.kind).push(l);
  }
  const lines = [
    "---",
    `generatedAt: ${data.generatedAt}`,
    "source: runtime/registry/loras.canonical.json",
    "---",
    "",
    "# LORA_GRAPH",
    "",
    "## Obsidian Node Index",
    ""
  ];
  for (const [kind, loras] of groups.entries()) {
    lines.push(`### Kind: ${kind}`);
    lines.push("");
    lines.push(`- [[lora-kind-${kind.replace(/_/g, "-")}]]`);
    for (const l of loras.sort((a, b) => a.loraId.localeCompare(b.loraId))) {
      lines.push(`- [[loras/lora-${l.loraId}|${l.loraId}]]`);
    }
    lines.push("");
  }
  lines.push("## Graph Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  for (const [kind, loras] of groups.entries()) {
    const kindNode = `kind_${kind.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    lines.push(`  ${kindNode}[${titleCase(kind)}]`);
    for (const l of loras) {
      const node = `lora_${l.loraId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      lines.push(`  ${node}[${l.loraId}]`);
      lines.push(`  ${kindNode} --> ${node}`);
    }
  }
  lines.push("```");
  lines.push("");
  fs.writeFileSync(graphPath, `${lines.join("\n")}\n`);

  for (const [kind, loras] of groups.entries()) {
    const hub = path.join(wikiRoot, `lora-kind-${kind.replace(/_/g, "-")}.md`);
    const body = [
      `# LoRA Kind ${titleCase(kind)}`,
      "",
      "- [[LORA_GRAPH]]",
      "",
      "## LoRAs",
      "",
      ...loras.sort((a, b) => a.loraId.localeCompare(b.loraId)).map((l) => `- [[loras/lora-${l.loraId}|${l.loraId}]]`)
    ].join("\n");
    fs.writeFileSync(hub, `${body}\n`);
  }
}

function main() {
  const data = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  writeBlessed(data);
  writeNotes(data);
  writeGraph(data);
  console.log(`[lora-docs] wrote ${blessedPath}`);
  console.log(`[lora-docs] wrote ${graphPath}`);
  console.log(`[lora-docs] wrote notes for ${data.loras.length} loras`);
}

main();

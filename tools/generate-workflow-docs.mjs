import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const canonicalPath = path.join(ROOT, "runtime", "registry", "workflows.canonical.json");
const blessedPath = path.join(ROOT, "runtime", "registry", "workflows.blessed.md");
const wikiRoot = path.join(ROOT, "wiki", "obsidian");
const workflowNotesDir = path.join(wikiRoot, "workflows");
const graphPath = path.join(wikiRoot, "WORKFLOW_GRAPH.md");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function noteName(id) {
  return `workflow-${id}`;
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
    "# V6 Blessed Workflows Registry",
    "",
    `Generated from \`runtime/registry/workflows.canonical.json\` at ${data.generatedAt}.`,
    "",
    "## Counts",
    "",
    `- Total: ${data.counts.total}`,
    `- Core spine: ${data.counts.core_spine}`,
    `- Helix: ${data.counts.helix}`,
    `- Reliability: ${data.counts.reliability}`,
    `- Evaluation: ${data.counts.evaluation}`,
    `- Ops: ${data.counts.ops}`,
    ""
  ];
  for (const kind of ["core_spine", "helix", "reliability", "evaluation", "ops"]) {
    lines.push(`## ${kind}`);
    lines.push("");
    for (const w of data.workflows.filter((x) => x.kind === kind).sort((a, b) => a.workflowId.localeCompare(b.workflowId))) {
      lines.push(`- \`${w.workflowId}\` — ${w.name}`);
    }
    lines.push("");
  }
  fs.writeFileSync(blessedPath, `${lines.join("\n")}\n`);
}

function writeNotes(data) {
  ensureDir(workflowNotesDir);
  for (const w of data.workflows) {
    const file = path.join(workflowNotesDir, `${noteName(w.workflowId)}.md`);
    const content = [
      "---",
      `workflowId: ${w.workflowId}`,
      `name: ${JSON.stringify(w.name)}`,
      `kind: ${w.kind}`,
      `source: ${JSON.stringify(w.source)}`,
      `path: ${JSON.stringify(w.path)}`,
      `aliases: [${w.aliases.map((x) => JSON.stringify(x)).join(", ")}]`,
      "---",
      "",
      `# ${w.name}`,
      "",
      `- Canonical ID: \`${w.workflowId}\``,
      `- Kind: \`${w.kind}\``,
      "",
      "## Graph Links",
      "",
      "- [[WORKFLOW_GRAPH]]",
      `- [[workflow-kind-${w.kind.replace(/_/g, "-")}]]`
    ].join("\n");
    fs.writeFileSync(file, `${content}\n`);
  }
}

function writeGraph(data) {
  ensureDir(wikiRoot);
  const groups = new Map();
  for (const w of data.workflows) {
    if (!groups.has(w.kind)) groups.set(w.kind, []);
    groups.get(w.kind).push(w);
  }

  const lines = [
    "---",
    `generatedAt: ${data.generatedAt}`,
    "source: runtime/registry/workflows.canonical.json",
    "---",
    "",
    "# WORKFLOW_GRAPH",
    "",
    "## Obsidian Node Index",
    ""
  ];

  for (const [kind, workflows] of groups.entries()) {
    lines.push(`### Kind: ${kind}`);
    lines.push("");
    lines.push(`- [[workflow-kind-${kind.replace(/_/g, "-")}]]`);
    for (const w of workflows.sort((a, b) => a.workflowId.localeCompare(b.workflowId))) {
      lines.push(`- [[workflows/${noteName(w.workflowId)}|${w.workflowId}]]`);
    }
    lines.push("");
  }

  lines.push("## Graph Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  for (const [kind, workflows] of groups.entries()) {
    const kindNode = `kind_${kind.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    lines.push(`  ${kindNode}[${titleCase(kind)}]`);
    for (const w of workflows) {
      const wfNode = `wf_${w.workflowId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      lines.push(`  ${wfNode}[${w.workflowId}]`);
      lines.push(`  ${kindNode} --> ${wfNode}`);
    }
  }
  lines.push("```");
  lines.push("");

  fs.writeFileSync(graphPath, `${lines.join("\n")}\n`);

  for (const [kind, workflows] of groups.entries()) {
    const hubFile = path.join(wikiRoot, `workflow-kind-${kind.replace(/_/g, "-")}.md`);
    const hub = [
      `# Workflow Kind ${titleCase(kind)}`,
      "",
      "- [[WORKFLOW_GRAPH]]",
      "",
      "## Workflows",
      "",
      ...workflows.sort((a, b) => a.workflowId.localeCompare(b.workflowId)).map((w) => `- [[workflows/${noteName(w.workflowId)}|${w.workflowId}]]`)
    ].join("\n");
    fs.writeFileSync(hubFile, `${hub}\n`);
  }
}

function main() {
  const data = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  writeBlessed(data);
  writeNotes(data);
  writeGraph(data);
  console.log(`[workflow-docs] wrote ${blessedPath}`);
  console.log(`[workflow-docs] wrote ${graphPath}`);
  console.log(`[workflow-docs] wrote notes for ${data.workflows.length} workflows`);
}

main();

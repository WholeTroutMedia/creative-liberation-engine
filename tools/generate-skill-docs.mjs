import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const canonicalPath = path.join(ROOT, "runtime", "registry", "skills.canonical.json");
const blessedPath = path.join(ROOT, "runtime", "registry", "skills.blessed.md");
const wikiRoot = path.join(ROOT, "wiki", "obsidian");
const skillNotesDir = path.join(wikiRoot, "skills");
const graphPath = path.join(wikiRoot, "SKILL_GRAPH.md");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function noteName(skillId) {
  return `skill-${skillId}`;
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
    "# V6 Blessed Skills Registry",
    "",
    `Generated from \`runtime/registry/skills.canonical.json\` at ${data.generatedAt}.`,
    "",
    "## Counts",
    "",
    `- Total: ${data.counts.total}`,
    `- Core skills: ${data.counts.core_skill}`,
    `- Next skills: ${data.counts.next_skill}`,
    ""
  ];
  for (const group of ["core_skill", "next_skill"]) {
    lines.push(`## ${group}`);
    lines.push("");
    for (const s of data.skills.filter((x) => x.kind === group).sort((a, b) => a.skillId.localeCompare(b.skillId))) {
      lines.push(`- \`${s.skillId}\` — ${s.name}`);
    }
    lines.push("");
  }
  fs.writeFileSync(blessedPath, `${lines.join("\n")}\n`);
}

function writeNotes(data) {
  ensureDir(skillNotesDir);
  for (const s of data.skills) {
    const file = path.join(skillNotesDir, `${noteName(s.skillId)}.md`);
    const content = [
      "---",
      `skillId: ${s.skillId}`,
      `name: ${JSON.stringify(s.name)}`,
      `kind: ${s.kind}`,
      `source: ${JSON.stringify(s.source)}`,
      `path: ${JSON.stringify(s.path)}`,
      `agentCallable: ${s.agentCallable}`,
      `aliases: [${s.aliases.map((x) => JSON.stringify(x)).join(", ")}]`,
      "---",
      "",
      `# ${s.name}`,
      "",
      `- Canonical ID: \`${s.skillId}\``,
      `- Kind: \`${s.kind}\``,
      `- Callable: \`${s.agentCallable}\``,
      "",
      "## Graph Links",
      "",
      "- [[SKILL_GRAPH]]",
      `- [[skill-kind-${s.kind.replace(/_/g, "-")}]]`
    ].join("\n");
    fs.writeFileSync(file, `${content}\n`);
  }
}

function writeGraph(data) {
  ensureDir(wikiRoot);
  const groups = new Map();
  for (const s of data.skills) {
    const k = s.kind;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  const lines = [
    "---",
    `generatedAt: ${data.generatedAt}`,
    "source: runtime/registry/skills.canonical.json",
    "---",
    "",
    "# SKILL_GRAPH",
    "",
    "## Obsidian Node Index",
    ""
  ];
  for (const [kind, skills] of groups.entries()) {
    lines.push(`### Kind: ${kind}`);
    lines.push("");
    lines.push(`- [[skill-kind-${kind.replace(/_/g, "-")}]]`);
    for (const s of skills.sort((a, b) => a.skillId.localeCompare(b.skillId))) {
      lines.push(`- [[skills/${noteName(s.skillId)}|${s.skillId}]]`);
    }
    lines.push("");
  }

  lines.push("## Graph Diagram");
  lines.push("");
  lines.push("```mermaid");
  lines.push("graph TD");
  for (const [kind, skills] of groups.entries()) {
    const kindNode = `kind_${kind.replace(/[^a-zA-Z0-9]+/g, "_")}`;
    lines.push(`  ${kindNode}[${titleCase(kind)}]`);
    for (const s of skills) {
      const skillNode = `skill_${s.skillId.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      lines.push(`  ${skillNode}[${s.skillId}]`);
      lines.push(`  ${kindNode} --> ${skillNode}`);
    }
  }
  lines.push("```");
  lines.push("");

  fs.writeFileSync(graphPath, `${lines.join("\n")}\n`);

  for (const [kind, skills] of groups.entries()) {
    const hubFile = path.join(wikiRoot, `skill-kind-${kind.replace(/_/g, "-")}.md`);
    const hub = [
      `# Skill Kind ${titleCase(kind)}`,
      "",
      "- [[SKILL_GRAPH]]",
      "",
      "## Skills",
      "",
      ...skills.sort((a, b) => a.skillId.localeCompare(b.skillId)).map((s) => `- [[skills/${noteName(s.skillId)}|${s.skillId}]]`)
    ].join("\n");
    fs.writeFileSync(hubFile, `${hub}\n`);
  }
}

function main() {
  const data = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  writeBlessed(data);
  writeNotes(data);
  writeGraph(data);
  console.log(`[skill-docs] wrote ${blessedPath}`);
  console.log(`[skill-docs] wrote ${graphPath}`);
  console.log(`[skill-docs] wrote notes for ${data.skills.length} skills`);
}

main();

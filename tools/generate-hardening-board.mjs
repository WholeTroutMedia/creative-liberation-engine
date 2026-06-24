import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const hardeningDir = path.join(ROOT, "runtime", "hardening");
const boardPath = path.join(ROOT, "runtime", "hardening", "HARDENING_STATUS.md");
const wikiPath = path.join(ROOT, "wiki", "obsidian", "HARDENING_GRAPH.md");

const files = [
  "execution.hardening.json",
  "modelops.hardening.json",
  "memory.hardening.json",
  "security.hardening.json",
  "release.hardening.json",
  "reliability.hardening.json"
];

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(hardeningDir, name), "utf8"));
}

function summarizeControls(controls) {
  return Object.entries(controls)
    .map(([k, v]) => `\`${k}\`=${v ? "on" : "off"}`)
    .join(", ");
}

function writeBoard(rows) {
  const lines = [
    "# V6 Hardening Status",
    "",
    `Generated at ${new Date().toISOString()}.`,
    "",
    "| Helix | Status | Controls |",
    "|---|---|---|"
  ];
  for (const row of rows) {
    lines.push(`| \`${row.helixId}\` | \`${row.status}\` | ${summarizeControls(row.controls)} |`);
  }
  lines.push("");
  lines.push("All six hardening helices are required to remain `hardened`.");
  lines.push("");
  fs.writeFileSync(boardPath, `${lines.join("\n")}\n`);
}

function writeGraph(rows) {
  const lines = [
    "# HARDENING_GRAPH",
    "",
    "- [[runtime/hardening/HARDENING_STATUS|Hardening Status Board]]",
    "",
    "```mermaid",
    "graph TD",
    "  H[V6 Hardening]"
  ];
  for (const row of rows) {
    const id = row.helixId.replace(/[^a-zA-Z0-9]+/g, "_");
    lines.push(`  ${id}[${row.helixId}]`);
    lines.push(`  H --> ${id}`);
  }
  lines.push("```");
  lines.push("");
  fs.writeFileSync(wikiPath, `${lines.join("\n")}\n`);
}

function main() {
  const rows = files.map(readJson);
  writeBoard(rows);
  writeGraph(rows);
  console.log(`[hardening-board] wrote ${boardPath}`);
  console.log(`[hardening-board] wrote ${wikiPath}`);
}

main();

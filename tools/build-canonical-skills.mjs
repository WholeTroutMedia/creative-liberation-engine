import fs from "node:fs";
import path from "node:path";

const V6_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const V5_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const MATRIX_PATH = path.join(V6_ROOT, "docs", "SKILL_TARGET_MATRIX.md");
const MATRIX_PATH_B2 = path.join(V6_ROOT, "docs", "SKILL_TARGET_MATRIX_BATCH2.md");

const canonicalPath = path.join(V6_ROOT, "runtime", "registry", "skills.canonical.json");
const reportPath = path.join(V6_ROOT, "runtime", "registry", "skills.canonical.report.json");

const requiredSkillGroups = [
  ["deploy", "deploy-mode"],
  ["design", "design-mode"],
  ["design-ingest"],
  ["ideate", "ideate-mode"],
  ["plan", "plan-mode"],
  ["scribe", "scribe-memory"],
  ["ship", "ship-mode"],
  ["spitball", "spitball-mode"],
  ["universal-prompter", "universal-prompt-engineer"],
  ["validate", "validate-mode"],
  ["incident-commander"],
  ["eval-harness"],
  ["route-governor"],
  ["memory-curator"],
  ["security-hardener"],
  ["cost-arbitrage"],
  ["workflow-synthesizer"],
  ["skills-linter"],
  ["agent-observability"],
  ["migration-operator"]
];

function extractBatch35RequiredGroups() {
  const raw = fs.readFileSync(MATRIX_PATH, "utf8");
  const ids = [...raw.matchAll(/^\|\s*`([a-z0-9]+(?:-[a-z0-9]+)*)`\s*\|/gm)]
    .map((m) => m[1]);
  const unique = [...new Set(ids)];
  if (unique.length !== 35) {
    throw new Error(`Skill target matrix appears incomplete: expected 35 skill IDs, found ${unique.length}`);
  }
  return unique.map((id) => [id]);
}

function extractBatch35B2RequiredGroups() {
  const raw = fs.readFileSync(MATRIX_PATH_B2, "utf8");
  const ids = [...raw.matchAll(/^\|\s*`([a-z0-9]+(?:-[a-z0-9]+)*)`\s*\|/gm)]
    .map((m) => m[1]);
  const unique = [...new Set(ids)];
  if (unique.length !== 35) {
    throw new Error(`Skill target matrix B2 appears incomplete: expected 35 skill IDs, found ${unique.length}`);
  }
  return unique.map((id) => [id]);
}

function normalizeId(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

function firstParagraph(raw) {
  const body = raw.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
  return (body.split(/\r?\n\r?\n/)[0] || "").replace(/^#+\s*/, "").trim().slice(0, 500);
}

function walkSkillFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.name === "SKILL.md") {
        out.push(full);
      }
    }
  }
  return out;
}

function sourceType(filePath) {
  const n = filePath.replace(/\\/g, "/");
  if (n.includes("/creative-liberation-engine/agents/skills-next/")) return "v6-next";
  return "v5-core";
}

function main() {
  const batch35Groups = extractBatch35RequiredGroups();
  const batch35B2Groups = extractBatch35B2RequiredGroups();
  const allRequiredGroups = [...requiredSkillGroups, ...batch35Groups, ...batch35B2Groups];
  const v5Skills = walkSkillFiles(path.join(V5_ROOT, ".agents", "skills"));
  const v6Skills = walkSkillFiles(path.join(V6_ROOT, "agents", "skills-next"));
  const files = [...v5Skills, ...v6Skills];

  const map = new Map();
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const fm = parseFrontmatter(raw);
    const dirName = path.basename(path.dirname(file));
    const declaredName = (fm.name || dirName).replace(/^["']|["']$/g, "");
    const skillId = normalizeId(declaredName);
    const entry = {
      skillId,
      name: declaredName,
      kind: sourceType(file) === "v5-core" ? "core_skill" : "next_skill",
      status: "active",
      source: sourceType(file),
      path: path.relative(V6_ROOT, file).replace(/\\/g, "/"),
      summary: (fm.description || firstParagraph(raw) || "Skill definition").replace(/^["']|["']$/g, ""),
      agentCallable: String(fm.agentCallable || "").toLowerCase() === "true",
      aliases: [declaredName]
    };
    if (!map.has(skillId)) {
      map.set(skillId, entry);
      continue;
    }
    const prev = map.get(skillId);
    // Prefer v6 next version details when duplicate ids exist.
    const preferred = entry.source === "v6-next" ? entry : prev;
    const merged = {
      ...preferred,
      aliases: [...new Set([...(prev.aliases || []), ...entry.aliases])],
      source: prev.source === entry.source ? prev.source : `${prev.source}+${entry.source}`
    };
    map.set(skillId, merged);
  }

  const skills = [...map.values()].sort((a, b) => a.skillId.localeCompare(b.skillId));
  const idSet = new Set(skills.map((s) => s.skillId));
  const missingRequiredGroups = allRequiredGroups
    .filter((group) => !group.some((id) => idSet.has(id)))
    .map((group) => group.join(" | "));

  const duplicates = [];
  const seen = new Set();
  for (const s of skills) {
    if (seen.has(s.skillId)) duplicates.push(s.skillId);
    seen.add(s.skillId);
  }

  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    generatedFrom: ["v5/.agents/skills", "v6/agents/skills-next"],
    counts: {
      total: skills.length,
      core_skill: skills.filter((s) => s.kind === "core_skill").length,
      next_skill: skills.filter((s) => s.kind === "next_skill").length
    },
    skills
  };

  const report = {
    generatedAt: payload.generatedAt,
    duplicates,
    missingRequiredGroups
  };

  fs.writeFileSync(canonicalPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[canonical-skills] total=${payload.counts.total}`);
  console.log(`[canonical-skills] core=${payload.counts.core_skill} next=${payload.counts.next_skill}`);
  console.log(`[canonical-skills] duplicates=${report.duplicates.length}`);
  console.log(`[canonical-skills] missing_required_groups=${report.missingRequiredGroups.length}`);
}

main();

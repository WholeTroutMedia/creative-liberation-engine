import fs from "node:fs";
import path from "node:path";

const V6_ROOT = path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine");
const LEGACY_ROOTS = [
  { tag: "v1", root: path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/agentic-studio-creative-liberation-engine") },
  { tag: "v2", root: path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v2") },
  { tag: "v3", root: path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v3") },
  { tag: "v4", root: path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v4") },
  { tag: "v5", root: path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine") }
];

const V6_AGENTS_ROOT = path.join(V6_ROOT, "agents");
const V6_IMPORT_ROOT = path.join(V6_AGENTS_ROOT, "legacy-import");
const V6_REGISTRY_ROOT = path.join(V6_ROOT, "runtime", "registry");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function walkFiles(root, matcher) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        const dir = entry.name.toLowerCase();
        if (dir === "node_modules" || dir === ".git" || dir === "dist" || dir === "build" || dir === ".next") {
          continue;
        }
        stack.push(full);
      } else if (matcher(full)) {
        out.push(full);
      }
    }
  }
  return out;
}

function relUnix(base, p) {
  return path.relative(base, p).replace(/\\/g, "/");
}

function copyPreserveTree(srcRoot, files, dstRoot) {
  for (const src of files) {
    const rel = path.relative(srcRoot, src);
    const dst = path.join(dstRoot, rel);
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
  }
}

function parseFrontmatter(md) {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const map = {};
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const val = line.slice(i + 1).trim();
    map[key] = val;
  }
  return map;
}

function firstParagraph(md) {
  const body = md.replace(/^---[\s\S]*?---\r?\n?/, "").trim();
  const p = body.split(/\r?\n\r?\n/)[0] ?? "";
  return p.replace(/^#+\s*/, "").trim().slice(0, 400);
}

function normalizeSkillId(nameOrPath) {
  return nameOrPath.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function extractReadableName(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function isAgentFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  return (
    normalized.includes("/agents/") ||
    normalized.includes("agent-registry") ||
    normalized.endsWith(".agent-registry.json") ||
    name === "agent.json" ||
    name === "agents.md" ||
    name.endsWith("_agent.md") ||
    name === "agent.ts" ||
    name === "agent.py"
  );
}

function isWorkflowFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  return (
    normalized.includes("/workflows/") ||
    normalized.includes("/workflow/") ||
    name.includes("workflow") ||
    name.includes("handoff") ||
    name.includes("dispatch")
  ) && [".md", ".json", ".yaml", ".yml"].includes(path.extname(filePath).toLowerCase());
}

function isSkillFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  return (
    normalized.includes("/skills/") ||
    normalized.includes("skill-library") ||
    name === "skill.md" ||
    name.includes("skill")
  ) && [".md", ".json", ".yaml", ".yml"].includes(path.extname(filePath).toLowerCase());
}

function isLoraFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const name = path.basename(filePath).toLowerCase();
  return (
    normalized.includes("lora") ||
    normalized.includes("qlora") ||
    normalized.includes("peft") ||
    normalized.includes("adapter")
  ) && !name.endsWith(".png") && !name.endsWith(".jpg") && !name.endsWith(".jpeg");
}

function classifyStatus(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("/_planned/") || lower.includes("template")) return "planned";
  if (lower.includes("archive") || lower.includes("legacy")) return "legacy";
  return "active";
}

function sourceFromTag(tag) {
  if (tag === "v5") return "v5-import";
  if (tag === "v6") return "v6";
  return "legacy-import";
}

function buildCrossVersionRegistries() {
  const agents = [];
  const skills = [];
  const workflows = [];
  const loras = [];

  const seenAgentIds = new Set();
  const seenSkillIds = new Set();
  const seenWorkflowIds = new Set();
  const seenLoraIds = new Set();

  for (const lane of LEGACY_ROOTS) {
    if (!fs.existsSync(lane.root)) continue;
    const files = walkFiles(lane.root, () => true);
    const importRoot = path.join(V6_IMPORT_ROOT, lane.tag);
    const importCandidates = files.filter((f) => isAgentFile(f) || isSkillFile(f) || isWorkflowFile(f) || isLoraFile(f));
    copyPreserveTree(lane.root, importCandidates, importRoot);

    for (const file of files) {
      const importedPath = path.join(importRoot, path.relative(lane.root, file));
      const relPath = relUnix(V6_ROOT, importedPath);
      if (isAgentFile(file)) {
        const name = extractReadableName(file);
        const agentId = normalizeSkillId(name);
        if (!seenAgentIds.has(agentId)) {
          seenAgentIds.add(agentId);
          agents.push({
            agentId,
            name,
            role: `Imported ${lane.tag} agent artifact`,
            status: classifyStatus(file),
            source: sourceFromTag(lane.tag),
            capabilities: [lane.tag],
            hive: "legacy"
          });
        }
      }

      if (isSkillFile(file)) {
        const name = extractReadableName(file);
        const skillId = normalizeSkillId(name);
        if (!seenSkillIds.has(skillId)) {
          seenSkillIds.add(skillId);
          skills.push({
            skillId,
            name,
            path: relPath,
            source: sourceFromTag(lane.tag),
            summary: `Imported ${lane.tag} skill artifact`,
            agentCallable: false
          });
        }
      }

      if (isWorkflowFile(file)) {
        const name = extractReadableName(file);
        const workflowId = normalizeSkillId(name);
        if (!seenWorkflowIds.has(workflowId)) {
          seenWorkflowIds.add(workflowId);
          workflows.push({
            workflowId,
            name,
            path: relPath,
            source: sourceFromTag(lane.tag),
            summary: `Imported ${lane.tag} workflow artifact`
          });
        }
      }

      if (isLoraFile(file)) {
        const loraName = extractReadableName(file);
        const loraId = normalizeSkillId(`${lane.tag}-${loraName}`);
        if (!seenLoraIds.has(loraId)) {
          seenLoraIds.add(loraId);
          loras.push({
            loraId,
            name: loraName,
            path: relPath,
            source: sourceFromTag(lane.tag),
            status: classifyStatus(file)
          });
        }
      }
    }
  }

  const v6SkillFiles = walkFiles(path.join(V6_ROOT, "agents", "skills-next"), (f) => f.endsWith("SKILL.md"));
  for (const file of v6SkillFiles) {
    const md = fs.readFileSync(file, "utf8");
    const fm = parseFrontmatter(md);
    const name = (fm.name || path.basename(path.dirname(file))).replace(/^["']|["']$/g, "");
    const skillId = normalizeSkillId(name);
    if (seenSkillIds.has(skillId)) continue;
    seenSkillIds.add(skillId);
    skills.push({
      skillId,
      name,
      path: relUnix(V6_ROOT, file),
      source: "v6",
      summary: (fm.description || firstParagraph(md) || "V6 skill").replace(/^["']|["']$/g, ""),
      agentCallable: String(fm.agentCallable || "").toLowerCase() === "true"
    });
  }

  const v6WorkflowFiles = walkFiles(path.join(V6_ROOT, "agents", "workflows-next"), (f) => f.endsWith(".md"));
  for (const file of v6WorkflowFiles) {
    const name = path.basename(file, ".md");
    const workflowId = normalizeSkillId(name);
    if (seenWorkflowIds.has(workflowId)) continue;
    seenWorkflowIds.add(workflowId);
    const md = fs.readFileSync(file, "utf8");
    workflows.push({
      workflowId,
      name,
      path: relUnix(V6_ROOT, file),
      source: "v6",
      summary: firstParagraph(md) || "V6 workflow"
    });
  }

  agents.sort((a, b) => a.agentId.localeCompare(b.agentId));
  skills.sort((a, b) => a.skillId.localeCompare(b.skillId));
  workflows.sort((a, b) => a.workflowId.localeCompare(b.workflowId));
  loras.sort((a, b) => a.loraId.localeCompare(b.loraId));

  return {
    agentRegistry: { version: "v6.0", agents },
    skillRegistry: { version: "v6.0", skills },
    workflowRegistry: { version: "v6.0", workflows },
    loraRegistry: { version: "v6.0", loras }
  };
}

function main() {
  ensureDir(V6_AGENTS_ROOT);
  ensureDir(V6_IMPORT_ROOT);
  ensureDir(V6_REGISTRY_ROOT);

  const { agentRegistry, skillRegistry, workflowRegistry, loraRegistry } = buildCrossVersionRegistries();

  fs.writeFileSync(path.join(V6_REGISTRY_ROOT, "agents.registry.json"), `${JSON.stringify(agentRegistry, null, 2)}\n`);
  fs.writeFileSync(path.join(V6_REGISTRY_ROOT, "skills.registry.json"), `${JSON.stringify(skillRegistry, null, 2)}\n`);
  fs.writeFileSync(path.join(V6_REGISTRY_ROOT, "workflows.registry.json"), `${JSON.stringify(workflowRegistry, null, 2)}\n`);
  fs.writeFileSync(path.join(V6_REGISTRY_ROOT, "loras.registry.json"), `${JSON.stringify(loraRegistry, null, 2)}\n`);

  console.log("[V6 bootstrap] Imported skills:", skillRegistry.skills.length);
  console.log("[V6 bootstrap] Imported workflows:", workflowRegistry.workflows.length);
  console.log("[V6 bootstrap] Agent registry entries:", agentRegistry.agents.length);
  console.log("[V6 bootstrap] LoRA registry entries:", loraRegistry.loras.length);
}

main();

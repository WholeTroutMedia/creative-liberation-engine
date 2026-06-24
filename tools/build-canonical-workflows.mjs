import fs from "node:fs";
import path from "node:path";

const V6_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const V5_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";

const canonicalPath = path.join(V6_ROOT, "runtime", "registry", "workflows.canonical.json");
const reportPath = path.join(V6_ROOT, "runtime", "registry", "workflows.canonical.report.json");
const matrixPath = path.join(V6_ROOT, "docs", "WORKFLOW_TARGET_MATRIX.md");

function normalizeId(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function readFirstParagraph(raw) {
  const body = raw.trim();
  return (body.split(/\r?\n\r?\n/)[0] || "").replace(/^#+\s*/, "").trim().slice(0, 500);
}

function walkMarkdown(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.toLowerCase().endsWith(".md")) out.push(full);
    }
  }
  return out;
}

function extractRequiredGroups() {
  const raw = fs.readFileSync(matrixPath, "utf8");
  const ids = [...raw.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)*)`/g)].map((m) => m[1]);
  return [...new Set(ids)].map((id) => [id]);
}

function classifyKind(id) {
  if (["ideate", "plan", "ship", "validate"].includes(id)) return "core_spine";
  if (id.startsWith("helix-") || id === "ipsv-spine") return "helix";
  if (id.startsWith("eval-")) return "evaluation";
  if (["ram-crew", "auto-loop", "shadow-qa", "surgical", "capability-reload"].includes(id)) return "reliability";
  return "ops";
}

function main() {
  const requiredGroups = extractRequiredGroups();
  const map = new Map();

  const v5Core = walkMarkdown(path.join(V5_ROOT, ".agents", "workflows"));
  const v6Next = walkMarkdown(path.join(V6_ROOT, "agents", "workflows-next"));

  for (const file of v5Core) {
    const name = path.basename(file, ".md");
    const id = normalizeId(name);
    const raw = fs.readFileSync(file, "utf8");
    map.set(id, {
      workflowId: id,
      name,
      kind: classifyKind(id),
      status: "active",
      source: "v5-core",
      path: path.relative(V6_ROOT, file).replace(/\\/g, "/"),
      summary: readFirstParagraph(raw) || "Workflow definition",
      aliases: [name]
    });
  }

  for (const file of v6Next) {
    const name = path.basename(file, ".md");
    const id = normalizeId(name);
    const raw = fs.readFileSync(file, "utf8");
    if (map.has(id)) {
      const prev = map.get(id);
      map.set(id, {
        ...prev,
        source: `${prev.source}+v6`,
        path: path.relative(V6_ROOT, file).replace(/\\/g, "/"),
        summary: readFirstParagraph(raw) || prev.summary,
        aliases: [...new Set([...(prev.aliases || []), name])]
      });
    } else {
      map.set(id, {
        workflowId: id,
        name,
        kind: classifyKind(id),
        status: "active",
        source: "v6",
        path: path.relative(V6_ROOT, file).replace(/\\/g, "/"),
        summary: readFirstParagraph(raw) || "Workflow definition",
        aliases: [name]
      });
    }
  }

  const workflows = [...map.values()].sort((a, b) => a.workflowId.localeCompare(b.workflowId));
  const idSet = new Set(workflows.map((w) => w.workflowId));
  const missingRequiredGroups = requiredGroups
    .filter((group) => !group.some((id) => idSet.has(id)))
    .map((group) => group.join(" | "));

  const duplicates = [];
  const seen = new Set();
  for (const w of workflows) {
    if (seen.has(w.workflowId)) duplicates.push(w.workflowId);
    seen.add(w.workflowId);
  }

  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    generatedFrom: ["v5/.agents/workflows", "v6/agents/workflows-next", "docs/WORKFLOW_TARGET_MATRIX.md"],
    counts: {
      total: workflows.length,
      core_spine: workflows.filter((w) => w.kind === "core_spine").length,
      helix: workflows.filter((w) => w.kind === "helix").length,
      reliability: workflows.filter((w) => w.kind === "reliability").length,
      evaluation: workflows.filter((w) => w.kind === "evaluation").length,
      ops: workflows.filter((w) => w.kind === "ops").length
    },
    workflows
  };

  const report = {
    generatedAt: payload.generatedAt,
    duplicates,
    missingRequiredGroups
  };

  fs.writeFileSync(canonicalPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[canonical-workflows] total=${payload.counts.total}`);
  console.log(`[canonical-workflows] missing_required_groups=${report.missingRequiredGroups.length}`);
  console.log(`[canonical-workflows] duplicates=${report.duplicates.length}`);
}

main();

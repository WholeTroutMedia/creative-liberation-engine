import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const sourcePath = path.join(ROOT, "runtime", "registry", "loras.registry.json");
const canonicalPath = path.join(ROOT, "runtime", "registry", "loras.canonical.json");
const reportPath = path.join(ROOT, "runtime", "registry", "loras.canonical.report.json");

const requiredLoraGroups = [
  ["vision"],
  ["audio"],
  ["spatial"],
  ["lora-injector"],
  ["lora-agents"]
];

function isNoisePath(p) {
  return /venv|\.venv|site-packages|__pycache__|dist-info|tests\/|\/licenses\/|\.pyc$|\/colorama\//i.test(p);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function classifyKind(item) {
  const id = item.loraId.toLowerCase();
  const p = item.path.toLowerCase();
  if (id.includes("vision") || id.includes("audio") || id.includes("spatial") || id.includes("syntax") || id.includes("sift")) {
    return "enhancement_lora";
  }
  if (id.includes("lora-injector") || id.includes("lora-agents") || p.includes("/packages/genkit/src/")) {
    return "runtime_lora";
  }
  if (id.includes("adapter") || p.includes("/adapters/")) {
    return "adapter";
  }
  return "legacy_artifact";
}

function main() {
  const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const kept = source.loras.filter((x) => !isNoisePath(x.path));

  const map = new Map();
  for (const item of kept) {
    const baseId = normalizeName(item.name);
    const canonicalId = normalizeName(baseId.replace(/^v[0-9]+-/, ""));
    if (!map.has(canonicalId)) {
      map.set(canonicalId, {
        loraId: canonicalId,
        name: item.name,
        kind: classifyKind(item),
        status: "active",
        source: item.source,
        path: item.path,
        aliases: [item.loraId]
      });
    } else {
      const row = map.get(canonicalId);
      if (!row.aliases.includes(item.loraId)) row.aliases.push(item.loraId);
      if (row.source !== item.source) row.source = `${row.source}+${item.source}`;
      // Prefer v5 path when available.
      if (item.source === "v5-import") row.path = item.path;
    }
  }

  const loras = [...map.values()].sort((a, b) => a.loraId.localeCompare(b.loraId));
  const idSet = new Set(loras.map((x) => x.loraId));
  const missingRequiredGroups = requiredLoraGroups
    .filter((group) => !group.some((id) => idSet.has(id)))
    .map((group) => group.join(" | "));

  const duplicates = [];
  const seen = new Set();
  for (const x of loras) {
    if (seen.has(x.loraId)) duplicates.push(x.loraId);
    seen.add(x.loraId);
  }

  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    generatedFrom: ["runtime/registry/loras.registry.json"],
    counts: {
      total: loras.length,
      enhancement_lora: loras.filter((x) => x.kind === "enhancement_lora").length,
      runtime_lora: loras.filter((x) => x.kind === "runtime_lora").length,
      adapter: loras.filter((x) => x.kind === "adapter").length,
      legacy_artifact: loras.filter((x) => x.kind === "legacy_artifact").length
    },
    loras
  };

  const report = {
    generatedAt: payload.generatedAt,
    removedAsNoise: source.loras.length - kept.length,
    duplicates,
    missingRequiredGroups
  };

  fs.writeFileSync(canonicalPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[canonical-loras] total=${payload.counts.total} removed_noise=${report.removedAsNoise}`);
  console.log(`[canonical-loras] missing_required_groups=${report.missingRequiredGroups.length}`);
  console.log(`[canonical-loras] duplicates=${report.duplicates.length}`);
}

main();

import fs from "node:fs";
import path from "node:path";

const V6_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const V5_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";

const outFile = path.join(V6_ROOT, "runtime", "registry", "agents.canonical.json");
const reportFile = path.join(V6_ROOT, "runtime", "registry", "agents.canonical.report.json");

const architectureCore = [
  "ATHENA", "IRIS", "VERA", "BUDDHA", "COSMOS", "LEONARDO", "SAGE", "SUN_TZU", "WARREN_BUFFETT",
  "SCRIBE", "ARCHON", "COMPASS", "SENTINEL", "PROOF", "HARBOR", "ATLAS", "CONTROL_ROOM", "SHOWRUNNER",
  "GRAPHICS", "SIGNAL", "STUDIO", "SYSTEMS", "KEEPER", "ARCH", "CODEX", "ECHO", "LEX", "LANGUAGE",
  "MATH", "COMET", "AURORA", "BOLT", "COMMERCE", "BROWSER", "RELAY", "SWITCHBOARD", "RAM_CREW"
];

const requiredCoreIdentityGroups = [
  ["athena", "strata"],
  ["vera", "logd"],
  ["iris", "prism"],
  ["compass", "northstar"],
  ["atlas", "mapd"],
  ["switchboard", "muxd"],
  ["relay", "relayd"],
  ["keeper", "vault"],
  ["browser", "navd"],
  ["sentinel", "watchd"],
  ["archon"],
  ["proof"],
  ["harbor"],
  ["lex"],
  ["ram-crew"],
  ["comet"],
  ["aurora"],
  ["bolt"],
  ["commerce"],
  ["studio"],
  ["systems"],
  ["showrunner"],
  ["signal"],
  ["graphics"],
  ["codex"],
  ["echo"],
  ["arch"],
  ["sage"],
  ["cosmos"],
  ["leonardo"],
  ["sun-tzu"],
  ["warren-buffett"],
  ["scribe"]
];

function toId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readPackageRegistry() {
  const filePath = path.join(V5_ROOT, "packages", "agents", "src", "registry.ts");
  const raw = fs.readFileSync(filePath, "utf8");
  const ids = [...raw.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
  return ids;
}

function flattenAgentStatus(statusJson) {
  const out = [];
  for (const group of Object.values(statusJson.agents ?? {})) {
    for (const [name, entry] of Object.entries(group)) {
      out.push({ name, entry });
    }
  }
  return out;
}

function main() {
  const status = loadJson(path.join(V5_ROOT, ".engine", "agents", ".agent-status.json"));
  const packageIds = readPackageRegistry();

  const canonical = new Map();
  const sourcesSeen = {};

  function upsert(rawName, kind, source, hive = "unknown") {
    const normalized = rawName.replace(/_/g, "-");
    const id = toId(normalized);
    if (!canonical.has(id)) {
      canonical.set(id, {
        agentId: id,
        name: rawName,
        kind,
        status: "active",
        hive,
        sources: [source],
        aliases: [rawName]
      });
      return;
    }
    const row = canonical.get(id);
    if (!row.sources.includes(source)) row.sources.push(source);
    if (!row.aliases.includes(rawName)) row.aliases.push(rawName);
    const precedence = { core_agent: 3, lora_layer: 2, platform_agent: 1, legacy: 0 };
    if ((precedence[kind] ?? 0) > (precedence[row.kind] ?? 0)) {
      row.kind = kind;
    }
    if (row.hive === "unknown" && hive !== "unknown") row.hive = hive;
  }

  for (const name of architectureCore) {
    upsert(name, "core_agent", "architecture_v5", "core");
  }

  for (const { name, entry } of flattenAgentStatus(status)) {
    const type = String(entry.type || "").toLowerCase();
    const kind = type === "lora" ? "lora_layer" : "core_agent";
    upsert(name, kind, "engine_status_v5", String(entry.hive || entry.part_of || "unknown"));
  }

  for (const id of packageIds) {
    upsert(id, "platform_agent", "package_registry_v5", "platform");
  }

  const agents = [...canonical.values()]
    .sort((a, b) => a.agentId.localeCompare(b.agentId));

  const duplicatesByAlias = {};
  for (const row of agents) {
    for (const alias of row.aliases) {
      const key = toId(alias);
      duplicatesByAlias[key] = duplicatesByAlias[key] || [];
      duplicatesByAlias[key].push(row.agentId);
    }
  }
  const conflicts = Object.entries(duplicatesByAlias).filter(([, ids]) => new Set(ids).size > 1);
  const idSet = new Set(agents.map((x) => x.agentId));
  const missingRequiredGroups = requiredCoreIdentityGroups
    .filter((group) => !group.some((id) => idSet.has(id)))
    .map((group) => group.join(" | "));

  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    generatedFrom: ["architecture_v5", "engine_status_v5", "package_registry_v5"],
    counts: {
      total: agents.length,
      core_agent: agents.filter((x) => x.kind === "core_agent").length,
      platform_agent: agents.filter((x) => x.kind === "platform_agent").length,
      lora_layer: agents.filter((x) => x.kind === "lora_layer").length
    },
    agents
  };

  const report = {
    generatedAt: payload.generatedAt,
    conflicts,
    missingRequiredGroups,
    missingFromArchitecture: agents.filter((x) => x.sources.includes("engine_status_v5") && !x.sources.includes("architecture_v5")).map((x) => x.agentId),
    packageOnly: agents.filter((x) => x.sources.length === 1 && x.sources[0] === "package_registry_v5").map((x) => x.agentId)
  };

  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[canonical-agents] total=${payload.counts.total}`);
  console.log(`[canonical-agents] core=${payload.counts.core_agent} platform=${payload.counts.platform_agent} lora=${payload.counts.lora_layer}`);
  console.log(`[canonical-agents] conflicts=${report.conflicts.length}`);
  console.log(`[canonical-agents] missing_required_groups=${report.missingRequiredGroups.length}`);
}

main();

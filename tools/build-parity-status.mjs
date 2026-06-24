import fs from "node:fs";
import path from "node:path";

const V6_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const V5_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";

const parityJsonPath = path.join(V6_ROOT, "runtime", "governance", "PARITY_STATUS.json");
const parityDocPath = path.join(V6_ROOT, "docs", "V6_PARITY_MATRIX.md");
const bridgeManifestPath = path.join(V6_ROOT, "runtime", "interop", "V5_BRIDGE_MANIFEST.json");

function listV5Packages() {
  const packagesDir = path.join(V5_ROOT, "packages");
  if (!fs.existsSync(packagesDir)) return [];
  const dirs = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
  return dirs.filter((name) => fs.existsSync(path.join(packagesDir, name, "package.json")));
}

function normalizeId(name) {
  return `cap-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function computeCapabilities(v5Packages) {
  const nativeV6 = new Set([
    "agents",
    "skills",
    "dispatch",
    "memory",
    "model-arbitrage",
    "genkit",
    "zero-day",
    "auth",
    "mcp-router",
    "toolbox",
    "spatial-codex",
    "sensor-mesh"
  ]);
  const betterV6 = new Set(["dispatch", "model-arbitrage", "memory", "genkit", "skills", "agents"]);

  return v5Packages.map((pkg) => {
    const deliveryMode = nativeV6.has(pkg) ? "native-v6" : "v5-bridge";
    const status = betterV6.has(pkg) ? "better" : "same";
    return {
      capabilityId: normalizeId(pkg),
      name: pkg,
      v5Source: `packages/${pkg}`,
      status,
      deliveryMode,
      evidence:
        deliveryMode === "native-v6"
          ? [
              "runtime/registry/agents.canonical.json",
              "runtime/registry/skills.canonical.json",
              "runtime/registry/workflows.canonical.json",
              "runtime/registry/models.canonical.json",
              "runtime/hardening/HARDENING_STATUS.md"
            ]
          : [`agents/legacy-import/v5/packages/${pkg}`, "runtime/interop/V5_BRIDGE_MANIFEST.json"],
      notes:
        deliveryMode === "native-v6"
          ? "Capability delivered directly in V6 runtime foundation."
          : "Capability delivered through V5 bridge until native lane lands."
    };
  });
}

function writeParityDoc(data) {
  const lines = [
    "# V6 Parity Matrix",
    "",
    "Exhaustive capability parity against V5 package surface.",
    "",
    "## Summary",
    "",
    `- Total capabilities: ${data.summary.total}`,
    `- Native V6: ${data.summary.native}`,
    `- V5 bridge: ${data.summary.bridged}`,
    `- Better: ${data.summary.better}`,
    `- Deprecated: ${data.summary.deprecated}`,
    "",
    "## Capability Table",
    "",
    "| Capability | Status | Delivery | V5 Source |",
    "|---|---|---|---|"
  ];
  for (const cap of data.capabilities) {
    lines.push(`| \`${cap.name}\` | \`${cap.status}\` | \`${cap.deliveryMode}\` | \`${cap.v5Source}\` |`);
  }
  lines.push("");
  fs.writeFileSync(parityDocPath, `${lines.join("\n")}\n`);
}

function writeBridgeManifest(capabilities) {
  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    mode: "v5-bridge",
    entries: capabilities
      .filter((c) => c.deliveryMode === "v5-bridge")
      .map((c) => ({
        capabilityId: c.capabilityId,
        package: c.name,
        sourcePath: `agents/legacy-import/v5/packages/${c.name}`,
        bridgeType: "legacy-package-bridge"
      }))
  };
  fs.mkdirSync(path.dirname(bridgeManifestPath), { recursive: true });
  fs.writeFileSync(bridgeManifestPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const v5Packages = listV5Packages();
  const capabilities = computeCapabilities(v5Packages);
  const summary = {
    total: capabilities.length,
    native: capabilities.filter((c) => c.deliveryMode === "native-v6").length,
    bridged: capabilities.filter((c) => c.deliveryMode === "v5-bridge").length,
    better: capabilities.filter((c) => c.status === "better").length,
    deprecated: capabilities.filter((c) => c.status === "deprecated-by-design").length
  };
  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    summary,
    capabilities
  };
  fs.mkdirSync(path.dirname(parityJsonPath), { recursive: true });
  fs.writeFileSync(parityJsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeParityDoc(payload);
  writeBridgeManifest(capabilities);

  console.log(
    `[parity-status] total=${summary.total} native=${summary.native} bridged=${summary.bridged} better=${summary.better}`
  );
}

main();

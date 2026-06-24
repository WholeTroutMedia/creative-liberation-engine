import fs from "node:fs";
import path from "node:path";

const V6_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const V5_ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";

const modelRegistryPath = path.join(V5_ROOT, "packages", "genkit", "src", "config", "model-registry.ts");
const fleetYamlPath = path.join(V5_ROOT, "deployments", "model-fleet", "registry.yaml");
const canonicalPath = path.join(V6_ROOT, "runtime", "registry", "models.canonical.json");
const reportPath = path.join(V6_ROOT, "runtime", "registry", "models.canonical.report.json");

const requiredTiers = [
  "cloud:max",
  "cloud:fast",
  "cloud:cheap",
  "cloud:vision",
  "cloud:code",
  "local:fast",
  "local:code",
  "local:large",
  "local:embed",
  "local:vision",
  "web:research",
  "web:research:deep"
];

function parseModelRegistry(raw) {
  const lines = raw.split(/\r?\n/);
  const tierRows = [];
  for (const line of lines) {
    const m = line.match(/'([^']+)':\s*env\('[^']+',\s*'([^']+)'\)/);
    if (m) tierRows.push({ tier: m[1], fallbackModel: m[2] });
  }
  return tierRows;
}

function parseFleetServices(raw) {
  const serviceLines = raw.split(/\r?\n/).filter((l) => /^  [a-z0-9_]+:\s*$/.test(l));
  return serviceLines.map((l) => l.trim().replace(/:$/, ""));
}

function localityOf(tier) {
  if (tier.startsWith("local:")) return "local";
  if (tier.startsWith("cloud:")) return "cloud";
  return "web";
}

function main() {
  const registryRaw = fs.readFileSync(modelRegistryPath, "utf8");
  const fleetRaw = fs.readFileSync(fleetYamlPath, "utf8");

  const tiers = parseModelRegistry(registryRaw).sort((a, b) => a.tier.localeCompare(b.tier));
  const tierSet = new Set(tiers.map((x) => x.tier));
  const missingRequiredTiers = requiredTiers.filter((t) => !tierSet.has(t));
  const duplicateTiers = tiers
    .map((x) => x.tier)
    .filter((x, i, arr) => arr.indexOf(x) !== i);

  const fleetServices = parseFleetServices(fleetRaw);

  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    generatedFrom: [
      "creative-liberation-engine-v5/packages/genkit/src/config/model-registry.ts",
      "creative-liberation-engine-v5/deployments/model-fleet/registry.yaml"
    ],
    counts: {
      modelTiers: tiers.length,
      fleetServices: fleetServices.length
    },
    modelTiers: tiers.map((x) => ({
      tier: x.tier,
      fallbackModel: x.fallbackModel,
      locality: localityOf(x.tier)
    })),
    fleetServices
  };

  const report = {
    generatedAt: payload.generatedAt,
    missingRequiredTiers,
    duplicateTiers
  };

  fs.writeFileSync(canonicalPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`[canonical-models] tiers=${payload.counts.modelTiers} services=${payload.counts.fleetServices}`);
  console.log(`[canonical-models] missing_required_tiers=${report.missingRequiredTiers.length}`);
  console.log(`[canonical-models] duplicate_tiers=${report.duplicateTiers.length}`);
}

main();

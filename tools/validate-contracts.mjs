import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function readJson(relativePath) {
  const filePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requireFile(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: true
});
addFormats(ajv);

const heritageSchema = readJson("schemas/HERITAGE_CAPABILITY.schema.json");
const routeSchema = readJson("schemas/ROUTE_CONTRACT.schema.json");
const routeManifestSchema = readJson("schemas/ROUTE_MANIFEST.schema.json");
const memorySchema = readJson("schemas/MEMORY_CONTRACT.schema.json");
const memoryIndexSchema = readJson("schemas/MEMORY_INDEX.schema.json");
const agentRegistrySchema = readJson("schemas/AGENT_REGISTRY.schema.json");
const skillRegistrySchema = readJson("schemas/SKILL_REGISTRY.schema.json");
const workflowRegistrySchema = readJson("schemas/WORKFLOW_REGISTRY.schema.json");
const loraRegistrySchema = readJson("schemas/LORA_REGISTRY.schema.json");
const agentsCanonicalSchema = readJson("schemas/AGENTS_CANONICAL.schema.json");
const skillsCanonicalSchema = readJson("schemas/SKILLS_CANONICAL.schema.json");
const workflowsCanonicalSchema = readJson("schemas/WORKFLOWS_CANONICAL.schema.json");
const lorasCanonicalSchema = readJson("schemas/LORAS_CANONICAL.schema.json");
const modelsCanonicalSchema = readJson("schemas/MODELS_CANONICAL.schema.json");
const executionHardeningSchema = readJson("schemas/EXECUTION_HARDENING.schema.json");
const modelopsHardeningSchema = readJson("schemas/MODELOPS_HARDENING.schema.json");
const memoryHardeningSchema = readJson("schemas/MEMORY_HARDENING.schema.json");
const securityHardeningSchema = readJson("schemas/SECURITY_HARDENING.schema.json");
const releaseHardeningSchema = readJson("schemas/RELEASE_HARDENING.schema.json");
const reliabilityHardeningSchema = readJson("schemas/RELIABILITY_HARDENING.schema.json");
const loraModelCompatibilitySchema = readJson("schemas/LORA_MODEL_COMPATIBILITY.schema.json");
const constitutionMapSchema = readJson("schemas/CONSTITUTION_MAP.schema.json");
const parityStatusSchema = readJson("schemas/PARITY_STATUS.schema.json");
const designLibraryManifestSchema = readJson("schemas/DESIGN_LIBRARY_MANIFEST.schema.json");

ajv.addSchema(heritageSchema, heritageSchema.$id);
ajv.addSchema(routeSchema, routeSchema.$id);
ajv.addSchema(memorySchema, memorySchema.$id);
ajv.addSchema(routeManifestSchema, routeManifestSchema.$id);
ajv.addSchema(memoryIndexSchema, memoryIndexSchema.$id);
ajv.addSchema(agentRegistrySchema, agentRegistrySchema.$id);
ajv.addSchema(skillRegistrySchema, skillRegistrySchema.$id);
ajv.addSchema(workflowRegistrySchema, workflowRegistrySchema.$id);
ajv.addSchema(loraRegistrySchema, loraRegistrySchema.$id);
ajv.addSchema(agentsCanonicalSchema, agentsCanonicalSchema.$id);
ajv.addSchema(skillsCanonicalSchema, skillsCanonicalSchema.$id);
ajv.addSchema(workflowsCanonicalSchema, workflowsCanonicalSchema.$id);
ajv.addSchema(lorasCanonicalSchema, lorasCanonicalSchema.$id);
ajv.addSchema(modelsCanonicalSchema, modelsCanonicalSchema.$id);
ajv.addSchema(executionHardeningSchema, executionHardeningSchema.$id);
ajv.addSchema(modelopsHardeningSchema, modelopsHardeningSchema.$id);
ajv.addSchema(memoryHardeningSchema, memoryHardeningSchema.$id);
ajv.addSchema(securityHardeningSchema, securityHardeningSchema.$id);
ajv.addSchema(releaseHardeningSchema, releaseHardeningSchema.$id);
ajv.addSchema(reliabilityHardeningSchema, reliabilityHardeningSchema.$id);
ajv.addSchema(loraModelCompatibilitySchema, loraModelCompatibilitySchema.$id);
ajv.addSchema(constitutionMapSchema, constitutionMapSchema.$id);
ajv.addSchema(parityStatusSchema, parityStatusSchema.$id);
ajv.addSchema(designLibraryManifestSchema, designLibraryManifestSchema.$id);

const results = [];

function validateSchemaSelf(relativePath) {
  const schema = readJson(relativePath);
  const ok = ajv.validateSchema(schema);
  if (!ok) {
    throw new Error(`Schema invalid: ${relativePath}\n${ajv.errorsText(ajv.errors, { separator: "\n" })}`);
  }
  results.push(`schema ok: ${relativePath}`);
}

function validateJson(relativePath, schema) {
  const data = readJson(relativePath);
  const ok = ajv.validate(schema, data);
  if (!ok) {
    throw new Error(`Validation failed: ${relativePath}\n${ajv.errorsText(ajv.errors, { separator: "\n" })}`);
  }
  results.push(`json ok: ${relativePath}`);
}

function validateCapabilityMatrix(relativePath) {
  const matrix = readJson(relativePath);
  if (!Array.isArray(matrix.capabilities) || matrix.capabilities.length === 0) {
    throw new Error(`Capability matrix empty: ${relativePath}`);
  }
  const validateCapability = ajv.compile(heritageSchema);
  for (const capability of matrix.capabilities) {
    const ok = validateCapability(capability);
    if (!ok) {
      throw new Error(
        `Capability invalid in ${relativePath} (${capability.capabilityId ?? "unknown"})\n` +
          ajv.errorsText(validateCapability.errors, { separator: "\n" })
      );
    }
  }
  results.push(`matrix ok: ${relativePath}`);
}

function validateWikiExampleFrontmatter(relativePath) {
  const filePath = path.join(root, relativePath);
  const raw = fs.readFileSync(filePath, "utf8");
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    throw new Error(`Missing frontmatter: ${relativePath}`);
  }

  const lines = match[1].split(/\r?\n/);
  const required = [
    "memoryId:",
    "kind:",
    "title:",
    "source:",
    "retentionClass:",
    "lifecycleState:",
    "confidence:",
    "tags:",
    "createdAt:",
    "updatedAt:",
    "provenance:",
    "recordedBy:",
    "recordedAt:"
  ];

  for (const token of required) {
    if (!lines.some((line) => line.includes(token))) {
      throw new Error(`Wiki example missing frontmatter token '${token}' in ${relativePath}`);
    }
  }

  results.push(`wiki example ok: ${relativePath}`);
}

function validateCanonicalAgentReport(relativePath) {
  const report = readJson(relativePath);
  if (!Array.isArray(report.conflicts)) {
    throw new Error(`Canonical report missing conflicts array: ${relativePath}`);
  }
  if (!Array.isArray(report.missingRequiredGroups)) {
    throw new Error(`Canonical report missing required-groups array: ${relativePath}`);
  }
  if (report.conflicts.length > 0) {
    throw new Error(`Canonical agent conflicts detected in ${relativePath}: ${JSON.stringify(report.conflicts)}`);
  }
  if (report.missingRequiredGroups.length > 0) {
    throw new Error(
      `Canonical required agent identities missing in ${relativePath}: ${report.missingRequiredGroups.join(", ")}`
    );
  }
  results.push(`canonical report ok: ${relativePath}`);
}

function validateCanonicalSkillReport(relativePath) {
  const report = readJson(relativePath);
  if (!Array.isArray(report.duplicates)) {
    throw new Error(`Canonical skills report missing duplicates array: ${relativePath}`);
  }
  if (!Array.isArray(report.missingRequiredGroups)) {
    throw new Error(`Canonical skills report missing required-groups array: ${relativePath}`);
  }
  if (report.duplicates.length > 0) {
    throw new Error(`Canonical skill duplicates detected in ${relativePath}: ${report.duplicates.join(", ")}`);
  }
  if (report.missingRequiredGroups.length > 0) {
    throw new Error(
      `Canonical required skills missing in ${relativePath}: ${report.missingRequiredGroups.join(", ")}`
    );
  }
  results.push(`canonical skills report ok: ${relativePath}`);
}

function validateCanonicalWorkflowReport(relativePath) {
  const report = readJson(relativePath);
  if (!Array.isArray(report.duplicates)) {
    throw new Error(`Canonical workflows report missing duplicates array: ${relativePath}`);
  }
  if (!Array.isArray(report.missingRequiredGroups)) {
    throw new Error(`Canonical workflows report missing required-groups array: ${relativePath}`);
  }
  if (report.duplicates.length > 0) {
    throw new Error(`Canonical workflow duplicates detected in ${relativePath}: ${report.duplicates.join(", ")}`);
  }
  if (report.missingRequiredGroups.length > 0) {
    throw new Error(
      `Canonical required workflows missing in ${relativePath}: ${report.missingRequiredGroups.join(", ")}`
    );
  }
  results.push(`canonical workflows report ok: ${relativePath}`);
}

function validateCanonicalLoraReport(relativePath) {
  const report = readJson(relativePath);
  if (!Array.isArray(report.duplicates)) {
    throw new Error(`Canonical loras report missing duplicates array: ${relativePath}`);
  }
  if (!Array.isArray(report.missingRequiredGroups)) {
    throw new Error(`Canonical loras report missing required-groups array: ${relativePath}`);
  }
  if (report.duplicates.length > 0) {
    throw new Error(`Canonical lora duplicates detected in ${relativePath}: ${report.duplicates.join(", ")}`);
  }
  if (report.missingRequiredGroups.length > 0) {
    throw new Error(`Canonical required loras missing in ${relativePath}: ${report.missingRequiredGroups.join(", ")}`);
  }
  results.push(`canonical loras report ok: ${relativePath}`);
}

function validateCanonicalModelReport(relativePath) {
  const report = readJson(relativePath);
  if (!Array.isArray(report.missingRequiredTiers)) {
    throw new Error(`Canonical models report missing required-tiers array: ${relativePath}`);
  }
  if (!Array.isArray(report.duplicateTiers)) {
    throw new Error(`Canonical models report missing duplicate-tiers array: ${relativePath}`);
  }
  if (report.missingRequiredTiers.length > 0) {
    throw new Error(`Canonical required model tiers missing in ${relativePath}: ${report.missingRequiredTiers.join(", ")}`);
  }
  if (report.duplicateTiers.length > 0) {
    throw new Error(`Canonical duplicate model tiers in ${relativePath}: ${report.duplicateTiers.join(", ")}`);
  }
  results.push(`canonical models report ok: ${relativePath}`);
}

function validateLoraModelCompatibility(relativePath, lorasPath, modelsPath) {
  const map = readJson(relativePath);
  const loras = readJson(lorasPath);
  const models = readJson(modelsPath);
  const loraIds = new Set(loras.loras.map((x) => x.loraId));
  const tiers = new Set(models.modelTiers.map((x) => x.tier));
  for (const row of map.mappings) {
    if (!loraIds.has(row.loraId)) {
      throw new Error(`LoRA compatibility references unknown loraId '${row.loraId}' in ${relativePath}`);
    }
    for (const tier of row.compatibleTiers) {
      if (!tiers.has(tier)) {
        throw new Error(`LoRA compatibility references unknown model tier '${tier}' in ${relativePath}`);
      }
    }
  }
  results.push(`lora-model compatibility ok: ${relativePath}`);
}

function validateConstitutionCarryover(relativePath) {
  const data = readJson(relativePath);
  for (const v of ["v1", "v2", "v3", "v4", "v5"]) {
    if ((data.coverage?.[v] ?? 0) < 1) {
      throw new Error(`Constitution carryover missing ${v} coverage in ${relativePath}`);
    }
  }
  if (!Array.isArray(data.principles) || data.principles.length < 10) {
    throw new Error(`Constitution carryover has insufficient principles in ${relativePath}`);
  }
  if (!Array.isArray(data.stories) || data.stories.length < 5) {
    throw new Error(`Constitution carryover has insufficient stories in ${relativePath}`);
  }
  results.push(`constitution carryover ok: ${relativePath}`);
}

function validateParity(relativePath) {
  const data = readJson(relativePath);
  if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
    throw new Error(`Parity status is empty in ${relativePath}`);
  }
  const bad = data.capabilities.filter((c) => !["same", "better", "deprecated-by-design"].includes(c.status));
  if (bad.length > 0) {
    throw new Error(`Parity status contains unsupported statuses in ${relativePath}`);
  }
  const missingEvidence = data.capabilities.filter((c) => !Array.isArray(c.evidence) || c.evidence.length === 0);
  if (missingEvidence.length > 0) {
    throw new Error(`Parity status has capabilities without evidence in ${relativePath}`);
  }
  results.push(`parity status ok: ${relativePath}`);
}

[
  "README.md",
  "docs/SYSTEM_CONTRACT.md",
  "docs/PHASES.md",
  "docs/MEMORY_SPINE.md",
  "docs/ROUTING_CONTRACT.md",
  "docs/FILESYSTEM_POLICY.md",
  "docs/GOVERNANCE_PRECEDENCE.md",
  "docs/HARDENING_HELICES.md",
  "docs/NAS_PATH_REGISTRY.md",
  "docs/nas-path-registry.json",
  "archive/migration/MIGRATION_PLAN.md",
  "archive/migration/MIGRATION_READINESS.md",
  "docs/V6_CONSTITUTION.md",
  "docs/V6_PARITY_MATRIX.md",
  "schemas/README.md",
  "inventory/README.md",
  "wiki/README.md",
  "runtime/hardening/README.md",
  "runtime/interop/V5_BRIDGE_MANIFEST.json"
].forEach(requireFile);

[
  "schemas/HERITAGE_CAPABILITY.schema.json",
  "schemas/ROUTE_CONTRACT.schema.json",
  "schemas/MEMORY_CONTRACT.schema.json",
  "schemas/ROUTE_MANIFEST.schema.json",
  "schemas/MEMORY_INDEX.schema.json",
  "schemas/AGENT_REGISTRY.schema.json",
  "schemas/SKILL_REGISTRY.schema.json",
  "schemas/WORKFLOW_REGISTRY.schema.json"
  ,
  "schemas/LORA_REGISTRY.schema.json",
  "schemas/AGENTS_CANONICAL.schema.json",
  "schemas/SKILLS_CANONICAL.schema.json",
  "schemas/WORKFLOWS_CANONICAL.schema.json",
  "schemas/LORAS_CANONICAL.schema.json",
  "schemas/MODELS_CANONICAL.schema.json",
  "schemas/EXECUTION_HARDENING.schema.json",
  "schemas/MODELOPS_HARDENING.schema.json",
  "schemas/MEMORY_HARDENING.schema.json",
  "schemas/SECURITY_HARDENING.schema.json",
  "schemas/RELEASE_HARDENING.schema.json",
  "schemas/RELIABILITY_HARDENING.schema.json",
  "schemas/LORA_MODEL_COMPATIBILITY.schema.json",
  "schemas/CONSTITUTION_MAP.schema.json",
  "schemas/PARITY_STATUS.schema.json",
  "schemas/DESIGN_LIBRARY_MANIFEST.schema.json"
].forEach(validateSchemaSelf);

validateCapabilityMatrix("archive/migration/inventory/CAPABILITY_MATRIX.json");
validateCapabilityMatrix("archive/migration/inventory/CAPABILITY_MATRIX.seed.json");
validateJson("runtime/routes/ROUTE_MANIFEST.example.json", routeManifestSchema);
validateJson("runtime/memory/MEMORY_INDEX.example.json", memoryIndexSchema);
validateJson("runtime/registry/agents.registry.json", agentRegistrySchema);
validateJson("runtime/registry/skills.registry.json", skillRegistrySchema);
validateJson("runtime/registry/workflows.registry.json", workflowRegistrySchema);
validateJson("runtime/registry/loras.registry.json", loraRegistrySchema);
validateJson("runtime/registry/agents.canonical.json", agentsCanonicalSchema);
validateCanonicalAgentReport("runtime/registry/agents.canonical.report.json");
validateJson("runtime/registry/skills.canonical.json", skillsCanonicalSchema);
validateCanonicalSkillReport("runtime/registry/skills.canonical.report.json");
validateJson("runtime/registry/workflows.canonical.json", workflowsCanonicalSchema);
validateCanonicalWorkflowReport("runtime/registry/workflows.canonical.report.json");
validateJson("runtime/registry/loras.canonical.json", lorasCanonicalSchema);
validateCanonicalLoraReport("runtime/registry/loras.canonical.report.json");
validateJson("runtime/registry/models.canonical.json", modelsCanonicalSchema);
validateCanonicalModelReport("runtime/registry/models.canonical.report.json");
validateJson("runtime/registry/lora-model-compatibility.json", loraModelCompatibilitySchema);
validateLoraModelCompatibility(
  "runtime/registry/lora-model-compatibility.json",
  "runtime/registry/loras.canonical.json",
  "runtime/registry/models.canonical.json"
);
validateJson("runtime/governance/CONSTITUTION_MAP.json", constitutionMapSchema);
validateConstitutionCarryover("runtime/governance/CONSTITUTION_MAP.json");
validateJson("runtime/governance/PARITY_STATUS.json", parityStatusSchema);
validateParity("runtime/governance/PARITY_STATUS.json");
validateJson("runtime/hardening/execution.hardening.json", executionHardeningSchema);
validateJson("runtime/hardening/modelops.hardening.json", modelopsHardeningSchema);
validateJson("runtime/hardening/memory.hardening.json", memoryHardeningSchema);
validateJson("runtime/hardening/security.hardening.json", securityHardeningSchema);
validateJson("runtime/hardening/release.hardening.json", releaseHardeningSchema);
validateJson("runtime/hardening/reliability.hardening.json", reliabilityHardeningSchema);
validateJson("design-system/design-library.manifest.json", designLibraryManifestSchema);
validateWikiExampleFrontmatter("wiki/examples/mem_v6_single_canon_decision.md");
requireFile("runtime/governance/CONSTITUTION_SCORECARD.md");

console.log("V6 contract validation passed.");
for (const line of results) {
  console.log(`- ${line}`);
}

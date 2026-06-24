import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const MATRIX_PATH = path.join(ROOT, "docs", "SKILL_TARGET_MATRIX.md");
const SKILLS_NEXT_ROOT = path.join(ROOT, "agents", "skills-next");

const familyBySkill = {
  "service-health-triage": "runtime-ops",
  "rollback-operator": "runtime-ops",
  "config-drift-detector": "runtime-ops",
  "dependency-auditor": "runtime-ops",
  "capacity-forecast": "runtime-ops",
  "secret-scanner": "security",
  "authz-policy-verifier": "security",
  "sbom-vulnerability-gate": "security",
  "incident-forensics": "security",
  "supply-chain-hardener": "security",
  "memory-schema-migrator": "memory-knowledge",
  "provenance-reconciler": "memory-knowledge",
  "retention-policy-enforcer": "memory-knowledge",
  "semantic-deduper": "memory-knowledge",
  "knowledge-gap-mapper": "memory-knowledge",
  "eval-dataset-curator": "model-agent-quality",
  "prompt-regression-guard": "model-agent-quality",
  "route-quality-optimizer": "model-agent-quality",
  "hallucination-risk-scorer": "model-agent-quality",
  "agent-performance-profiler": "model-agent-quality",
  "release-train-coordinator": "delivery-governance",
  "change-impact-estimator": "delivery-governance",
  "migration-wave-planner": "delivery-governance",
  "constitutional-policy-linter": "delivery-governance",
  "audit-trail-compiler": "delivery-governance",
  "design-token-steward": "design-product-os",
  "component-contract-checker": "design-product-os",
  "ux-regression-detector": "design-product-os",
  "accessibility-conformance": "design-product-os",
  "design-system-sync": "design-product-os",
  "connector-hardener": "data-integration",
  "ingest-contract-validator": "data-integration",
  "event-schema-enforcer": "data-integration",
  "sync-conflict-resolver": "data-integration",
  "integration-sla-monitor": "data-integration"
};

function titleCase(slug) {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function extractSkillIdsFromMatrix(raw) {
  const ids = [...raw.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)*)`/g)]
    .map((m) => m[1])
    .filter((id) => id in familyBySkill);
  return [...new Set(ids)];
}

function renderSkillMd(skillId) {
  const family = familyBySkill[skillId];
  const title = titleCase(skillId);
  return `---
name: "${skillId}"
description: "${title} skill for ${family.replace(/-/g, " ")} operations in Creative Liberation Engine V6."
agentCallable: true
---

# ${title}

## Purpose

Provide a production-grade ${title.toLowerCase()} capability for the ${family.replace(/-/g, " ")} family.

## Inputs

- Structured task context
- Relevant runtime state and registry artifacts
- Constraints (security, cost, latency, constitutional policy)

## Outputs

- Action plan with explicit steps
- Execution artifacts and verification results
- Escalation notes when blocking conditions occur

## Guardrails

- No destructive operations without explicit operator direction
- Maintain constitutional compliance and provenance tracking
- Emit machine-readable outcomes for downstream workflow orchestration
`;
}

function main() {
  const raw = fs.readFileSync(MATRIX_PATH, "utf8");
  const skillIds = extractSkillIdsFromMatrix(raw);
  if (skillIds.length !== 35) {
    throw new Error(`Expected 35 batch skill IDs in matrix, found ${skillIds.length}`);
  }

  let created = 0;
  for (const skillId of skillIds.sort()) {
    const dir = path.join(SKILLS_NEXT_ROOT, skillId);
    const file = path.join(dir, "SKILL.md");
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, renderSkillMd(skillId));
      created += 1;
    }
  }

  console.log(`[skills-batch35] target=${skillIds.length} created=${created} existing=${skillIds.length - created}`);
}

main();

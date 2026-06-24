import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const MATRIX_PATH = path.join(ROOT, "docs", "SKILL_TARGET_MATRIX_BATCH2.md");
const SKILLS_NEXT_ROOT = path.join(ROOT, "agents", "skills-next");

function titleCase(slug) {
  return slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function extractSkillIds(raw) {
  return [...new Set([...raw.matchAll(/^\|\s*`([a-z0-9]+(?:-[a-z0-9]+)*)`\s*\|/gm)].map((m) => m[1]))];
}

function renderSkillMd(skillId) {
  const title = titleCase(skillId);
  return `---
name: "${skillId}"
description: "${title} skill for Creative Liberation Engine V6 batch 2."
agentCallable: true
---

# ${title}

## Purpose

Provide production-grade ${title.toLowerCase()} capability for V6 operations.

## Inputs

- Structured task context
- Relevant runtime state and canonical registries
- Security, cost, latency, and constitutional constraints

## Outputs

- Actionable execution plan
- Machine-readable outcomes
- Escalation notes for blockers and policy exceptions

## Guardrails

- Preserve constitutional compliance and provenance.
- Avoid destructive actions without explicit operator approval.
- Emit deterministic artifacts for downstream workflow automation.
`;
}

function main() {
  const raw = fs.readFileSync(MATRIX_PATH, "utf8");
  const skillIds = extractSkillIds(raw);
  if (skillIds.length !== 35) {
    throw new Error(`Expected 35 batch2 skill IDs, found ${skillIds.length}`);
  }

  let created = 0;
  for (const id of skillIds.sort()) {
    const dir = path.join(SKILLS_NEXT_ROOT, id);
    const file = path.join(dir, "SKILL.md");
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, renderSkillMd(id));
      created += 1;
    }
  }

  console.log(`[skills-batch35-b2] target=${skillIds.length} created=${created} existing=${skillIds.length - created}`);
}

main();

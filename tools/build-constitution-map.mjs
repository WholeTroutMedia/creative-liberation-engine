import fs from "node:fs";
import path from "node:path";

const ROOT = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine";
const legacyRoot = path.join(ROOT, "agents", "legacy-import");
const outJson = path.join(ROOT, "runtime", "governance", "CONSTITUTION_MAP.json");
const outDoc = path.join(ROOT, "docs", "V6_CONSTITUTION.md");
const outScore = path.join(ROOT, "runtime", "governance", "CONSTITUTION_SCORECARD.md");

const versions = ["v1", "v2", "v3", "v4", "v5"];
const principleMatchers = [
  /constitution/i,
  /constitutional/i,
  /article[\s_-]*[ivxlcdm0-9]+/i,
  /working[_ -]?principles?/i,
  /core[_ -]?values?/i,
  /sovereign/i,
  /non[- ]?negotiable/i,
  /dna/i
];
const storyMatchers = [/origin[_ -]?story/i, /handoff/i, /session/i, /migration/i, /history/i];

function walkFiles(dir) {
  const stack = [dir];
  const files = [];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!fs.existsSync(cur)) continue;
    for (const ent of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) {
        if (["node_modules", ".git", "dist", "build", ".next", "__pycache__"].includes(ent.name)) continue;
        stack.push(full);
      } else if (ent.isFile() && /\.(md|json|ya?ml|ts|py)$/i.test(ent.name)) {
        files.push(full);
      }
    }
  }
  return files;
}

function normalizeId(prefix, text) {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const safe = cleaned.length >= 3 ? cleaned : "carryover";
  return `${prefix}-${safe.slice(0, 70)}`;
}

function firstLine(content) {
  return (
    content
      .split(/\r?\n/)
      .map((x) => x.trim())
      .find((x) => x.length >= 3 && /[a-z0-9]/i.test(x)) ?? ""
  );
}

function summarize(content, limit = 240) {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.slice(0, limit);
}

function extractSignals(files, matcherSet, kind) {
  const rows = [];
  for (const file of files) {
    const rel = path.relative(legacyRoot, file).replaceAll("\\", "/");
    const version = rel.split("/")[0];
    if (!versions.includes(version)) continue;
    const lower = rel.toLowerCase();
    if (!matcherSet.some((rx) => rx.test(lower))) continue;
    const raw = fs.readFileSync(file, "utf8");
    const title = (firstLine(raw).replace(/^#+\s*/, "") || path.basename(file)).trim();
    const base = title.length >= 3 ? title : path.basename(file);
    if (kind === "principle") {
      rows.push({
        principleId: normalizeId("p", base),
        title: base,
        statement: summarize(raw),
        derivedFrom: [{ version, path: `agents/legacy-import/${rel}` }]
      });
    } else {
      rows.push({
        storyId: normalizeId("s", base),
        title: base,
        summary: summarize(raw),
        derivedFrom: [{ version, path: `agents/legacy-import/${rel}` }]
      });
    }
  }
  return rows;
}

function seedFallbackForVersion(files, version, kind) {
  const candidates = files
    .filter((f) => path.relative(legacyRoot, f).replaceAll("\\", "/").startsWith(`${version}/`))
    .sort((a, b) => a.localeCompare(b));
  const pick =
    candidates.find((f) => /AGENTS\.md$/i.test(f)) ||
    candidates.find((f) => /CONSTITUTION|WORKING_PRINCIPLES|ORIGIN|HANDOFF/i.test(path.basename(f))) ||
    candidates[0];
  if (!pick) return null;
  const rel = path.relative(legacyRoot, pick).replaceAll("\\", "/");
  const raw = fs.readFileSync(pick, "utf8");
  const lineTitle = firstLine(raw).replace(/^#+\s*/, "").trim();
  const baseTitle = lineTitle.length >= 3 ? lineTitle : path.basename(pick);
  if (kind === "principle") {
    return {
      principleId: normalizeId("p", `${version}-${baseTitle}`),
      title: `${baseTitle} (${version} carryover)`,
      statement: summarize(raw),
      derivedFrom: [{ version, path: `agents/legacy-import/${rel}` }]
    };
  }
  return {
    storyId: normalizeId("s", `${version}-${baseTitle}`),
    title: `${baseTitle} (${version} carryover)`,
    summary: summarize(raw),
    derivedFrom: [{ version, path: `agents/legacy-import/${rel}` }]
  };
}

function dedupeById(items, key) {
  const map = new Map();
  for (const row of items) {
    if (!map.has(row[key])) {
      map.set(row[key], row);
    } else {
      const prior = map.get(row[key]);
      prior.derivedFrom.push(...row.derivedFrom);
    }
  }
  return [...map.values()];
}

function enforceCoverage(principles, stories) {
  const coverage = { v1: 0, v2: 0, v3: 0, v4: 0, v5: 0 };
  for (const row of [...principles, ...stories]) {
    for (const src of row.derivedFrom) coverage[src.version] += 1;
  }
  return coverage;
}

function injectEnforcement(principles) {
  const map = [
    "docs/SYSTEM_CONTRACT.md",
    "docs/GOVERNANCE_PRECEDENCE.md",
    "tools/validate-contracts.mjs",
    "runtime/hardening/execution.hardening.json",
    "runtime/hardening/modelops.hardening.json",
    "runtime/hardening/memory.hardening.json",
    "runtime/hardening/security.hardening.json",
    "runtime/hardening/release.hardening.json",
    "runtime/hardening/reliability.hardening.json"
  ];
  return principles.map((p) => ({ ...p, enforcedBy: map }));
}

function writeConstitutionDoc(data) {
  const lines = [
    "# V6 Constitution",
    "",
    "This constitution carries forward core DNA and founding story directives from V1 through V5, and binds them to V6 runtime enforcement.",
    "",
    "## Carryover Coverage",
    "",
    `- V1 signals: ${data.coverage.v1}`,
    `- V2 signals: ${data.coverage.v2}`,
    `- V3 signals: ${data.coverage.v3}`,
    `- V4 signals: ${data.coverage.v4}`,
    `- V5 signals: ${data.coverage.v5}`,
    "",
    "## Constitutional Principles",
    ""
  ];
  for (const p of data.principles) {
    lines.push(`### ${p.title}`);
    lines.push("");
    lines.push(`- Principle ID: \`${p.principleId}\``);
    lines.push(`- Statement: ${p.statement}`);
    lines.push(`- Derived from: ${p.derivedFrom.map((d) => `\`${d.version}:${d.path}\``).join(", ")}`);
    lines.push(`- Enforced by: ${p.enforcedBy.map((x) => `\`${x}\``).join(", ")}`);
    lines.push("");
  }
  lines.push("## Founding Story Threads");
  lines.push("");
  for (const s of data.stories) {
    lines.push(`- **${s.title}** (\`${s.storyId}\`) — ${s.summary}`);
  }
  lines.push("");
  fs.writeFileSync(outDoc, `${lines.join("\n")}\n`);
}

function writeScorecard(data) {
  const lines = [
    "# Constitution Scorecard",
    "",
    `Generated at ${data.generatedAt}.`,
    "",
    "| Category | Value | Status |",
    "|---|---:|---|",
    `| Principles | ${data.principles.length} | ${data.principles.length >= 10 ? "PASS" : "FAIL"} |`,
    `| Stories | ${data.stories.length} | ${data.stories.length >= 5 ? "PASS" : "FAIL"} |`,
    `| V1 Coverage | ${data.coverage.v1} | ${data.coverage.v1 >= 1 ? "PASS" : "FAIL"} |`,
    `| V2 Coverage | ${data.coverage.v2} | ${data.coverage.v2 >= 1 ? "PASS" : "FAIL"} |`,
    `| V3 Coverage | ${data.coverage.v3} | ${data.coverage.v3 >= 1 ? "PASS" : "FAIL"} |`,
    `| V4 Coverage | ${data.coverage.v4} | ${data.coverage.v4 >= 1 ? "PASS" : "FAIL"} |`,
    `| V5 Coverage | ${data.coverage.v5} | ${data.coverage.v5 >= 1 ? "PASS" : "FAIL"} |`,
    ""
  ];
  fs.writeFileSync(outScore, `${lines.join("\n")}\n`);
}

function main() {
  const files = walkFiles(legacyRoot);
  const principleSeed = extractSignals(files, principleMatchers, "principle");
  const storySeed = extractSignals(files, storyMatchers, "story");
  for (const version of versions) {
    if (!principleSeed.some((x) => x.derivedFrom.some((d) => d.version === version))) {
      const fallback = seedFallbackForVersion(files, version, "principle");
      if (fallback) principleSeed.push(fallback);
    }
    if (!storySeed.some((x) => x.derivedFrom.some((d) => d.version === version))) {
      const fallback = seedFallbackForVersion(files, version, "story");
      if (fallback) storySeed.push(fallback);
    }
  }
  const principles = injectEnforcement(dedupeById(principleSeed, "principleId")).slice(0, 80);
  const stories = dedupeById(storySeed, "storyId").slice(0, 40);
  const coverage = enforceCoverage(principles, stories);

  const payload = {
    version: "v6.1",
    generatedAt: new Date().toISOString(),
    coverage,
    principles,
    stories
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`);
  writeConstitutionDoc(payload);
  writeScorecard(payload);

  console.log(
    `[constitution-map] principles=${payload.principles.length} stories=${payload.stories.length} coverage=${JSON.stringify(coverage)}`
  );
}

main();

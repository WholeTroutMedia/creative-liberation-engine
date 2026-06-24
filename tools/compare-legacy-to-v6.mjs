import fs from "node:fs";
import path from "node:path";

const roots = [
  ["v1", "D:/Google Antigravity/Infusion Engine Brainchild/agentic-studio-creative-liberation-engine"],
  ["v2", "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v2"],
  ["v3", "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v3"],
  ["v4", "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine-v4"],
  ["v5", "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine"]
];

const v6RegistryRoot = "D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine/runtime/registry";

function walkFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        const d = entry.name.toLowerCase();
        if (["node_modules", ".git", "dist", "build", ".next"].includes(d)) continue;
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

function normalizeId(input) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function readableName(filePath) {
  return path.basename(filePath, path.extname(filePath)).replace(/[_-]+/g, " ").trim();
}

function isAgentFile(filePath) {
  const n = filePath.replace(/\\/g, "/").toLowerCase();
  const bn = path.basename(filePath).toLowerCase();
  return (
    n.includes("/agents/") ||
    n.includes("agent-registry") ||
    n.endsWith(".agent-registry.json") ||
    bn === "agent.json" ||
    bn === "agents.md" ||
    bn.endsWith("_agent.md") ||
    bn === "agent.ts" ||
    bn === "agent.py"
  );
}

function isSkillFile(filePath) {
  const n = filePath.replace(/\\/g, "/").toLowerCase();
  const bn = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  return (
    (n.includes("/skills/") || n.includes("skill-library") || bn === "skill.md" || bn.includes("skill")) &&
    [".md", ".json", ".yaml", ".yml"].includes(ext)
  );
}

function isWorkflowFile(filePath) {
  const n = filePath.replace(/\\/g, "/").toLowerCase();
  const bn = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  return (
    (n.includes("/workflows/") || n.includes("/workflow/") || bn.includes("workflow") || bn.includes("handoff") || bn.includes("dispatch")) &&
    [".md", ".json", ".yaml", ".yml"].includes(ext)
  );
}

function isLoraFile(filePath) {
  const n = filePath.replace(/\\/g, "/").toLowerCase();
  const bn = path.basename(filePath).toLowerCase();
  return (
    (n.includes("lora") || n.includes("qlora") || n.includes("peft") || n.includes("adapter")) &&
    ![".png", ".jpg", ".jpeg"].some((x) => bn.endsWith(x))
  );
}

function setDiff(left, right) {
  const onlyLeft = [...left].filter((x) => !right.has(x)).sort();
  const onlyRight = [...right].filter((x) => !left.has(x)).sort();
  return { onlyLeft, onlyRight };
}

const src = {
  agents: new Set(),
  skills: new Set(),
  workflows: new Set(),
  loras: new Set()
};

for (const [tag, root] of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walkFiles(root)) {
    if (isAgentFile(file)) src.agents.add(normalizeId(readableName(file)));
    if (isSkillFile(file)) src.skills.add(normalizeId(readableName(file)));
    if (isWorkflowFile(file)) src.workflows.add(normalizeId(readableName(file)));
    if (isLoraFile(file)) src.loras.add(normalizeId(`${tag}-${readableName(file)}`));
  }
}

const v6 = {
  agents: new Set(JSON.parse(fs.readFileSync(path.join(v6RegistryRoot, "agents.registry.json"), "utf8")).agents.map((x) => x.agentId)),
  skills: new Set(JSON.parse(fs.readFileSync(path.join(v6RegistryRoot, "skills.registry.json"), "utf8")).skills.map((x) => x.skillId)),
  workflows: new Set(JSON.parse(fs.readFileSync(path.join(v6RegistryRoot, "workflows.registry.json"), "utf8")).workflows.map((x) => x.workflowId)),
  loras: new Set(JSON.parse(fs.readFileSync(path.join(v6RegistryRoot, "loras.registry.json"), "utf8")).loras.map((x) => x.loraId))
};

for (const key of ["agents", "skills", "workflows", "loras"]) {
  const { onlyLeft, onlyRight } = setDiff(src[key], v6[key]);
  console.log(`ENTITY=${key}`);
  console.log(`SOURCE_COUNT=${src[key].size}`);
  console.log(`V6_COUNT=${v6[key].size}`);
  console.log(`MISSING_IN_V6=${onlyLeft.length}`);
  console.log(`EXTRA_IN_V6=${onlyRight.length}`);
  console.log(`MISSING_SAMPLE=${onlyLeft.slice(0, 20).join(",")}`);
  console.log(`EXTRA_SAMPLE=${onlyRight.slice(0, 20).join(",")}`);
}

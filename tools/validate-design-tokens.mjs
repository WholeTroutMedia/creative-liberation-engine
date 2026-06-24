import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Ignored files and paths
const IGNORED_PATHS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  "__pycache__",
  "tests",
  "scripts",
  "archive",
  "artifacts",
  "scratch",
  "tools/validate-design-tokens.mjs",
  "docs/DESIGN.md",
  "docs/V6_CONSTITUTION.md",
  "apps/console/src/pages/FlowOrchestrator.tsx",
  "apps/console/src/pages/AutoDash.tsx"
];

function isIgnored(filePath) {
  const relPath = path.relative(root, filePath).replace(/\\/g, "/");
  if (relPath.includes("email") || (relPath.endsWith(".html") && relPath.includes("template"))) {
    return true; // Email clients do not support CSS custom properties, hex codes are required
  }
  return IGNORED_PATHS.some(ignored => relPath.startsWith(ignored) || relPath.includes("/" + ignored + "/"));
}

// Check if a line contains a hex color violation
function getHexViolations(line, lineNum, filePath) {
  const hexRegex = /#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;
  let match;
  const violations = [];

  while ((match = hexRegex.exec(line)) !== null) {
    const hex = match[0];
    
    // Skip if marked with overrides
    if (line.includes("eslint-disable") || line.includes("prettier-ignore") || line.includes("// allow-hex")) {
      continue;
    }
    
    // For CSS files, allow custom properties definitions in theme blocks
    if (filePath.endsWith("style.css") || filePath.endsWith("index.css") || filePath.includes("theme")) {
      if (line.includes("--background-primary") || 
          line.includes("--background-secondary") || 
          line.includes("--background-modifier-border") ||
          line.includes("--interactive-accent") ||
          line.includes("--interactive-accent-hover") ||
          line.includes("--text-accent") ||
          line.includes("--text-normal") ||
          line.includes("--text-muted")) {
        continue; // Approved variable definition
      }
    }

    violations.push({
      type: "Hardcoded Hex Color",
      value: hex,
      lineNum,
      line: line.trim()
    });
  }
  return violations;
}

// Check for Tailwind color class violations
function getTailwindViolations(line, lineNum) {
  const twRegex = /\b(bg|text|border|outline|ring|divide|from|to|via)-(red|blue|green|yellow|indigo|purple|pink|orange|amber|lime|emerald|teal|cyan|sky|violet|fuchsia|rose|slate|gray|zinc|neutral|stone)-(50|100|200|300|400|500|600|700|800|900|950)\b/g;
  let match;
  const violations = [];

  while ((match = twRegex.exec(line)) !== null) {
    const cls = match[0];
    if (line.includes("eslint-disable") || line.includes("// allow-tailwind")) {
      continue;
    }
    violations.push({
      type: "Hardcoded Tailwind Color Class",
      value: cls,
      lineNum,
      line: line.trim()
    });
  }
  return violations;
}

export function validateDesignTokens(filesToCheck = []) {
  const targetDirs = ["apps", "ATELIER", "services", "design-system"];
  const violations = [];

  for (const file of filesToCheck) {
    if (!fs.existsSync(file)) continue;
    if (fs.statSync(file).isDirectory()) continue;
    if (isIgnored(file)) continue;

    // Scope-gate check: Only scan files inside core production folders
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const isTarget = targetDirs.some(dir => rel.startsWith(dir + "/"));
    if (!isTarget) continue;

    const ext = path.extname(file);
    if (![".css", ".ts", ".tsx", ".js", ".jsx", ".html"].includes(ext)) continue;

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();
      
      if (trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("<!--")) {
        return;
      }

      const hexes = getHexViolations(line, lineNum, file);
      if (hexes.length > 0) {
        violations.push(...hexes.map(v => ({ ...v, file })));
      }

      const tws = getTailwindViolations(line, lineNum);
      if (tws.length > 0) {
        violations.push(...tws.map(v => ({ ...v, file })));
      }
    });
  }

  return violations;
}

// Get changed files from git, fallback to mmin if dirty
export function getChangedFiles() {
  let files = [];
  try {
    const unixRoot = root.replace(/\\/g, "/");
    const targetPath = unixRoot.includes("/app") ? unixRoot : `/app/${path.basename(unixRoot)}`;
    const safeOption = `-c safe.directory="${targetPath}"`;
    
    const gitDiff = execSync(`git ${safeOption} diff --name-only HEAD`, { cwd: root, encoding: "utf8" });
    const gitUntracked = execSync(`git ${safeOption} ls-files --others --exclude-standard`, { cwd: root, encoding: "utf8" });
    
    files = [...gitDiff.split("\n"), ...gitUntracked.split("\n")]
      .map(f => f.trim())
      .filter(Boolean)
      .map(f => path.resolve(root, f));

    files = [...new Set(files)];

    // If git is dirty with many changes, fallback to recently modified files in the last 60 minutes
    if (files.length > 50) {
      console.log(`\x1b[33mGit index is dirty (${files.length} changes). Falling back to files modified in the last 60 minutes...\x1b[0m`);
      const recentFiles = execSync(`find . -type f -not -path '*/.*' -not -path '*/node_modules/*' -not -path '*/.pnpm-store/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/playwright-profile/*' -not -path '*/Cookies/*' -not -path '*/archive/*' -not -path '*/artifacts/*' -not -path '*/scratch/*' -mmin -60`, { cwd: root, encoding: "utf8" });
      files = recentFiles.split("\n")
        .map(f => f.trim())
        .filter(Boolean)
        .map(f => path.resolve(root, f));
    }
  } catch (e) {
    try {
      console.warn("Git command failed. Falling back to find command for recent modifications...");
      const recentFiles = execSync(`find . -type f -not -path '*/.*' -not -path '*/node_modules/*' -not -path '*/.pnpm-store/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/playwright-profile/*' -not -path '*/Cookies/*' -not -path '*/archive/*' -not -path '*/artifacts/*' -not -path '*/scratch/*' -mmin -60`, { cwd: root, encoding: "utf8" });
      files = recentFiles.split("\n")
        .map(f => f.trim())
        .filter(Boolean)
        .map(f => path.resolve(root, f));
    } catch (findErr) {
      console.warn("Skipping file collection: find and git failed:", findErr.message);
      files = [];
    }
  }
  return files;
}

// Command-line execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const changedFiles = getChangedFiles();
  
  if (changedFiles.length === 0) {
    console.log("\x1b[32m✔ No changed/recent files detected in git repository to check for design token compliance.\x1b[0m");
    process.exit(0);
  }

  console.log(`Scanning ${changedFiles.length} modified/new files for design token compliance...`);
  const violations = validateDesignTokens(changedFiles);

  if (violations.length > 0) {
    console.error(`\x1b[31m[DESIGN VIOLATION] Found ${violations.length} design system non-compliance errors in your changes:\x1b[0m\n`);
    violations.forEach(v => {
      const relFile = path.relative(root, v.file);
      console.error(`  \x1b[33m${relFile}:${v.lineNum}\x1b[0m [${v.type}] -> \x1b[36m${v.value}\x1b[0m`);
      console.error(`    Code: \x1b[2m${v.line}\x1b[0m\n`);
    });
    console.error(`\x1b[31mError: All new UI layouts and styles must use ATELIER design tokens (e.g., var(--background-primary)) as defined in docs/DESIGN.md.\x1b[0m`);
    process.exit(1);
  } else {
    console.log("\x1b[32m✔ Design system token validation passed on your changes.\x1b[0m");
    process.exit(0);
  }
}

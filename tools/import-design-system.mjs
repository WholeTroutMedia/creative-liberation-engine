import fs from "node:fs";
import path from "node:path";

const V6_ROOT = path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine");
const V5_ROOT = path.resolve("D:/Google Antigravity/Infusion Engine Brainchild/creative-liberation-engine");

const SRC_DOCS = path.join(V5_ROOT, "docs", "design-system");
const SRC_LIBRARY = path.join(V5_ROOT, "tools", "design-library");
const DST_ROOT = path.join(V6_ROOT, "design-system");
const DST_DOCS = path.join(DST_ROOT, "docs-import");
const DST_LIBRARY = path.join(DST_ROOT, "library-import");
const DST_MANIFEST = path.join(DST_ROOT, "design-library.manifest.json");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function walk(root) {
  const out = [];
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    for (const e of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function copyTree(srcRoot, dstRoot) {
  const files = walk(srcRoot);
  for (const src of files) {
    const rel = path.relative(srcRoot, src);
    const dst = path.join(dstRoot, rel);
    ensureDir(path.dirname(dst));
    fs.copyFileSync(src, dst);
  }
  return files;
}

function relUnix(base, p) {
  return path.relative(base, p).replace(/\\/g, "/");
}

function main() {
  ensureDir(DST_DOCS);
  ensureDir(DST_LIBRARY);
  const docsFiles = copyTree(SRC_DOCS, DST_DOCS);
  const libraryFiles = copyTree(SRC_LIBRARY, DST_LIBRARY);

  const sources = new Map();
  for (const file of libraryFiles) {
    const rel = path.relative(DST_LIBRARY, path.join(DST_LIBRARY, path.relative(SRC_LIBRARY, file)));
    const parts = rel.split(path.sep);
    const source = parts[0];
    if (!source) continue;
    if (!sources.has(source)) sources.set(source, { source, files: 0, catalog: false, readme: false });
    const row = sources.get(source);
    row.files += 1;
    if (parts[1] === "catalog.json") row.catalog = true;
    if (parts[1] === "README.md") row.readme = true;
  }

  const manifest = {
    version: "v6.0",
    importedAt: new Date().toISOString(),
    docs: docsFiles.map((f) => relUnix(V6_ROOT, path.join(DST_DOCS, path.relative(SRC_DOCS, f)))).sort(),
    sources: Array.from(sources.values()).sort((a, b) => a.source.localeCompare(b.source))
  };
  fs.writeFileSync(DST_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[V6 design import] docs=${docsFiles.length} libraryFiles=${libraryFiles.length} sources=${manifest.sources.length}`);
}

main();

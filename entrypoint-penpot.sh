#!/bin/sh
set -e

echo "[penpot-mcp] Cleaning npx cache to ensure fresh installation..."
rm -rf /root/.npm/_npx

echo "[penpot-mcp] Installing pnpm@9..."
npm install -g pnpm@9

echo "[penpot-mcp] Running npx to fetch @penpot/mcp..."
npx -y @penpot/mcp@latest 2>/dev/null && exit 0 || true

echo "[penpot-mcp] Bootstrap failed (expected). Patching pnpm-workspace.yaml..."
PKG_DIR=$(ls -d /root/.npm/_npx/*/node_modules/@penpot/mcp | head -n 1)

if [ ! -d "$PKG_DIR" ]; then
  echo "[penpot-mcp] ERROR: Could not locate @penpot/mcp directory in npx cache"
  exit 1
fi

echo "[penpot-mcp] Found package at: $PKG_DIR"
cd "$PKG_DIR"

if [ -f pnpm-workspace.yaml ]; then
  if ! grep -q onlyBuiltDependencies pnpm-workspace.yaml; then
    printf '\nonlyBuiltDependencies:\n  - esbuild\n  - sharp\n  - "@esbuild/linux-x64"\n  - "@img/sharp-linux-x64"\n' >> pnpm-workspace.yaml
  fi
else
  printf 'packages:\n  - "packages/*"\n\nonlyBuiltDependencies:\n  - esbuild\n  - sharp\n  - "@esbuild/linux-x64"\n  - "@img/sharp-linux-x64"\n' > pnpm-workspace.yaml
fi

echo "[penpot-mcp] Running pnpm install with approved builds..."
pnpm -r install

echo "[penpot-mcp] Patching @modelcontextprotocol/sdk exports to resolve Node ESM strictness..."
node -e "
const fs = require('fs');
const sdkPkgPath = './node_modules/.pnpm/@modelcontextprotocol+sdk@1.29.0_zod@4.4.3/node_modules/@modelcontextprotocol/sdk/package.json';
if (fs.existsSync(sdkPkgPath)) {
  let pkg = JSON.parse(fs.readFileSync(sdkPkgPath, 'utf8'));
  pkg.exports['./server/mcp.js'] = {
    'types': './dist/esm/server/mcp.d.ts',
    'import': './dist/esm/server/mcp.js',
    'require': './dist/cjs/server/mcp.js'
  };
  pkg.exports['./server/sse.js'] = {
    'types': './dist/esm/server/sse.d.ts',
    'import': './dist/esm/server/sse.js',
    'require': './dist/cjs/server/sse.js'
  };
  pkg.exports['./server/streamableHttp.js'] = {
    'types': './dist/esm/server/streamableHttp.d.ts',
    'import': './dist/esm/server/streamableHttp.js',
    'require': './dist/cjs/server/streamableHttp.js'
  };
  fs.writeFileSync(sdkPkgPath, JSON.stringify(pkg, null, 2));
  console.log('[penpot-mcp] Patched SDK package.json exports!');
} else {
  console.error('[penpot-mcp] ERROR: SDK package.json not found at ' + sdkPkgPath);
}
"

echo "[penpot-mcp] Building..."
pnpm run build
echo "[penpot-mcp] Starting server..."
exec pnpm run start

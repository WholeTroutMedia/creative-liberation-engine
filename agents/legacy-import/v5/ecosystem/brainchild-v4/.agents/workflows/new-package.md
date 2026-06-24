---
description: Scaffold a new v5 TypeScript package — creates package structure, wires up package.json, exports, and registers in the monorepo
---

# /new-package — Create a New v5 Package

Scaffold a new TypeScript package in the creative-liberation-engine-v5 monorepo.

## Steps

1. Gather package definition from user:
   - **Package name** (kebab-case, e.g. `my-service`)
   - **Description** (one line)
   - **Type** (service / library / tool / mcp-server)
   - **Dependencies** (other packages it needs)

// turbo
2. Create the package directory structure:

```powershell
$pkg = "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\packages\[package-name]"
New-Item -Path "$pkg\src" -ItemType Directory -Force
New-Item -Path "$pkg\src\index.ts" -ItemType File -Force
New-Item -Path "$pkg\package.json" -ItemType File -Force
New-Item -Path "$pkg\tsconfig.json" -ItemType File -Force
New-Item -Path "$pkg\CONTEXT.md" -ItemType File -Force
```

1. Write `package.json` with:
   - `name`: `@cle/[package-name]`
   - `version`: `0.1.0`
   - `main`: `dist/index.js`
   - `types`: `dist/index.d.ts`
   - Standard scripts: `build`, `dev`, `test`
   - Appropriate dependencies

2. Write `tsconfig.json` extending the root tsconfig with strict mode enabled.

3. Write a starter `src/index.ts` with the package's primary export scaffold.

4. Write `CONTEXT.md` with:
   - Package purpose
   - Key exports
   - Usage examples
   - Integration points with other packages

// turbo
7. Install dependencies:

```powershell
npm install --prefix "D:\Google Antigravity\Infusion Engine Brainchild\creative-liberation-engine-v5\packages\[package-name]"
```

1. Confirm: "Package **@cle/[name]** is scaffolded and ready. Start building in `packages/[name]/src/`."

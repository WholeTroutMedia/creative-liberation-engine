import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { hardenComposeFile } from "../packages/compose-hardener/dist/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3] || inputFile;

  if (!inputFile) {
    console.error("Usage: node tools/harden-compose.mjs <input-file> [output-file]");
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`[Compose Hardener CLI] Reading: ${inputFile}`);
  const inputYaml = fs.readFileSync(inputFile, "utf8");

  console.log(`[Compose Hardener CLI] Running DevOps hardening policies...`);
  const hardenedYaml = await hardenComposeFile(inputYaml);

  console.log(`[Compose Hardener CLI] Writing hardened output to: ${outputFile}`);
  fs.writeFileSync(outputFile, hardenedYaml, "utf8");
  console.log(`[Compose Hardener CLI] Hardening completed successfully.`);
}

main().catch((err) => {
  console.error("[Compose Hardener CLI] Execution failed:", err);
  process.exit(1);
});

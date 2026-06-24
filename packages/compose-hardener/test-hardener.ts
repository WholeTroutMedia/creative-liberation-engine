import { config } from 'dotenv';
import { readFileSync, writeFileSync } from 'fs';
import { hardenComposeFile } from './src';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    console.log("[Compose Hardener Test] Reading vulnerable test.yml...");
    const rawYaml = readFileSync('test.yml', 'utf8');

    console.log("[Compose Hardener Test] Beginning hardening sequence...");
    const hardenedYaml = await hardenComposeFile(rawYaml);

    console.log("\n================ HARDENED COMPOSE FILE ==================\n");
    console.log(hardenedYaml);
    console.log("=========================================================\n");

    writeFileSync('test-hardened.yml', hardenedYaml, 'utf8');
    console.log("[Compose Hardener Test] Wrote to test-hardened.yml.");
}

main().catch(console.error);

import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { exec } from 'child_process';
import util from 'util';
import yaml from 'js-yaml';

const execPromise = util.promisify(exec);

// Assuming a NAS-mounted directory for MDX definitions
const NAS_MDX_DIR = '/app/genesis-deploy/runtime/mdx-gitops';
const NAS_DOCKER_COMPOSE_OUTPUT = '/app/genesis-deploy/docker-compose.generated.yml';

console.log(`[MDX-GITOPS] Initializing Sovereign Declarative Infrastructure...`);
console.log(`[MDX-GITOPS] Monitoring: ${NAS_MDX_DIR}`);

if (!fs.existsSync(NAS_MDX_DIR)) {
  fs.mkdirSync(NAS_MDX_DIR, { recursive: true });
}

// Watcher for MDX file changes
const watcher = chokidar.watch(NAS_MDX_DIR, { persistent: true });

watcher.on('add', (filePath) => handleMDXChange(filePath));
watcher.on('change', (filePath) => handleMDXChange(filePath));

async function handleMDXChange(filePath) {
  if (!filePath.endsWith('.mdx')) return;
  console.log(`[MDX-GITOPS] Detected MDX change: ${filePath}`);
  
  try {
    // Parse the MDX file, extract docker-compose yaml blocks,
    // and write them to NAS_DOCKER_COMPOSE_OUTPUT
    console.log(`[MDX-GITOPS] Parsing MDX and generating docker-compose...`);
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Simple regex to extract a YAML code block that looks like docker-compose
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)```/);
    if (!yamlMatch) {
      console.log(`[MDX-GITOPS] No yaml code block found in ${filePath}. Skipping.`);
      return;
    }
    
    const yamlContent = yamlMatch[1];
    let parsedYaml;
    try {
      parsedYaml = yaml.load(yamlContent);
    } catch (e) {
      console.error(`[MDX-GITOPS] Extracted YAML is invalid:`, e.message);
      return;
    }
    
    if (!parsedYaml || !parsedYaml.services) {
       console.log(`[MDX-GITOPS] Valid YAML found, but it doesn't look like a docker-compose (missing 'services'). Skipping.`);
       return;
    }

    fs.writeFileSync(NAS_DOCKER_COMPOSE_OUTPUT, yamlContent);
    console.log(`[MDX-GITOPS] Extracted docker-compose written to ${NAS_DOCKER_COMPOSE_OUTPUT}`);
    
    console.log(`[MDX-GITOPS] Applying infrastructure state...`);
    // Execute docker-compose via CLI
    const { stdout, stderr } = await execPromise(`docker-compose -f ${NAS_DOCKER_COMPOSE_OUTPUT} up -d`);
    if (stdout) console.log(`[MDX-GITOPS] docker-compose stdout:\n${stdout}`);
    if (stderr) console.error(`[MDX-GITOPS] docker-compose stderr:\n${stderr}`);
    
    console.log(`[MDX-GITOPS] Infrastructure state synchronized.`);
  } catch (err) {
    console.error(`[MDX-GITOPS] Failed to apply MDX state:`, err.message);
  }
}

// Keep process alive
setInterval(() => {}, 1000 * 60 * 60);

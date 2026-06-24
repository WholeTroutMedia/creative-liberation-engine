import { AgenticEnterpriseOS } from './index';
import * as path from 'path';

async function runSmokeTest() {
  console.log("=== Starting Enterprise OS Smoke Test ===\n");
  
  const os = new AgenticEnterpriseOS();
  
  // Pointing to the registry file
  const topologyPath = path.join(__dirname, '../../../runtime/registry/enterprise-topology.example.json');
  
  try {
    os.loadTopology(topologyPath);

    // Mock Agents listening to the bus
    os.onReceive('bolt', (msg) => {
      console.log(`[Agent: Bolt] Received work order from ${msg.source}:`, msg.payload);
      // Bolt does work, then reports to keeper
      setTimeout(() => {
         console.log(`[Agent: Bolt] Work complete. Reporting to keeper.`);
         os.dispatch('bolt', 'keeper', { status: 'success', file: 'output.js' });
      }, 500);
    });

    os.onReceive('keeper', (msg) => {
      console.log(`[Agent: Keeper] Received memory update from ${msg.source}:`, msg.payload);
    });

    console.log("\n--- Dispatching Initial Task ---");
    // Aurora starts the chain
    os.dispatch('aurora', 'bolt', { action: 'build_component', name: 'Header' });
    
    // Aurora also logs intent to keeper
    os.dispatch('aurora', 'keeper', { log: 'Initiated Header build' });

    // Test invalid route
    console.log("\n--- Testing Invalid Route ---");
    os.dispatch('keeper', 'aurora', { msg: 'This should fail' });

  } catch (err) {
    console.error("Smoke test failed:", err);
  }
}

runSmokeTest();

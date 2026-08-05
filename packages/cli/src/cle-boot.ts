import { ConstitutionLock } from '@cle/os-kernel';
import { RegistryManager } from '@cle/registry';

async function boot() {
  console.log('Booting Creative Liberation Engine (CLE)...');
  
  // 1. Enforce Quantum Lock
  const constitution = ConstitutionLock.verifyOrHalt();
  console.log('--- CONSTITUTION LOADED ---');
  console.log(constitution.substring(0, 150) + '...\n---------------------------');

  // 2. Load Memory Registry
  const status = RegistryManager.loadSystemStatus();
  console.log('[REGISTRY] System status:', status);

  console.log('\n[CLE-OS] System online. Agent swarms ready for dispatch.');
}

boot().catch(console.error);


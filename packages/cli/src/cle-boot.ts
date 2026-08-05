import { ConstitutionLock } from '@cle/os-kernel';
import { RegistryManager } from '@cle/registry';

async function boot() {
  console.log('Booting Creative Liberation Engine (CLE)...');
  
  // 1. Enforce Quantum Lock (Checks integrity of CONSTITUTION.md)
  ConstitutionLock.verifyIntegrity();

  // 2. Load Memory Registry
  const status = RegistryManager.loadSystemStatus();
  console.log('[REGISTRY] System status:', status);

  console.log('\n[CLE-OS] System online. Agent swarms ready for dispatch.');
}

boot().catch(console.error);


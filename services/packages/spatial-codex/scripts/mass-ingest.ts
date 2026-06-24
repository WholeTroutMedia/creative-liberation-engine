import { ingestHardwareSpec } from '../src/index.ts';

const targetBlueprints = [
    "Samsung Family Hub Refrigerator (Smart Kitchen)",
    "LG WashTower (Smart Laundry Center)",
    "Dolphin Nautilus CC Plus (Robotic Pool Cleaner)",
    "Tesla Powerwall 3 (Home Energy Storage)",
    "Oura Ring Gen 3 (Biometric Wearable)",
    "Nest Learning Thermostat (Smart HVAC)",
    "Ring Floodlight Cam Wired Pro (Smart Security)",
    "DJI Mini 4 Pro (Consumer Drone)",
    "Onewheel GT S-Series (Electric Transportation)",
    "Vitamix Ascent A3500 (Smart Blender)"
];

async function runMassIngestion() {
    console.log('================================================');
    console.log('[Spatial-Codex] Commencing Mass Hardware Ingestion (Wave 40)');
    console.log('================================================');

    for (const target of targetBlueprints) {
        try {
            console.log(`\n-> Queuing Ingestion: ${target}`);
            const result = await ingestHardwareSpec(target);
            console.log(`   [Success] Saved ${result.deviceClass} blueprint.`);
        } catch (error) {
            console.error(`   [Error] Failed to ingest ${target}:`, error instanceof Error ? error.message : error);
        }
    }

    console.log('\n================================================');
    console.log('[Spatial-Codex] Hardware Library Population Complete');
}

runMassIngestion().catch(console.error);

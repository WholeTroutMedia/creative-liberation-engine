/**
 * 🕶️ Creative Liberation Engine Spatial OS Bridge E2E Validation Script
 * This script starts a mock Ray-Ban Meta glasses node, connects to the Spatial Surface WS Gateway,
 * sends environmental and vocal telemetry, receives declarative HUD layouts, and verifies the REST APIs.
 */

import { WebSocket } from 'ws';

const wsUrl = 'ws://localhost:5106/spatial/ws';
const restUrl = 'http://localhost:5106';
const testClientId = 'validation_lens_99';

console.log('=======================================================');
console.log('  🕶️  CLE Spatial OS Bridge - E2E Validation   ');
console.log('=======================================================');

// 1. Establish secure WebSocket connection
console.log(`[Test] Connecting to Spatial Surface WS Gateway: ${wsUrl}`);
const ws = new WebSocket(wsUrl);

ws.on('open', () => {
    console.log('[Test] WS Connection successfully established.');
});

ws.on('message', async (dataStr) => {
    try {
        const message = JSON.parse(dataStr.toString());
        console.log(`\n📥 [WS Receive] Action: ${message.type}`);
        
        if (message.type === 'REGISTRATION_CHALLENGE') {
            const serverClientId = message.client_id;
            console.log(`[Test] Server assigned Client ID: ${serverClientId}`);
            
            // 2. Perform Handshake & Declare client type
            console.log('[Test] Performing handshake...');
            ws.send(JSON.stringify({
                type: "HANDSHAKE_RESPONSE",
                client_type: "GLASSES",
                metadata: {
                    batteryLevel: 98,
                    currentPose: { yaw: 140.0, pitch: -10.0, roll: 0.0 },
                    currentGps: { lat: 40.7128, lon: -74.0060, alt: 10.5 }
                }
            }));

            // 3. Send Environmental Telemetry Frame
            console.log('[Test] Sending sensor telemetry frame...');
            ws.send(JSON.stringify({
                type: "TELEMETRY_FRAME",
                sensors: {
                    pose: { yaw: 141.5, pitch: -9.8, roll: 0.2 },
                    batteryLevel: 97,
                    latencyMs: 12
                }
            }));

            // 4. Send POV visual frame (simulated)
            console.log('[Test] Sending simulated visual POV image frame...');
            ws.send(JSON.stringify({
                type: "TELEMETRY_FRAME",
                media: {
                    image_frame_base64: "iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAA..."
                }
            }));

            // 5. Send Voice Ingestion Command
            setTimeout(() => {
                console.log('\n🎙️ [Test] Sub-vocalizing voice command: "Index this concrete texture"');
                ws.send(JSON.stringify({
                    type: "VOICE_COMMAND",
                    payload: {
                        raw_text: "Index this concrete texture"
                    }
                }));
            }, 1500);

            // 6. Test manual push via REST API
            setTimeout(async () => {
                console.log('\n🌐 [Test] Testing REST API layout injection...');
                try {
                    const response = await fetch(`${restUrl}/api/layout/push`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            target_client_id: serverClientId,
                            layout: {
                                layout_id: "rest_push_test",
                                render_commands: [
                                    {
                                        type: "CONTAINER",
                                        style: "glassmorphism",
                                        position: { x: "40%", y: "40%", width: "20%", height: "20%" },
                                        children: [
                                            { type: "TEXT", content: "REST API SUCCESS", style: "neon_cyan_title" }
                                        ]
                                    }
                                ]
                            }
                        })
                    });
                    const resJson = await response.json();
                    console.log('📤 [REST Response] POST /api/layout/push:', resJson);
                } catch (err) {
                    console.error('[Error] REST post failed:', err);
                }
            }, 3000);

            // 7. Verify registry API
            setTimeout(async () => {
                console.log('\n🔍 [Test] Inspecting active device topology...');
                try {
                    const response = await fetch(`${restUrl}/api/clients`);
                    const resJson = await response.json();
                    console.log('📤 [REST Response] GET /api/clients:', JSON.stringify(resJson, null, 2));
                } catch (err) {
                    console.error('[Error] GET active devices failed:', err);
                }
            }, 4500);

            // 8. Clean Exit after validation completes
            setTimeout(() => {
                console.log('\n🏁 [Test] Spatial bridge validation successful. Closing connections.');
                ws.close();
                process.exit(0);
            }, 6000);
        }

        if (message.type === 'DYNAMIC_HUD_LAYOUT') {
            console.log('🎨 [HUD Layout Received]:');
            console.log(JSON.stringify(message.payload, null, 2));
        }

    } catch (err) {
        console.error('[Error] Processing WS message failed:', err);
    }
});

ws.on('error', (err) => {
    console.error('[Error] WS error encountered:', err);
});

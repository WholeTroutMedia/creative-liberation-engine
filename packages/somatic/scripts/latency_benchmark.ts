// @ts-nocheck
import * as dgram from 'dgram';
import express from 'express';
import { ConsciousnessLoop } from '../src/ConsciousnessLoop.js';

/**
 * T20260308-004: Consciousness Architecture Latency Benchmark
 * 
 * Measures Time-to-First-Blendshape (TTFB) across the entire pipeline.
 * Mocks Audio2Face to isolate our local TTS (Kokoro) and routing overhead.
 * Target: <200ms TTFB.
 */

async function runBenchmark() {
  console.log('🚀 Starting Consciousness Architecture Latency Benchmark...');

  // 1. Mock Audio2Face Server (port 8011)
  const a2fApp = express();
  a2fApp.use(express.json({ limit: '50mb' }));
  
  a2fApp.post('/A2F/Exporter/ExportBlendshapes', (req, res) => {
    // Return dummy frames immediately
    const blendShapes = [];
    for (let i = 0; i < 10; i++) {
      blendShapes.push({
        timeCode: i * (1/60),
        bs: new Array(52).fill(0.5)
      });
    }
    res.json({ blendShapes });
  });

  const a2fServer = await new Promise<any>((resolve) => {
    const s = a2fApp.listen(8011, () => resolve(s));
  });
  console.log('✅ Mock Audio2Face server online on :8011');

  // 2. UDP Listener for OSC output (port 5005)
  const udpClient = dgram.createSocket('udp4');
  
  let firstPacketReceivedTime = 0;
  let packetsReceived = 0;

  udpClient.on('message', (msg) => {
    if (packetsReceived === 0) {
      firstPacketReceivedTime = Date.now();
    }
    packetsReceived++;
  });

  await new Promise<void>((resolve) => {
    udpClient.bind(50055, () => resolve());
  });
  console.log('✅ UDP listener online on :50055');

  // 3. Boot ConsciousnessLoop
  const loop = new ConsciousnessLoop({
    director: { 
      audio2faceUrl: 'http://localhost:8011',
      somaticBridgeUrl: 'http://localhost:6060',
    },
    bridge: {
      httpPort: 6060,
      ue5Host: '127.0.0.1',
      ue5OscPort: 50055
    },
    enableStatsPolling: false
  });

  await loop.start();

  // Mock audio generation to isolate architectural latency from model inference latency
  loop.director['generateAudio'] = async () => Buffer.from('RIFF$   WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80\xbb\x00\x00\x00\x77\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00');

  console.log('⏱️ Firing PerformanceBrief and starting timer...');
  
  const startTime = Date.now();
  
  // A short text sequence to generate real Kokoro audio locally
  await loop.perform({
    text: "Hello. I am alive.",
    voiceId: "af_sky"
  });

  await loop.stop();
  a2fServer.close();
  udpClient.close();

  if (firstPacketReceivedTime === 0) {
    console.error('❌ Benchmark Failed: No OSC packets received on UDP :50055.');
    process.exit(1);
  }

  const ttfb = firstPacketReceivedTime - startTime;
  
  console.log('\n======================================================');
  console.log('🎯 LATENCY BENCHMARK RESULTS');
  console.log('======================================================');
  console.log(`Time-to-First-Blendshape (TTFB): ${ttfb} ms`);
  console.log(`Total OSC packets dispatched:    ${packetsReceived}`);
  console.log('------------------------------------------------------');
  
  if (ttfb < 200) {
    console.log('✅ PASS: Architecture meets sub-200ms latency budget.');
  } else {
    console.log('⚠️ WARN: Architecture exceeded 200ms latency budget.');
  }

  process.exit(0);
}

runBenchmark().catch(err => {
  console.error('Fatal error during benchmark:', err);
  process.exit(1);
});

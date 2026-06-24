import { SlideController } from './slides/controller.js';
import { ParticleEngine } from './engine/particles.js';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Setup the WebGL / Particle background
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    const engine = new ParticleEngine(canvas, 10000); // 10k particles
    const initSuccess = await engine.init();
    if (initSuccess) {
      engine.start();
      // Add subtle heartbeat to particles
      let time = 0;
      setInterval(() => {
        time += 0.05;
        const phase = (time % 1.0);
        engine.setHeartPhase(phase);
        engine.setArousal(0.2); // Calm
      }, 50);
    }
  }

  // 2. Initialize the spatial Bento Presentation controller
  const controller = new SlideController();
  controller.init();
});

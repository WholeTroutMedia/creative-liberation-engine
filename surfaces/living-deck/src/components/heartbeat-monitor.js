/**
 * HeartbeatMonitor — Canvas waveform visualization
 * Draws a real-time ECG-style pulse line synced to biometric data
 */

export class HeartbeatMonitor {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.history = new Float32Array(200).fill(0.5);
    this.writePos = 0;
    this.arousal = 0;
  }

  /**
   * Record a heartbeat event
   */
  recordBeat() {
    // Insert a spike at current position
    const pos = this.writePos;
    const len = this.history.length;
    // QRS complex shape
    this.history[(pos) % len] = 0.3;
    this.history[(pos + 1) % len] = 0.1;
    this.history[(pos + 2) % len] = 0.95; // R peak
    this.history[(pos + 3) % len] = 0.15;
    this.history[(pos + 4) % len] = 0.4;
    this.history[(pos + 5) % len] = 0.55;
    this.writePos = (pos + 6) % len;
  }

  /**
   * Advance the waveform (call at ~30Hz)
   */
  tick() {
    // Decay toward baseline
    this.history[this.writePos] = 0.5 + (Math.random() - 0.5) * 0.02;
    this.writePos = (this.writePos + 1) % this.history.length;
  }

  setArousal(v) {
    this.arousal = v;
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // Get computed pulse color from CSS
    const style = getComputedStyle(document.documentElement);
    const pulseColor = style.getPropertyValue('--pulse-color').trim() || 'hsl(190, 90%, 60%)';

    // Draw waveform
    ctx.beginPath();
    ctx.strokeStyle = pulseColor;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';

    const len = this.history.length;
    const step = w / len;
    const readStart = (this.writePos + 1) % len;

    for (let i = 0; i < len; i++) {
      const idx = (readStart + i) % len;
      const x = i * step;
      const y = h - this.history[idx] * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Glow effect
    ctx.shadowColor = pulseColor;
    ctx.shadowBlur = 6 + this.arousal * 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

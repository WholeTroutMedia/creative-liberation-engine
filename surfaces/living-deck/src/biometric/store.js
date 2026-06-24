/**
 * BiometricStore — Simulated biometric state manager
 * In production, this connects to the PULSE rPPG pipeline via WebSocket.
 * For demo/dev, it generates realistic simulated heart rate data.
 */

export class BiometricStore {
  constructor() {
    this.hr = 72;           // Heart rate (BPM)
    this.hrv = 50;          // Heart rate variability (RMSSD ms)
    this.arousal = 0.0;     // Normalized arousal (0.0–1.0)
    this.heartPhase = 0.0;  // Current beat phase (0.0–1.0)
    this.lastBeatTime = 0;
    this.beatInterval = 60 / 72 * 1000; // ms between beats
    this.isLive = false;    // True when connected to real PULSE
    this.listeners = new Set();
    this._simInterval = null;
    this._simPhase = 0;

    // Simulated HR wander parameters
    this._baseHR = 68;
    this._hrTarget = 68;
    this._breathCycle = 0;
  }

  /**
   * Subscribe to beat events
   * @param {Function} cb - Called on each heartbeat with { hr, hrv, arousal, heartPhase }
   */
  onBeat(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Start simulated biometric data
   * Creates realistic HR wander with respiratory sinus arrhythmia
   */
  startSimulation() {
    this.lastBeatTime = performance.now();
    this._simInterval = setInterval(() => this._simTick(), 16); // 60Hz update
    // Slowly change HR target to simulate engagement changes
    this._wanderInterval = setInterval(() => {
      this._hrTarget = 60 + Math.random() * 40; // 60–100 BPM range
    }, 8000);
  }

  _simTick() {
    const now = performance.now();

    // Respiratory sinus arrhythmia (HR varies with breathing ~15bpm/min)
    this._breathCycle += 0.002;
    const breathMod = Math.sin(this._breathCycle) * 4;

    // Smooth HR toward target
    this._baseHR += (this._hrTarget - this._baseHR) * 0.002;
    this.hr = this._baseHR + breathMod + (Math.random() - 0.5) * 1.5;
    this.hr = Math.max(50, Math.min(130, this.hr));

    this.beatInterval = 60 / this.hr * 1000;

    // Calculate arousal from HR (normalized: 55bpm=0.0, 120bpm=1.0)
    this.arousal = Math.max(0, Math.min(1, (this.hr - 55) / 65));

    // HRV simulation (higher at rest, lower when excited)
    this.hrv = 80 - this.arousal * 50 + (Math.random() - 0.5) * 10;

    // Heart phase (0.0 at beat, climbs to 1.0 before next beat)
    const elapsed = now - this.lastBeatTime;
    this.heartPhase = Math.min(1.0, elapsed / this.beatInterval);

    // Trigger beat
    if (elapsed >= this.beatInterval) {
      this.lastBeatTime = now;
      this.heartPhase = 0;
      this._notifyBeat();
    }
  }

  _notifyBeat() {
    const data = {
      hr: this.hr,
      hrv: this.hrv,
      arousal: this.arousal,
      heartPhase: this.heartPhase,
      timestamp: performance.now(),
    };
    this.listeners.forEach(cb => cb(data));
  }

  /**
   * Manual arousal override (for keyboard demo control)
   */
  setArousal(v) {
    this._hrTarget = 55 + v * 65;
  }

  /**
   * Get current state snapshot
   */
  getState() {
    return {
      hr: this.hr,
      hrv: this.hrv,
      arousal: this.arousal,
      heartPhase: this.heartPhase,
      isLive: this.isLive,
    };
  }

  stop() {
    if (this._simInterval) clearInterval(this._simInterval);
    if (this._wanderInterval) clearInterval(this._wanderInterval);
  }
}

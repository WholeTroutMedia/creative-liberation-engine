/**
 * AudioEngine — Procedural heartbeat synthesis + ambient sound
 * Synced to biometric heart rate for immersive audio feedback
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.arousal = 0;
    this.masterGain = null;
    this.heartGain = null;
    this.ambientGain = null;
    this.ambientFilter = null;
    this.ambientSource = null;
  }

  async init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3;
      this.masterGain.connect(this.ctx.destination);

      // Heartbeat channel
      this.heartGain = this.ctx.createGain();
      this.heartGain.gain.value = 0.5;
      const heartReverb = this.ctx.createConvolver();
      // Simple reverb using noise buffer
      const reverbBuffer = this._createReverbBuffer(1.5);
      heartReverb.buffer = reverbBuffer;
      this.heartGain.connect(heartReverb);
      heartReverb.connect(this.masterGain);
      this.heartGain.connect(this.masterGain); // Dry path too

      // Ambient channel (pink noise through bandpass)
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.08;
      this.ambientFilter = this.ctx.createBiquadFilter();
      this.ambientFilter.type = 'bandpass';
      this.ambientFilter.frequency.value = 200;
      this.ambientFilter.Q.value = 0.8;

      // Create pink noise
      const noiseBuffer = this._createPinkNoise(3);
      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = noiseBuffer;
      this.ambientSource.loop = true;
      this.ambientSource.connect(this.ambientFilter);
      this.ambientFilter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      this.isPlaying = false;
      return true;
    } catch (e) {
      console.warn('[AudioEngine] Init failed:', e);
      return false;
    }
  }

  start() {
    if (this.isPlaying || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.ambientSource.start(0);
    this.isPlaying = true;
  }

  /**
   * Trigger a heartbeat sound
   * @param {number} bpm - Current heart rate
   */
  triggerBeat(bpm = 72) {
    if (!this.ctx || !this.isPlaying) return;
    const now = this.ctx.currentTime;

    // Low thump oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);

    // Envelope
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.6 + this.arousal * 0.4, now + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(env);
    env.connect(this.heartGain);
    osc.start(now);
    osc.stop(now + 0.35);

    // Secondary "lub" (slightly delayed)
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(45, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(25, now + 0.2);

    const env2 = this.ctx.createGain();
    env2.gain.setValueAtTime(0, now + 0.08);
    env2.gain.linearRampToValueAtTime(0.3 + this.arousal * 0.2, now + 0.10);
    env2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc2.connect(env2);
    env2.connect(this.heartGain);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.3);
  }

  /**
   * Update ambient parameters based on arousal
   */
  updateArousal(arousal) {
    this.arousal = arousal;
    if (!this.ctx || !this.isPlaying) return;

    // Filter frequency: calm=200Hz, excited=800Hz
    const freq = 200 + arousal * 600;
    this.ambientFilter.frequency.exponentialRampToValueAtTime(
      freq, this.ctx.currentTime + 0.3
    );

    // Volume increases slightly with arousal
    this.ambientGain.gain.linearRampToValueAtTime(
      0.06 + arousal * 0.08, this.ctx.currentTime + 0.3
    );
  }

  setVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.1);
    }
  }

  _createPinkNoise(seconds) {
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(2, sampleRate * seconds, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  _createReverbBuffer(seconds) {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = this.ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    return buffer;
  }

  stop() {
    if (this.ctx) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }
  }
}

/**
 * The Transmission — Immersive Audio Engine
 *
 * Synthesizes retro terminal soundscapes and tactical UI interface feedback
 * completely in-code via the HTML5 Web Audio API. No large external assets needed.
 * Constitutional: Article IX (No MVPs) — sound design elevates the site to a premium state.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private humOsc: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private isHumming = false;

  private init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  playClick() {
    try {
      this.resume();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.05);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch { /* AudioContext blocked or uninitialized */ }
  }

  playStatic(duration = 0.15) {
    try {
      this.resume();
      if (!this.ctx) return;

      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // Populate white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.Q.setValueAtTime(3, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noiseNode.start();
      noiseNode.stop(this.ctx.currentTime + duration);
    } catch { /* ignore */ }
  }

  playSignalReceived() {
    try {
      this.resume();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.setValueAtTime(1760, now + 0.08); // A6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.setValueAtTime(880, now + 0.08); // A5

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    } catch { /* ignore */ }
  }

  startHum() {
    try {
      this.resume();
      if (!this.ctx || this.isHumming) return;

      this.isHumming = true;
      const now = this.ctx.currentTime;

      // 60Hz hum + 120Hz harmonic
      this.humOsc = this.ctx.createOscillator();
      this.humOsc.type = 'sine';
      this.humOsc.frequency.setValueAtTime(60, now);

      this.humGain = this.ctx.createGain();
      this.humGain.gain.setValueAtTime(0.0, now);
      this.humGain.gain.linearRampToValueAtTime(0.015, now + 1.0); // smooth fade-in

      // LFO for slight pitch sync instability
      this.lfo = this.ctx.createOscillator();
      this.lfo.frequency.setValueAtTime(0.5, now); // 0.5Hz drift
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(0.25, now); // +/- 0.25Hz

      this.lfo.connect(lfoGain);
      lfoGain.connect(this.humOsc.frequency);
      this.humOsc.connect(this.humGain);
      this.humGain.connect(this.ctx.destination);

      this.lfo.start();
      this.humOsc.start();
    } catch { /* ignore */ }
  }

  stopHum() {
    try {
      if (!this.ctx || !this.isHumming) return;
      this.isHumming = false;

      const now = this.ctx.currentTime;
      if (this.humGain) {
        this.humGain.gain.cancelScheduledValues(now);
        this.humGain.gain.setValueAtTime(this.humGain.gain.value, now);
        this.humGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      }

      const oscToStop = this.humOsc;
      const lfoToStop = this.lfo;

      setTimeout(() => {
        try {
          oscToStop?.stop();
          lfoToStop?.stop();
        } catch {}
      }, 600);

      this.humOsc = null;
      this.lfo = null;
      this.humGain = null;
    } catch { /* ignore */ }
  }
}

export const SignalAudio = new AudioEngine();

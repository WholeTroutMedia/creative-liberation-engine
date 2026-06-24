import { useEffect, useRef } from 'react';

export function useAudioFeedback(telemetry) {
  const audioCtxRef = useRef(null);
  const humOscillatorRef = useRef(null);
  const humGainRef = useRef(null);

  useEffect(() => {
    // Initialize Web Audio API on first interaction or mount
    const initAudio = () => {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        
        // Setup background hum
        const osc = audioCtxRef.current.createOscillator();
        const gainNode = audioCtxRef.current.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, audioCtxRef.current.currentTime); // Low hum (A1)
        
        gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtxRef.current.destination);
        
        osc.start();
        
        humOscillatorRef.current = osc;
        humGainRef.current = gainNode;
      }
    };

    // User interaction is required to start audio in modern browsers
    const handleInteraction = () => {
      initAudio();
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      document.removeEventListener('click', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      if (humOscillatorRef.current) {
        humOscillatorRef.current.stop();
        humOscillatorRef.current.disconnect();
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (!audioCtxRef.current || !humGainRef.current) return;

    // Map global heat to hum volume and frequency
    const heatRatio = telemetry.globalHeat / 100;
    
    // Volume: 0 to 0.1 (subtle)
    const targetGain = 0.02 + (heatRatio * 0.08);
    humGainRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.5);
    
    // Pitch: 55Hz to 65Hz
    const targetFreq = 55 + (heatRatio * 10);
    if (humOscillatorRef.current) {
      humOscillatorRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.5);
    }

    // Play a chirp if latency spikes or nodes change significantly
    // (This is a simplistic simulation of procedural events)
    if (telemetry.latency > 50 || Math.random() > 0.8) {
      playChirp();
    }
  }, [telemetry.globalHeat, telemetry.latency, telemetry.nodesActive]);

  const playChirp = () => {
    if (!audioCtxRef.current) return;
    
    const osc = audioCtxRef.current.createOscillator();
    const gain = audioCtxRef.current.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtxRef.current.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, audioCtxRef.current.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, audioCtxRef.current.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(audioCtxRef.current.destination);
    
    osc.start();
    osc.stop(audioCtxRef.current.currentTime + 0.15);
  };
}

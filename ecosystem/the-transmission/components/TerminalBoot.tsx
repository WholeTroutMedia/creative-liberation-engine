'use client';

import { useEffect, useState } from 'react';
import { SignalAudio } from '@/lib/SignalAudio';

interface TerminalBootProps {
  onComplete: () => void;
}

const BOOT_LINES = [
  'CLE ENGINE SYSTEMS // NETWORK GATEWAY v6.0.0',
  'ESTABLISHING ENCRYPTED LINK TO SOVEREIGN DATA SPINE...',
  'AVERI HIVE CONSOLE RESPONSE: ATHENA // VERA // IRIS: ACTIVE',
  'TUNING INTERCEPT RECEIVERS TO SOVEREIGN SPECTRUM...',
  'INITIATING DECRYPTION ON CARRIER WAVES...',
  'DYNAMIC SIGNAL BUFFER SPINDLE STABILIZED...',
  'CRT SCREEN IONIZED GLASS EMISSION ACTIVE...',
  'UPLINK TRANSCEIVER SYNCHRONIZED WITH FEED STREAM...',
  'CONNECTION SECURED. DECODING INCOMING SECTORS...',
];

export default function TerminalBoot({ onComplete }: TerminalBootProps) {
  const [visibleLines, setVisibleLines] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isBooted, setIsBooted] = useState(false);
  const [interacted, setInteracted] = useState(false);

  useEffect(() => {
    if (currentIndex < BOOT_LINES.length) {
      const delay = Math.random() * 200 + 100; // randomized delay for organic typing feel
      const timer = setTimeout(() => {
        setVisibleLines((prev) => [...prev, BOOT_LINES[currentIndex]!]);
        setCurrentIndex((prev) => prev + 1);
        try {
          SignalAudio.playClick();
        } catch {}
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setIsBooted(true);
    }
  }, [currentIndex]);

  const handleStart = () => {
    setInteracted(true);
    try {
      SignalAudio.resume();
      SignalAudio.playStatic(0.3);
      SignalAudio.startHum();
    } catch {}
    setTimeout(() => {
      onComplete();
    }, 400);
  };

  return (
    <div className={`boot-overlay ${interacted ? 'boot-fade-out' : ''}`}>
      <div className="boot-terminal">
        <div className="boot-header">
          <span>CLE ENGINE SYSTEMS // RECEIVER TERMINAL v6_</span>
          <span className="boot-status-badge">SECURE</span>
        </div>
        <div className="boot-body">
          {visibleLines.map((line, idx) => (
            <div key={idx} className="boot-line">
              <span className="boot-line-prompt">&gt;</span> {line}
            </div>
          ))}
          {isBooted && !interacted && (
            <div className="boot-prompt-action anim-blink" onClick={handleStart}>
              [ CLICK TO INTERCEPT SIGNAL BROADCAST_ ]
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransmissionWorldState } from '@/lib/types';
import { SignalAudio } from '@/lib/SignalAudio';

const GENKIT_URL = process.env['NEXT_PUBLIC_GENKIT_URL'] ?? 'http://localhost:4100';

export default function WorldStatePanel() {
  const [world, setWorld] = useState<TransmissionWorldState | null>(null);
  const [uplinkInput, setUplinkInput] = useState('');
  const [uplinkStatus, setUplinkStatus] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const angleRef = useRef(0);

  // Fetch world state
  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch(`${GENKIT_URL}/transmission/world`);
        if (res.ok) setWorld(await res.json() as TransmissionWorldState);
      } catch { /* engine offline */ }
    }
    fetch_();
    const interval = setInterval(fetch_, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Radar Animation Loop
  useEffect(() => {
    if (!world || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    // Define location nodes on the radar based on hotLocations
    const nodes = world.hotLocations.map((loc, idx) => {
      // Deterministically place nodes based on string hashes
      let hash = 0;
      for (let i = 0; i < loc.length; i++) {
        hash = loc.charCodeAt(i) + ((hash << 5) - hash);
      }
      const angle = (hash % 360) * (Math.PI / 180);
      const radius = 40 + (Math.abs(hash) % 70); // limit radius inside canvas bounds (125px center)
      return {
        name: loc,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        intensity: 0.2 + (idx * 0.15) % 0.8,
      };
    });

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Clear with slight alpha to create phosphor trails
      ctx.fillStyle = 'rgba(10, 10, 10, 0.15)';
      ctx.fillRect(0, 0, w, h);

      // Draw Grid Rings
      ctx.strokeStyle = 'rgba(0, 255, 65, 0.08)';
      ctx.lineWidth = 1;
      for (let r = 30; r <= 110; r += 30) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(cx - 120, cy); ctx.lineTo(cx + 120, cy);
      ctx.moveTo(cx, cy - 120); ctx.lineTo(cx, cy + 120);
      ctx.stroke();

      // Sweeping Sweep Line
      angleRef.current = (angleRef.current + 0.02) % (Math.PI * 2);
      const sweepAngle = angleRef.current;

      const sweepGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
      sweepGradient.addColorStop(0, 'rgba(0, 255, 65, 0.02)');
      sweepGradient.addColorStop(0.8, 'rgba(0, 255, 65, 0.05)');
      sweepGradient.addColorStop(1, 'rgba(0, 255, 65, 0.15)');

      ctx.strokeStyle = 'rgba(0, 255, 65, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * 120, cy + Math.sin(sweepAngle) * 120);
      ctx.stroke();

      // Draw active location nodes
      nodes.forEach((node) => {
        const nx = cx + node.x;
        const ny = cy + node.y;

        // Calculate angle between sweep line and node to trigger blink
        const nodeAngle = Math.atan2(node.y, node.x);
        let diff = Math.abs(sweepAngle - (nodeAngle < 0 ? nodeAngle + Math.PI * 2 : nodeAngle));
        if (diff > Math.PI) diff = Math.PI * 2 - diff;

        const isHit = diff < 0.12;

        ctx.fillStyle = isHit
          ? 'rgba(0, 255, 65, 1)'
          : `rgba(0, 255, 65, ${node.intensity * 0.4})`;

        // Pulse scale
        const size = isHit ? 4 : 2;

        ctx.beginPath();
        ctx.arc(nx, ny, size, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing glow rings for nodes
        if (isHit) {
          ctx.strokeStyle = 'rgba(0, 255, 65, 0.5)';
          ctx.beginPath();
          ctx.arc(nx, ny, 10, 0, Math.PI * 2);
          ctx.stroke();

          // Print label text near sweep collision
          ctx.font = '7px "IBM Plex Mono", Courier, monospace';
          ctx.fillStyle = 'rgba(0, 255, 65, 0.85)';
          ctx.fillText(node.name.toUpperCase(), nx + 6, ny - 2);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [world]);

  const handleUplinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uplinkInput.trim()) return;

    try {
      SignalAudio.playClick();
      SignalAudio.playStatic(0.2);
      setUplinkStatus('UPLINK BROADCASTING...');

      const response = await fetch(`${GENKIT_URL}/transmission/reader`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          artifactId: 'uplink_console_command',
          action:     'modulate',
          tags:       [uplinkInput.trim()],
        }),
      });

      if (response.ok) {
        setUplinkStatus('BROADCAST SUCCESS // SIGNAL MODULATED');
        setUplinkInput('');
        // Play success tone
        setTimeout(() => SignalAudio.playSignalReceived(), 300);
      } else {
        setUplinkStatus('UPLINK FAILURE // TIMEOUT');
      }
    } catch {
      setUplinkStatus('OFFLINE // CONNECTION LOST');
    }

    setTimeout(() => {
      setUplinkStatus(null);
    }, 4000);
  };

  if (!world) return (
    <aside className="world-panel">
      <div className="world-panel-title">WORLD STATE</div>
      <div className="loading-flicker" style={{ fontSize: '0.65rem', color: 'var(--signal-dim)', letterSpacing: '0.1em' }}>
        DECODING BANDWIDTH_
      </div>
    </aside>
  );

  const signalPct = Math.round(world.signalStrength * 100);

  return (
    <aside className="world-panel">
      <div className="world-panel-title">WORLD DIAGNOSTIC</div>

      {/* Signal Strength & Epoch */}
      <div className="world-stat">
        <div className="world-stat-label">System Epoch</div>
        <div className="world-stat-value">
          <span className="epoch-badge">
            <span className="epoch-badge-dot" />
            {world.epoch}
          </span>
        </div>
      </div>

      <div className="world-stat">
        <div className="world-stat-label">Interception Bandwidth</div>
        <div className="world-stat-value" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{signalPct}%</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--crt-green-dim)' }}>
            {world.signalStrength > 0.6 ? 'SECURE' : 'DISTORTED'}
          </span>
        </div>
        <div className="signal-bar">
          <div className="signal-bar-fill" style={{ width: `${signalPct}%` }} />
        </div>
      </div>

      {/* Tactical Radar Display */}
      <div className="world-stat" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0' }}>
        <div className="world-stat-label" style={{ alignSelf: 'flex-start' }}>SECTOR SIGNAL SCAN</div>
        <div className="radar-container">
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            className="radar-canvas"
          />
        </div>
      </div>

      <div className="world-stat">
        <div className="world-stat-label">Dominant Vector</div>
        <div className="world-stat-value text-glow" style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>
          {world.dominantTheme}
        </div>
      </div>

      {world.activeFactions.length > 0 && (
        <div className="world-stat">
          <div className="world-stat-label">Identified Factions</div>
          <ul className="faction-list">
            {world.activeFactions.map((f) => (
              <li key={f} className="faction-item" style={{ fontSize: '0.7rem' }}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Direct Signal Modulation Uplink console */}
      <div className="world-stat" style={{ borderTop: '1px dashed var(--crt-green-ghost)', paddingTop: '20px', marginTop: '20px' }}>
        <div className="world-stat-label">SIGNAL MODULATION UPLINK</div>
        <form onSubmit={handleUplinkSubmit} className="uplink-form">
          <div className="uplink-input-container">
            <span className="uplink-prompt">UPLINK_CMD&gt;</span>
            <input
              type="text"
              value={uplinkInput}
              onChange={(e) => {
                setUplinkInput(e.target.value);
                try { SignalAudio.playClick(); } catch {}
              }}
              placeholder="ENTER VECTOR THEME..."
              className="uplink-textbox"
              disabled={!!uplinkStatus}
            />
          </div>
          {uplinkStatus && (
            <div className="uplink-status anim-blink">{uplinkStatus}</div>
          )}
        </form>
      </div>
    </aside>
  );
}

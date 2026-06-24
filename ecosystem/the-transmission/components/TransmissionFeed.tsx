'use client';

import { useEffect, useRef, useState } from 'react';
import type { TransmissionArtifact } from '@/lib/types';
import { ARTIFACT_KIND_LABELS, formatInWorldTime } from '@/lib/types';
import Link from 'next/link';
import { SignalAudio } from '@/lib/SignalAudio';

const GENKIT_URL = process.env['NEXT_PUBLIC_GENKIT_URL'] ?? 'http://localhost:4100';

interface ArtifactCardProps {
  artifact: TransmissionArtifact;
  entering?: boolean;
}

function ArtifactCard({ artifact, entering }: ArtifactCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const kindLabel = ARTIFACT_KIND_LABELS[artifact.kind] ?? artifact.kind.toUpperCase();

  // Send silent reader signal on mount (view dwell increment)
  useEffect(() => {
    fetch(`${GENKIT_URL}/transmission/reader`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ artifactId: artifact.id, action: 'view', tags: artifact.tags }),
    }).catch(() => { /* fire and forget */ });
  }, [artifact.id, artifact.tags]);

  // Visual static corruption rendering for card backgrounds
  useEffect(() => {
    if (artifact.corruption < 0.3 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderNoise = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Render localized noise lines/static depending on corruption level
      const noiseColor = `rgba(0, 255, 65, ${artifact.corruption * 0.08})`;
      ctx.fillStyle = noiseColor;

      const dots = Math.floor(artifact.corruption * 40);
      for (let i = 0; i < dots; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const sz = Math.random() * 2 + 1;
        ctx.fillRect(x, y, sz, sz);
      }

      // Occasional horizontal glitch lines
      if (Math.random() < 0.15) {
        ctx.strokeStyle = `rgba(0, 255, 65, ${artifact.corruption * 0.15})`;
        ctx.lineWidth = 1;
        const gy = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      animId = requestAnimationFrame(renderNoise);
    };

    renderNoise();
    return () => cancelAnimationFrame(animId);
  }, [artifact.corruption]);

  const cardClick = () => {
    try {
      SignalAudio.playClick();
      SignalAudio.playStatic(0.12);
    } catch {}
  };

  return (
    <Link href={`/${artifact.id}`} style={{ display: 'block' }} onClick={cardClick}>
      <div className={`artifact-card ${entering ? 'entering' : ''} ${artifact.corruption > 0.6 ? 'corrupted-high' : ''}`}>
        {artifact.corruption >= 0.3 && (
          <canvas
            ref={canvasRef}
            width={600}
            height={150}
            className="artifact-card-static-canvas"
          />
        )}
        <div className="artifact-meta">
          <span className="artifact-kind">{kindLabel}</span>
          <span className="artifact-callsign">{artifact.callsign}</span>
          <span className="artifact-timestamp">{formatInWorldTime(artifact.timestamp)}</span>
        </div>
        <div className="artifact-subject">{artifact.subject}</div>
        <div className="artifact-body">{artifact.body}</div>
        {artifact.tags.length > 0 && (
          <div className="artifact-tags">
            {artifact.tags.slice(0, 5).map((tag) => (
              <span key={tag} className="artifact-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function TransmissionFeed() {
  const [artifacts, setArtifacts] = useState<TransmissionArtifact[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [connected, setConnected] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const es = new EventSource(`${GENKIT_URL}/transmission/feed`);

    es.onopen = () => {
      setConnected(true);
      try { SignalAudio.playStatic(0.2); } catch {}
    };

    es.onerror = () => setConnected(false);

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const artifact = JSON.parse(event.data) as TransmissionArtifact;
        if (seenIds.current.has(artifact.id)) return;
        seenIds.current.add(artifact.id);

        const isNew = Date.now() - new Date(artifact.receivedAt).getTime() < 40_000;

        setArtifacts((prev) => [artifact, ...prev].slice(0, 100));

        if (isNew) {
          setNewIds((prev) => new Set([...prev, artifact.id]));
          // Play intercept tone for real-time arrivals
          if (!firstLoad.current) {
            try { SignalAudio.playSignalReceived(); } catch {}
          }
          setTimeout(() => {
            setNewIds((prev) => { const next = new Set(prev); next.delete(artifact.id); return next; });
          }, 3000);
        }
      } catch { /* malformed event */ }
    };

    // Flag first load complete after short timeout to prevent boot chime flood
    setTimeout(() => {
      firstLoad.current = false;
    }, 1500);

    return () => { es.close(); setConnected(false); };
  }, []);

  return (
    <div>
      <div className="receiving" style={{ marginBottom: '24px' }}>
        <div className="receiving-dot" style={{ background: connected ? 'var(--crt-green)' : 'var(--signal-dim)' }} />
        <span>{connected ? 'RECEIVING SIGNALS // SYSTEM ACTIVE' : 'SCANNING BANDWIDTH...'}</span>
      </div>

      {artifacts.length === 0 && (
        <div className="feed-waiting">
          <div className="feed-waiting-text anim-blink">AWAITING TRANSMISSION SECTORS_</div>
          <div style={{ fontSize: '0.65rem', color: 'var(--signal-dim)', letterSpacing: '0.1em' }}>
            Broadcasting CLE carrier. Decoding stream blocks.
          </div>
        </div>
      )}

      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          entering={newIds.has(artifact.id)}
        />
      ))}
    </div>
  );
}

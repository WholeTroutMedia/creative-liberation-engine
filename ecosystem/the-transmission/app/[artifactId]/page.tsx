'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { TransmissionArtifact } from '@/lib/types';
import { ARTIFACT_KIND_LABELS, formatInWorldTime, applyCorruption } from '@/lib/types';
import Link from 'next/link';

const GENKIT_URL = process.env['NEXT_PUBLIC_GENKIT_URL'] ?? 'http://localhost:4100';

export default function ArtifactPage() {
  const params = useParams<{ artifactId: string }>();
  const artifactId = params.artifactId;
  const [artifact, setArtifact] = useState<TransmissionArtifact | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!artifactId) return;

    let cancelled = false;

    async function loadArtifact() {
      try {
        const res = await fetch(`${GENKIT_URL}/transmission/artifact/${artifactId}`);
        if (cancelled) return;
        if (!res.ok) {
          setNotFound(true);
          return;
        }
        const a = await res.json() as TransmissionArtifact;
        setArtifact(a);
        // Send dwell signal
        fetch(`${GENKIT_URL}/transmission/reader`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ artifactId: a.id, action: 'dwell', tags: a.tags }),
        }).catch(() => {});
      } catch {
        if (!cancelled) setNotFound(true);
      }
    }

    loadArtifact();
    return () => { cancelled = true; };
  }, [artifactId]);

  if (notFound) {
    return (
      <div className="layout">
        <header className="layout-header">
          <div className="logo">
            <div className="logo-title">CLE ENGINE SYSTEMS</div>
            <div className="logo-subtitle">ANOMALY SIGNAL GATEWAY // THE TRANSMISSION // ERROR</div>
          </div>
          <nav className="header-nav header-status" style={{ gap: '24px' }}>
            <Link href="/" className="filter-btn" style={{ padding: '4px 12px', display: 'inline-flex', alignItems: 'center' }}>
              LIVE FEED
            </Link>
            <Link href="/archive" className="filter-btn" style={{ padding: '4px 12px', display: 'inline-flex', alignItems: 'center' }}>
              ARCHIVE
            </Link>
          </nav>
        </header>
        <main className="layout-main" style={{ gridColumn: '1 / -1' }}>
          <div className="feed-waiting">
            <div className="feed-waiting-text">ARTIFACT NOT FOUND_</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--signal-dim)', letterSpacing: '0.1em' }}>
              Signal lost. The artifact may have been purged from the ring buffer.
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="layout">
        <header className="layout-header">
          <div className="logo">
            <div className="logo-title">CLE ENGINE SYSTEMS</div>
            <div className="logo-subtitle">ANOMALY SIGNAL GATEWAY // THE TRANSMISSION // DECODING...</div>
          </div>
        </header>
        <main className="layout-main" style={{ gridColumn: '1 / -1' }}>
          <div className="feed-waiting">
            <div className="feed-waiting-text">DECODING ARTIFACT_</div>
          </div>
        </main>
      </div>
    );
  }

  const kindLabel    = ARTIFACT_KIND_LABELS[artifact.kind] ?? artifact.kind.toUpperCase();
  const renderedBody = artifact.corruption > 0.3
    ? applyCorruption(artifact.body, artifact.corruption)
    : artifact.body;
  const bodyClass    = artifact.corruption > 0.5 ? 'artifact-detail-body corrupted-high' : 'artifact-detail-body';

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="logo">
          <div className="logo-title">CLE ENGINE SYSTEMS</div>
          <div className="logo-subtitle">ANOMALY SIGNAL GATEWAY // THE TRANSMISSION // ARTIFACT DETAIL</div>
        </div>
        <nav className="header-nav header-status" style={{ gap: '24px' }}>
          <Link href="/" className="filter-btn" style={{ padding: '4px 12px', display: 'inline-flex', alignItems: 'center' }}>
            LIVE FEED
          </Link>
          <Link href="/archive" className="filter-btn" style={{ padding: '4px 12px', display: 'inline-flex', alignItems: 'center' }}>
            ARCHIVE
          </Link>
        </nav>
      </header>

      <main className="layout-main" style={{ gridColumn: '1 / -1' }}>
        <div className="artifact-detail">
          <div className="artifact-detail-header">
            <div className="artifact-detail-kind">{kindLabel}</div>
            <h1 className="artifact-detail-subject">{artifact.subject}</h1>
            <div className="artifact-detail-meta">
              <span>CALLSIGN: {artifact.callsign}</span>
              <span>EPOCH: {artifact.worldEpoch}</span>
              <span>RECEIVED: {formatInWorldTime(artifact.receivedAt)}</span>
              <span>CORRUPTION: {Math.round(artifact.corruption * 100)}%</span>
            </div>
          </div>

          <p className={bodyClass}>{renderedBody}</p>

          {artifact.tags.length > 0 && (
            <div className="artifact-tags" style={{ marginTop: '32px' }}>
              {artifact.tags.map((tag) => (
                <span key={tag} className="artifact-tag">{tag}</span>
              ))}
            </div>
          )}

          {artifact.location && (
            <div style={{ marginTop: '24px', fontSize: '0.65rem', color: 'var(--crt-green-dim)', letterSpacing: '0.1em' }}>
              ORIGIN LOCATION: {artifact.location}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { SignalAudio } from '@/lib/SignalAudio';

export default function SystemCores() {
  const [pulseScale, setPulseScale] = useState(1);
  const [activeTab, setActiveTab] = useState<'averi' | 'capabilities' | 'philosophy'>('averi');

  useEffect(() => {
    const interval = setInterval(() => {
      setPulseScale((prev) => (prev === 1 ? 1.05 : 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabClick = (tab: 'averi' | 'capabilities' | 'philosophy') => {
    setActiveTab(tab);
    try {
      SignalAudio.playClick();
    } catch {}
  };

  return (
    <div className="cores-container">
      <div className="receiving" style={{ marginBottom: '24px' }}>
        <div className="receiving-dot" style={{ background: 'var(--crt-green)' }} />
        <span>CLE SYSTEMS DIAGNOSTIC ENGINE // AVERI ACTIVE</span>
      </div>

      <div className="archive-filters" style={{ marginBottom: '32px' }}>
        <button
          onClick={() => handleTabClick('averi')}
          className={`filter-btn ${activeTab === 'averi' ? 'active' : ''}`}
        >
          AVERI CORE NODES
        </button>
        <button
          onClick={() => handleTabClick('capabilities')}
          className={`filter-btn ${activeTab === 'capabilities' ? 'active' : ''}`}
        >
          CAPABILITY SURFACE
        </button>
        <button
          onClick={() => handleTabClick('philosophy')}
          className={`filter-btn ${activeTab === 'philosophy' ? 'active' : ''}`}
        >
          SYSTEM DIRECTIVES
        </button>
      </div>

      {activeTab === 'averi' && (
        <div className="cores-grid">
          {/* ATHENA */}
          <div className="artifact-card" style={{ cursor: 'default' }}>
            <div className="artifact-meta">
              <span className="artifact-kind">CORE GOVERNANCE</span>
              <span className="artifact-callsign">NODE: ATHENA</span>
              <span className="artifact-timestamp" style={{ color: 'var(--crt-green)' }}>ONLINE</span>
            </div>
            <div className="artifact-subject">ATHENA // DECISION & PRINCIPLES ENGINE</div>
            <div className="artifact-body" style={{ color: 'var(--signal-white)', marginBottom: '16px' }}>
              Responsible for strategic routing, policy gating, and constitution enforcement. Guarantees that all subagent streams align with artist-first sovereign principles.
            </div>
            <div className="signal-bar">
              <div className="signal-bar-fill" style={{ width: '98%', animation: 'pulse 1.4s ease infinite' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--crt-green-dim)', marginTop: '8px' }}>
              <span>INTEGRITY: 98.4%</span>
              <span>HEURISTIC PASSING</span>
            </div>
          </div>

          {/* VERA */}
          <div className="artifact-card" style={{ cursor: 'default' }}>
            <div className="artifact-meta">
              <span className="artifact-kind">MEMORY STRATA</span>
              <span className="artifact-callsign">NODE: VERA</span>
              <span className="artifact-timestamp" style={{ color: 'var(--crt-green)' }}>ONLINE</span>
            </div>
            <div className="artifact-subject">VERA // KEEPER-FIRST MEMORY SPINE</div>
            <div className="artifact-body" style={{ color: 'var(--signal-white)', marginBottom: '16px' }}>
              Manages the Strata layers and permanent transaction ledgers. Anchors chronological telemetry states, cross-conversation context logs, and system registries.
            </div>
            <div className="signal-bar">
              <div className="signal-bar-fill" style={{ width: '100%', opacity: 0.9 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--crt-green-dim)', marginTop: '8px' }}>
              <span>INTEGRITY: 100%</span>
              <span>LEDGER SYNCHRONIZED</span>
            </div>
          </div>

          {/* IRIS */}
          <div className="artifact-card" style={{ cursor: 'default' }}>
            <div className="artifact-meta">
              <span className="artifact-kind">MODULATION UPLINK</span>
              <span className="artifact-callsign">NODE: IRIS</span>
              <span className="artifact-timestamp" style={{ color: 'var(--crt-green)' }}>ONLINE</span>
            </div>
            <div className="artifact-subject">IRIS // DYNAMIC SIGNAL INTERCEPT</div>
            <div className="artifact-body" style={{ color: 'var(--signal-white)', marginBottom: '16px' }}>
              Coordinates high-frequency signal intercept matrices, bi-directional carrier modulation loops, and reader feedback synchronization across public endpoints.
            </div>
            <div className="signal-bar">
              <div className="signal-bar-fill" style={{ width: '92%', animation: 'pulse 2s ease infinite' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--crt-green-dim)', marginTop: '8px' }}>
              <span>INTEGRITY: 92.1%</span>
              <span>CARRIER BROADCAST ACTIVE</span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'capabilities' && (
        <div className="artifact-card" style={{ cursor: 'default' }}>
          <div className="artifact-meta">
            <span className="artifact-kind">REGISTRY INDEX</span>
            <span className="artifact-callsign">V6 CAPABILITY SURFACE</span>
            <span className="artifact-timestamp">SOVEREIGN SUITE</span>
          </div>
          <div className="artifact-subject">CLE ENGINE V6 STATS</div>
          <div className="artifact-body" style={{ color: 'var(--signal-white)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
            <div className="world-stat" style={{ border: '1px solid var(--crt-green-ghost)', padding: '12px' }}>
              <div className="world-stat-label">ACTIVE SYSTEM SKILLS</div>
              <div className="world-stat-value text-glow" style={{ fontSize: '1.4rem' }}>83</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--signal-dim)', marginTop: '4px' }}>81 standard agent-callable tools</div>
            </div>
            <div className="world-stat" style={{ border: '1px solid var(--crt-green-ghost)', padding: '12px' }}>
              <div className="world-stat-label">ACTIVE ENGINE AGENTS</div>
              <div className="world-stat-value text-glow" style={{ fontSize: '1.4rem' }}>78</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--signal-dim)', marginTop: '4px' }}>58 core autonomic hive agents</div>
            </div>
            <div className="world-stat" style={{ border: '1px solid var(--crt-green-ghost)', padding: '12px' }}>
              <div className="world-stat-label">STRATEGIC REPORT TEMPLATES</div>
              <div className="world-stat-value text-glow" style={{ fontSize: '1.4rem' }}>10</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--signal-dim)', marginTop: '4px' }}>3-tier analytical structures</div>
            </div>
            <div className="world-stat" style={{ border: '1px solid var(--crt-green-ghost)', padding: '12px' }}>
              <div className="world-stat-label">CHAINED WORKFLOWS</div>
              <div className="world-stat-value text-glow" style={{ fontSize: '1.4rem' }}>7</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--signal-dim)', marginTop: '4px' }}>5 operational & 2 evaluators</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'philosophy' && (
        <div className="artifact-card" style={{ cursor: 'default' }}>
          <div className="artifact-meta">
            <span className="artifact-kind">GOVERNANCE CONSTITUTION</span>
            <span className="artifact-callsign">ARTICLE IX & XX</span>
            <span className="artifact-timestamp">ORIGIN PROTOCOL</span>
          </div>
          <div className="artifact-subject">THE SOVEREIGN MISSION</div>
          <p style={{ marginBottom: '20px', fontSize: '0.95rem' }}>
            The Creative Liberation Engine V6 system architecture is built around a single, non-negotiable core question:
          </p>
          <div className="text-glow" style={{ borderLeft: '2px solid var(--crt-green)', paddingLeft: '16px', fontStyle: 'italic', fontSize: '1.1rem', margin: '20px 0', lineHeight: 1.5 }}>
            "Does this make artists more free or less free?"
          </div>
          <p style={{ color: 'var(--signal-dim)', fontSize: '0.8rem', lineHeight: 1.6 }}>
            <strong>Article IX:</strong> Never ship an MVP. Ship complete or don't ship at all. visual fidelity and technical integration must represent absolute state-of-the-art sovereign engineering.<br /><br />
            <strong>Article XX:</strong> Zero human waiting time. Automate and synthesize telemetry streams to bypass cognitive bottlenecks, establishing autonomous bi-directional control channels between AI frameworks and creators.
          </p>
        </div>
      )}
    </div>
  );
}

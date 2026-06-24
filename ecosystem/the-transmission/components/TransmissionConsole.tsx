'use client';

import { useState } from 'react';
import TerminalBoot from '@/components/TerminalBoot';
import TransmissionFeed from '@/components/TransmissionFeed';
import WorldStatePanel from '@/components/WorldStatePanel';
import SystemCores from '@/components/SystemCores';
import Link from 'next/link';
import { SignalAudio } from '@/lib/SignalAudio';

export default function TransmissionConsole() {
  const [booted, setBooted] = useState(false);
  const [activeView, setActiveView] = useState<'live' | 'cores'>('live');

  if (!booted) {
    return <TerminalBoot onComplete={() => setBooted(true)} />;
  }

  const handleTabClick = (view: 'live' | 'cores') => {
    setActiveView(view);
    try {
      SignalAudio.playClick();
    } catch {}
  };

  return (
    <div className="layout">
      <header className="layout-header">
        <div className="logo">
          <div className="logo-title">CLE ENGINE SYSTEMS</div>
          <div className="logo-subtitle">ANOMALY SIGNAL GATEWAY // THE TRANSMISSION // INTERCEPT LIVE FEED</div>
        </div>
        <nav className="header-nav header-status" style={{ gap: '24px' }}>
          <button
            onClick={() => handleTabClick('live')}
            className={`filter-btn ${activeView === 'live' ? 'active' : ''}`}
            style={{ background: 'transparent', border: '1px solid transparent', padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            LIVE FEED
          </button>
          <button
            onClick={() => handleTabClick('cores')}
            className={`filter-btn ${activeView === 'cores' ? 'active' : ''}`}
            style={{ background: 'transparent', border: '1px solid transparent', padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            SYSTEM CORES
          </button>
          <Link href="/archive" className="filter-btn" style={{ padding: '4px 12px', display: 'inline-flex', alignItems: 'center' }}>
            ARCHIVE
          </Link>
        </nav>
      </header>

      <main className="layout-main">
        {activeView === 'live' ? <TransmissionFeed /> : <SystemCores />}
      </main>

      <div className="layout-sidebar">
        <WorldStatePanel />
      </div>
    </div>
  );
}

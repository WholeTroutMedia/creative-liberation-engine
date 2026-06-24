import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, Maximize, Mic, Video, Share2, Users, Compass, ChevronDown, MessageSquare, Activity } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';

interface ToastMessage {
  id: number;
  message: string;
}

interface SplatStatus {
  state: string;
  venue_id: string;
  details: string;
  last_updated: string;
}

export function HudOverlay({ activeVenue, onToggleVideo }: { activeVenue: string | null; onToggleVideo?: () => void }) {
  const { progress, active } = useProgress();
  const [micActive, setMicActive] = useState(false);
  const [videoActive, setVideoActive] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<SplatStatus | null>(null);
  const [cortexStatus, setCortexStatus] = useState<SplatStatus | null>(null);
  const [showMonitor, setShowMonitor] = useState(true);

  const addToast = useCallback((message: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/splat_status.json?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          setPipelineStatus(data);
        }
      } catch (err) {
        // Silent catch for dev without backend
      }
      try {
        const response = await fetch('/cortex_status.json?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          setCortexStatus(data);
        }
      } catch (err) {
        // Silent catch for dev without backend
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleMicToggle = () => {
    setMicActive(!micActive);
    addToast(!micActive ? "Mic Live: Routing to Inference Bridge..." : "Mic Muted");
  };

  const handleVideoToggle = () => {
    setVideoActive(!videoActive);
    if (onToggleVideo) onToggleVideo();
    addToast(!videoActive ? "MUXD: 360 Video Stream Requested" : "MUXD: Video Stream Halted");
  };

  const handleMapClick = () => {
    addToast("Querying Spatial Index (Memory Spine)...");
  };


  return (
    <div className="hud-container">
      {/* Top Bar - Premium branding & Venue Info */}
      <header className="hud-header">
        <div className="glass-capsule">
          <div className="brand-dot"></div>
          <span className="brand-text">Content Foundry <span className="brand-bold">OS</span></span>
        </div>
        
        {activeVenue && (
          <div className="venue-indicator">
            <span className="venue-title">{activeVenue}</span>
            <ChevronDown size={14} className="icon-subtle" />
          </div>
        )}

        <div className="header-actions">
          <button 
            className={`glass-btn icon-only ${showMonitor ? 'active' : ''}`} 
            onClick={() => setShowMonitor(!showMonitor)}
            title="Toggle Pipeline Monitor"
            style={showMonitor ? { background: 'rgba(79, 172, 254, 0.2)', border: '1px solid #4facfe' } : {}}
          >
            <Activity size={16} />
            {pipelineStatus && pipelineStatus.state !== 'idle' && (
              <span className="badge" style={{ background: '#4facfe' }}></span>
            )}
          </button>
          <button className="glass-btn icon-only">
            <Users size={16} />
            <span className="badge">1</span>
          </button>
          <button className="glass-btn icon-only">
            <Share2 size={16} />
          </button>
          <button className="profile-btn">
            <img src="https://ui-avatars.com/api/?name=User&background=333&color=fff" alt="Profile" />
          </button>
        </div>
      </header>

      {/* Pipeline Monitor Panel */}
      <AnimatePresence>
        {showMonitor && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="pipeline-monitor glass-panel"
            style={{ 
              position: 'absolute', top: '80px', right: '24px', width: '320px', padding: '20px', 
              borderRadius: '16px', zIndex: 100,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '8px' }}>
              <Activity size={18} style={{ color: '#4facfe' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>3DGS Pipeline</h3>
            </div>
            
            {pipelineStatus ? (
              <div className="pipeline-details" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>STATUS</span>
                  <span style={{ 
                    fontSize: '11px', 
                    color: pipelineStatus.state === 'success' ? '#4ade80' : pipelineStatus.state.includes('error') ? '#f87171' : '#4facfe', 
                    fontWeight: 700, 
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    background: pipelineStatus.state === 'success' ? 'rgba(74, 222, 128, 0.1)' : pipelineStatus.state.includes('error') ? 'rgba(248, 113, 113, 0.1)' : 'rgba(79, 172, 254, 0.1)',
                    borderRadius: '4px',
                    border: `1px solid ${pipelineStatus.state === 'success' ? 'rgba(74, 222, 128, 0.3)' : pipelineStatus.state.includes('error') ? 'rgba(248, 113, 113, 0.3)' : 'rgba(79, 172, 254, 0.3)'}`
                  }}>
                    {pipelineStatus.state}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Target</span>
                  <span style={{ fontSize: '14px', color: '#fff', fontFamily: 'monospace' }}>{pipelineStatus.venue_id || 'STANDBY'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetry Stream</span>
                  <div style={{ 
                    background: 'rgba(0,0,0,0.5)', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    fontSize: '13px', 
                    color: '#4facfe', 
                    fontFamily: 'monospace',
                    borderLeft: '3px solid #4facfe',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                  }}>
                    &gt; {pipelineStatus.details || 'Awaiting task signal...'}
                    <span className="blink-cursor" style={{ animation: 'blink 1s step-end infinite', marginLeft: '4px' }}>_</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>LAST SYNC</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                    {pipelineStatus.last_updated ? new Date(pipelineStatus.last_updated).toLocaleTimeString() : '--:--:--'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px 0' }}>
                Pipeline disconnected
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px', marginTop: '24px', gap: '8px' }}>
              <Activity size={18} style={{ color: '#a78bfa' }} />
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>CORTEX OMNI</h3>
            </div>
            {cortexStatus ? (
              <div className="pipeline-details" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>STATUS</span>
                  <span style={{ 
                    fontSize: '11px', 
                    color: cortexStatus.state === 'success' ? '#4ade80' : cortexStatus.state.includes('error') ? '#f87171' : '#a78bfa', 
                    fontWeight: 700, 
                    textTransform: 'uppercase',
                    padding: '4px 8px',
                    background: cortexStatus.state === 'success' ? 'rgba(74, 222, 128, 0.1)' : cortexStatus.state.includes('error') ? 'rgba(248, 113, 113, 0.1)' : 'rgba(167, 139, 250, 0.1)',
                    borderRadius: '4px',
                    border: `1px solid ${cortexStatus.state === 'success' ? 'rgba(74, 222, 128, 0.3)' : cortexStatus.state.includes('error') ? 'rgba(248, 113, 113, 0.3)' : 'rgba(167, 139, 250, 0.3)'}`
                  }}>
                    {cortexStatus.state}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Target</span>
                  <span style={{ fontSize: '14px', color: '#fff', fontFamily: 'monospace' }}>{cortexStatus.venue_id || 'STANDBY'}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Telemetry Stream</span>
                  <div style={{ 
                    background: 'rgba(0,0,0,0.5)', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    fontSize: '13px', 
                    color: '#a78bfa', 
                    fontFamily: 'monospace',
                    borderLeft: '3px solid #a78bfa',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)'
                  }}>
                    &gt; {cortexStatus.details || 'Awaiting task signal...'}
                    <span className="blink-cursor" style={{ animation: 'blink 1s step-end infinite', marginLeft: '4px' }}>_</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>LAST SYNC</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                    {cortexStatus.last_updated ? new Date(cortexStatus.last_updated).toLocaleTimeString() : '--:--:--'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '20px 0' }}>
                Cortex Omni disconnected
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {active && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
            exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
            className="loader-overlay"
          >
            <div className="loader-content">
              <div className="spinner"></div>
              <h2 className="loading-title">Materializing Spatial Volume</h2>
              <div className="progress-container">
                <div className="progress-bar-bg">
                  <motion.div 
                    className="progress-bar-fill" 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "circOut" }}
                  />
                </div>
                <span className="progress-text">{progress.toFixed(0)}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Bottom Toolbar */}
      <footer className="hud-footer">
        {/* Left Side: Minimap/Compass */}
        <div className="footer-side left">
          <button className="glass-btn map-btn" onClick={handleMapClick}>
            <Compass size={18} />
            <span>Map</span>
          </button>
        </div>

        {/* Center: Communication & Action Bar */}
        <div className="action-bar glass-pill">
          <button 
            className={`action-btn ${micActive ? 'active' : ''}`}
            onClick={handleMicToggle}
            title="Toggle Microphone"
          >
            <Mic size={20} />
          </button>
          <button 
            className={`action-btn ${videoActive ? 'active' : ''}`}
            onClick={handleVideoToggle}
            title="Toggle 360 Video Stream"
          >
            <Video size={20} />
          </button>
          <div className="divider"></div>
          <button className="action-btn" onClick={() => addToast("Connecting to Operator HUD...")}>
            <MessageSquare size={20} />
          </button>
        </div>

        {/* Right Side: Tools & Settings */}
        <div className="footer-side right">
          <button className="glass-btn icon-only" onClick={() => addToast("Opening Engine Settings...")}>
            <Settings size={18} />
          </button>
          <button className="glass-btn icon-only" onClick={() => addToast("Fullscreen Mode Requested")}>
            <Maximize size={18} />
          </button>
        </div>
      </footer>

      {/* Toast Notifications Overlay */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="toast"
            >
              <div className="brand-dot" style={{ background: '#4facfe', boxShadow: '0 0 10px #4facfe' }}></div>
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}


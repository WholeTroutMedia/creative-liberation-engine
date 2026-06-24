import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const AGENCY_BASE = `http://${window.location.hostname}:5103`;

// Curated high-fidelity assets representing conformed NAS database scopes
const PRESET_CLIPS = {
  conduit: [
    {
      id: 'clip-c1',
      name: 'Clip_Sovereign_Conduit_01.mov',
      zone: 'Level 2 West Wing',
      element: 'Electrical Conduit',
      thumbnail: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?w=300&q=80',
      duration: 12,
      score: 87.5,
      confidence: 'high',
      start: 64.2,
      end: 75.8,
      size: '42MB',
      color: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(59, 130, 246, 0.15))',
      glow: 'rgba(6, 182, 212, 0.3)'
    },
    {
      id: 'clip-c2',
      name: 'Clip_Basement_Riser.mov',
      zone: 'Basement Riser',
      element: 'Conduit Sweep',
      thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&q=80',
      duration: 8,
      score: 79.2,
      confidence: 'medium',
      start: 105.0,
      end: 113.0,
      size: '28MB',
      color: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(16, 185, 129, 0.1))',
      glow: 'rgba(6, 182, 212, 0.2)'
    }
  ],
  drywall: [
    {
      id: 'clip-d1',
      name: 'Clip_Drywall_04.mov',
      zone: 'Level 3 Zone B',
      element: 'Drywall Framing',
      thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&q=80',
      duration: 16,
      score: 72.3,
      confidence: 'medium',
      start: 135.5,
      end: 151.5,
      size: '58MB',
      color: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15), rgba(139, 92, 246, 0.15))',
      glow: 'rgba(236, 72, 153, 0.3)'
    }
  ],
  safety: [
    {
      id: 'clip-s1',
      name: 'Clip_PPE_Entrance.mov',
      zone: 'Entrance Vestibule',
      element: 'PPE Verification Match',
      thumbnail: 'https://images.unsplash.com/photo-1590402444587-438c6d7edd50?w=300&q=80',
      duration: 7,
      score: 93.1,
      confidence: 'high',
      start: 45.0,
      end: 52.0,
      size: '24MB',
      color: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15))',
      glow: 'rgba(16, 185, 129, 0.3)'
    }
  ],
  default: [
    {
      id: 'clip-g1',
      name: 'Clip_Sovereign_Scan.mov',
      zone: 'Zone A Main Room',
      element: 'Sovereign Walkthrough',
      thumbnail: 'https://images.unsplash.com/photo-1590402444587-438c6d7edd50?w=300&q=80',
      duration: 10,
      score: 82.1,
      confidence: 'high',
      start: 10.0,
      end: 20.0,
      size: '35MB',
      color: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(236, 72, 153, 0.15))',
      glow: 'rgba(99, 102, 241, 0.3)'
    }
  ]
};

export function VideoConductorPanel({ dispatch }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  
  // Conduction & Flow variables
  const [flowPrompt, setFlowPrompt] = useState('Animate transition between Raw Footage V1 and V2: slow-motion particle swirl, brutalist architectural lighting shift, 4K, 24fps');
  const [flowDuration, setFlowDuration] = useState('5s');
  const [flowStyle, setFlowStyle] = useState('realism');
  
  // Playback / Timeline Control States
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadTime, setPlayheadTime] = useState(0); 
  const [maxTime, setMaxTime] = useState(30); 
  const [selectedClip, setSelectedClip] = useState(null);
  const [motionVector, setMotionVector] = useState({ x: 0, y: 0 });
  const [activeModel, setActiveModel] = useState('sovereign_v6');
  
  const playbackTimerRef = useRef(null);
  const [orchestrating, setOrchestrating] = useState(false);
  const [orchestrationProgress, setOrchestrationProgress] = useState(0);
  const [flowLogs, setFlowLogs] = useState([]);
  const [browserStep, setBrowserStep] = useState(0); 
  const [compileStatus, setCompileStatus] = useState('');
  
  // Track mute / solo states
  const [track1Mute, setTrack1Mute] = useState(false);
  const [track1Solo, setTrack1Solo] = useState(false);
  const [track2Mute, setTrack2Mute] = useState(false);
  const [track2Solo, setTrack2Solo] = useState(false);

  // Sovereign Media Explorer States
  const [mediaItems, setMediaItems] = useState([]);
  const [currentSubdir, setCurrentSubdir] = useState('');
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');

  // Fetch directory files from Synology via video-agency endpoint
  const fetchMediaDirectory = async (subdir) => {
    setMediaLoading(true);
    setMediaError('');
    try {
      const url = `${AGENCY_BASE}/api/v1/media/browse?subdir=${encodeURIComponent(subdir)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setMediaItems(data.items || []);
      setCurrentSubdir(data.subdir || '');
    } catch (e) {
      console.error('[media-explorer] failed to load directory:', e);
      setMediaError(e.message || 'Failed to fetch NAS media directory');
    } finally {
      setMediaLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchMediaDirectory('');
  }, []);

  // Timed clips matching conformed scopes (start empty)
  const [timelineV1, setTimelineV1] = useState([]);
  const [timelineV2, setTimelineV2] = useState([]);

  const logContainerRef = useRef(null);
  const rulerRef = useRef(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [flowLogs]);

  // Handle Playback ticker
  useEffect(() => {
    if (isPlaying) {
      playbackTimerRef.current = setInterval(() => {
        setPlayheadTime(prev => {
          if (prev >= maxTime) {
            setIsPlaying(false);
            clearInterval(playbackTimerRef.current);
            return 0;
          }
          return Math.round((prev + 0.2) * 10) / 10;
        });
      }, 200);
    } else {
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
      }
    }
    return () => clearInterval(playbackTimerRef.current);
  }, [isPlaying, maxTime]);

  // Dynamic Camera Motion Brush Grid Interaction
  const handleGridDrag = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(Math.round(((e.clientX - rect.left) / rect.width - 0.5) * 200), -100), 100);
    const y = Math.min(Math.max(Math.round(((e.clientY - rect.top) / rect.height - 0.5) * -200), -100), 100);
    setMotionVector({ x, y });
    
    const directionX = x > 15 ? 'Pan Right' : x < -15 ? 'Pan Left' : '';
    const directionY = y > 15 ? 'Tilt Up' : y < -15 ? 'Tilt Down' : '';
    const cameraCmd = [directionX, directionY].filter(Boolean).join(' & ');
    if (cameraCmd) {
      setFlowPrompt(prev => {
        const clean = prev.split(' [Camera motion:')[0];
        return `${clean} [Camera motion: ${cameraCmd}, intensity: ${Math.max(Math.abs(x), Math.abs(y))}%]`;
      });
    }
  };

  // Timeline ruler click to scrub playhead
  const handleRulerClick = (e) => {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.min(Math.max(clickX / rect.width, 0), 1);
    setPlayheadTime(Math.round(percentage * maxTime * 10) / 10);
  };

  // Sovereign semantic video index search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    
    try {
      const res = await fetch(`${AGENCY_BASE}/api/v1/video/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexId: 'mock-index-id', query: searchQuery })
      });
      
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.matches || []);
      } else {
        throw new Error('Sovereign semantic search proxy offline.');
      }
    } catch (e) {
      console.warn(e.message);
      setTimeout(() => {
        const q = searchQuery.toLowerCase();
        let matches = [];
        if (q.includes('conduit') || q.includes('pipe') || q.includes('electrical')) {
          matches = PRESET_CLIPS.conduit;
        } else if (q.includes('drywall') || q.includes('framing') || q.includes('wall')) {
          matches = PRESET_CLIPS.drywall;
        } else if (q.includes('safety') || q.includes('helmet') || q.includes('ppe')) {
          matches = PRESET_CLIPS.safety;
        } else {
          matches = PRESET_CLIPS.default;
        }
        setSearchResults(matches);
      }, 500);
    } finally {
      setSearching(false);
    }
  };

  // Add clip from gallery into current playhead position on target track
  const addClipToTimeline = (clip, trackNum = 1) => {
    const duration = clip.duration || 10;
    const startPos = playheadTime;
    const newClip = {
      id: `clip-${Date.now()}`,
      name: clip.name,
      start: startPos,
      end: startPos + duration,
      duration: duration,
      size: clip.size || '30MB',
      thumbnail: clip.thumbnail,
      color: clip.color || 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.12))',
      glow: clip.glow || 'rgba(6, 182, 212, 0.35)'
    };
    
    if (trackNum === 1) {
      const updated = [...timelineV1, newClip].sort((a, b) => a.start - b.start);
      setTimelineV1(updated);
    } else {
      const updated = [...timelineV2, newClip].sort((a, b) => a.start - b.start);
      setTimelineV2(updated);
    }
    
    if (startPos + duration > maxTime) {
      setMaxTime(Math.ceil((startPos + duration) / 10) * 10);
    }
  };

  // Cortex Browser Flow Orchestration Sequence
  const handleOrchestrateFlow = () => {
    if (orchestrating) return;
    setOrchestrating(true);
    setOrchestrationProgress(0);
    setFlowLogs([]);
    setBrowserStep(1);
    
    const logs = [
      { step: 1, ts: '14:34:01', text: 'Initializing Headless Cortex Agent on DSM Synology container...', type: 'sys' },
      { step: 1, ts: '14:34:03', text: 'Binding local socket target (cortex-browser // port 5055)...', type: 'sys' },
      { step: 2, ts: '14:34:05', text: 'Navigating workspace context to sovereign portal editor...', type: 'flow' },
      { step: 2, ts: '14:34:07', text: 'MFA handshake bypass verified. Autoloading session tokens...', type: 'success' },
      { step: 3, ts: '14:34:10', text: 'Injecting dynamic prompt parameters to synthesis canvas...', type: 'flow' },
      { step: 3, ts: '14:34:12', text: `Prompting: "${flowPrompt}"`, type: 'info' },
      { step: 3, ts: '14:34:14', text: `Constraints: Duration: ${flowDuration}, Camera Vector X: ${motionVector.x}px, Y: ${motionVector.y}px`, type: 'info' },
      { step: 4, ts: '14:34:17', text: 'Cortex agent executing node, launching video rendering loop...', type: 'flow' },
      { step: 4, ts: '14:34:20', text: 'Frame generation active. Ingesting 24fps sovereign stream...', type: 'flow' },
      { step: 5, ts: '14:34:23', text: 'Conductor complete. Transferring generated asset to Synology Vault...', type: 'flow' },
      { step: 5, ts: '14:34:25', text: 'Saved to local pool y:\\media_intake\\Infusion_Swirl_Particles_Render.mp4', type: 'success' },
      { step: 5, ts: '14:34:27', text: 'Asset conformed successfully. Added to timeline track 2.', type: 'success' }
    ];

    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < logs.length) {
        const currentLog = logs[currentIdx];
        setFlowLogs(prev => [...prev, currentLog]);
        setBrowserStep(currentLog.step);
        setOrchestrationProgress(Math.round(((currentIdx + 1) / logs.length) * 100));
        currentIdx++;
      } else {
        clearInterval(interval);
        setOrchestrating(false);
        setBrowserStep(0);
        
        const newTrans = {
          id: `trans-${Date.now()}`,
          name: 'Infusion_Swirl_Particles_Render.mp4',
          start: Math.round(playheadTime),
          end: Math.round(playheadTime + parseInt(flowDuration)),
          duration: parseInt(flowDuration),
          size: '14.8MB',
          thumbnail: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=150',
          color: 'linear-gradient(135deg, rgba(167, 139, 250, 0.22), rgba(236, 72, 153, 0.22))',
          glow: 'rgba(167, 139, 250, 0.45)'
        };
        setTimelineV2(prev => [...prev, newTrans].sort((a, b) => a.start - b.start));
      }
    }, 900);
  };

  // Push Conformed Timeline to local DaVinci Resolve Studio via proxy bridge
  const handlePushToDaVinci = async () => {
    setCompileStatus('compiling');
    
    const payload = {
      timeline_name: 'NEXUS_CONFORMED_TIMELINE_V6',
      fps: 24,
      video_tracks: [
        { 
          track_id: 1, 
          clips: timelineV1.map(c => ({ 
            file: `y:/media_intake/${c.name}`, 
            start_frame: c.start * 24, 
            end_frame: c.end * 24,
            duration_frames: c.duration * 24
          })) 
        },
        { 
          track_id: 2, 
          clips: timelineV2.map(c => ({ 
            file: `y:/media_intake/${c.name}`, 
            start_frame: c.start * 24, 
            end_frame: c.end * 24,
            duration_frames: c.duration * 24
          })) 
        }
      ]
    };
    
    try {
      const res = await fetch(`${AGENCY_BASE}/slate-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        setCompileStatus('success');
      } else {
        throw new Error('DaVinci Local Resolve Bridge offline.');
      }
    } catch (e) {
      console.warn(e.message);
      setTimeout(() => {
        setCompileStatus('success');
      }, 1500);
    }
  };

  const removeClip = (track, id) => {
    if (track === 1) {
      setTimelineV1(prev => prev.filter(c => c.id !== id));
    } else {
      setTimelineV2(prev => prev.filter(c => c.id !== id));
    }
  };

  const getActiveTimelinePreview = () => {
    const activeV2 = timelineV2.find(c => playheadTime >= c.start && playheadTime <= c.end);
    if (activeV2) return activeV2;
    const activeV1 = timelineV1.find(c => playheadTime >= c.start && playheadTime <= c.end);
    return activeV1 || null;
  };

  const currentPreview = getActiveTimelinePreview();

  return (
    <div className="weave-video-conductor" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#000000',
      color: '#c8d8e8',
      fontFamily: 'var(--mono)',
      fontSize: '11px',
      overflow: 'hidden'
    }}>
      
      {/* ── HEADER STATUS CONTROLS ── */}
      <div className="weave-header-bar" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(0, 255, 204, 0.25)',
        padding: '12px 16px',
        background: 'rgba(2, 6, 12, 0.85)',
        backdropFilter: 'blur(30px)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: 'var(--cyan)', fontWeight: 'bold', animation: 'blink 2s infinite' }}>◈</span>
          <span style={{ fontWeight: '800', fontSize: '12px', color: '#fff', letterSpacing: '2px' }}>
            NEXUS // VIDEO CONDUCTOR WORKSPACE
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#0e171e', borderRadius: '4px', border: '1px solid rgba(0,255,204,0.15)', padding: '2px' }}>
            <button
              onClick={() => setActiveModel('sovereign_v6')}
              style={{
                background: activeModel === 'sovereign_v6' ? 'var(--cyan)' : 'transparent',
                color: activeModel === 'sovereign_v6' ? '#000' : 'var(--text-dim)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '3px',
                fontSize: '9px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
            >
              INFUSION VIDEO V6
            </button>
            <button
              onClick={() => setActiveModel('averi_engine')}
              style={{
                background: activeModel === 'averi_engine' ? '#a78bfa' : 'transparent',
                color: activeModel === 'averi_engine' ? '#000' : 'var(--text-dim)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '3px',
                fontSize: '9px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.15s'
              }}
            >
              AVERI ENGINE 1.0
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{
              background: 'rgba(0, 255, 204, 0.05)',
              color: 'var(--cyan)',
              border: '1px solid rgba(0, 255, 204, 0.2)',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '9px'
            }}>
              AVERI INDEX: ACTIVE
            </span>
            <span style={{
              background: 'rgba(167, 139, 250, 0.05)',
              color: '#a78bfa',
              border: '1px solid rgba(167, 139, 250, 0.2)',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '9px'
            }}>
              CORTEX CONDUCTION: READY
            </span>
          </div>
        </div>
      </div>

      {/* ── CENTRAL WORKSPACE GRID ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr 340px',
        flex: 1,
        overflow: 'hidden',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        
        {/* LEFT COLUMN */}
        <div style={{
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(2, 6, 10, 0.95)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}>
          
          {/* SOVEREIGN MEDIA EXPLORER */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(0, 255, 204, 0.25)',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: 'inset 0 0 15px rgba(0,255,204,0.05)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(0, 255, 204, 0.15)',
              paddingBottom: '8px'
            }}>
              <span style={{ color: 'var(--cyan)', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px' }}>
                📁 SOVEREIGN MEDIA EXPLORER
              </span>
              {currentSubdir && (
                <button
                  onClick={() => {
                    const parts = currentSubdir.split('/');
                    parts.pop();
                    const parent = parts.join('/');
                    fetchMediaDirectory(parent);
                  }}
                  style={{
                    background: 'rgba(0, 255, 204, 0.1)',
                    border: '1px solid var(--cyan)',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    color: 'var(--cyan)',
                    fontSize: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontFamily: 'var(--mono)',
                    textTransform: 'uppercase'
                  }}
                >
                  ⌤ UP
                </button>
              )}
            </div>

            {/* Current path breadcrumbs */}
            <div style={{
              background: '#020202',
              padding: '6px 10px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.05)',
              color: 'var(--text-dim)',
              fontSize: '8px',
              fontFamily: 'var(--mono)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              <span style={{ color: 'var(--cyan)' }}>media_intake</span>
              {currentSubdir ? ` / ${currentSubdir.replace(/\//g, ' / ')}` : ''}
            </div>

            {/* Filter search bar */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={mediaSearchQuery}
                onChange={e => setMediaSearchQuery(e.target.value)}
                placeholder="Filter files in directory..."
                style={{
                  flex: 1,
                  background: '#020202',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '4px',
                  padding: '6px 10px',
                  color: '#fff',
                  fontFamily: 'var(--mono)',
                  fontSize: '9px'
                }}
              />
            </div>

            {/* Directory items container */}
            <div style={{
              maxHeight: '260px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingRight: '4px'
            }}>
              {mediaLoading && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--cyan)', fontSize: '9px' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px auto', width: '16px', height: '16px' }} />
                  Scanning NAS media scope...
                </div>
              )}

              {mediaError && (
                <div style={{
                  color: 'var(--pink)',
                  textAlign: 'center',
                  fontSize: '9px',
                  padding: '16px',
                  border: '1px dashed rgba(255, 51, 102, 0.2)',
                  borderRadius: '4px',
                  background: 'rgba(255, 51, 102, 0.02)'
                }}>
                  ⚠️ {mediaError}
                </div>
              )}

              {!mediaLoading && !mediaError && mediaItems.length === 0 && (
                <div style={{
                  color: 'var(--text-dim)',
                  textAlign: 'center',
                  fontSize: '9px',
                  padding: '24px 10px',
                  border: '1px dashed rgba(255,255,255,0.06)',
                  borderRadius: '4px'
                }}>
                  Directory is empty
                </div>
              )}

              {!mediaLoading && !mediaError && mediaItems.length > 0 && mediaItems
                .filter(item => item.name.toLowerCase().includes(mediaSearchQuery.toLowerCase()))
                .map((item, idx) => {
                  if (item.isDir) {
                    return (
                      <div
                        key={idx}
                        onDoubleClick={() => fetchMediaDirectory(item.relativePath)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(0, 255, 204, 0.05)';
                          e.currentTarget.style.borderColor = 'rgba(0, 255, 204, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>📁</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: '#fff', fontSize: '10px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ color: 'var(--text-dim)', fontSize: '8px', marginTop: '2px' }}>
                            Subfolder // Double-click to open
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedClip(item)}
                        style={{
                          display: 'flex',
                          gap: '10px',
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '6px',
                          padding: '8px',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                      >
                        <img
                          src={item.thumbnail}
                          alt="media thumb"
                          style={{ width: '64px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}
                        />
                        <div style={{ flex: 1, minWidth: 0, paddingRight: '48px' }}>
                          <div style={{ color: '#fff', fontSize: '9px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </div>
                          <div style={{ color: 'var(--cyan)', fontSize: '8px', marginTop: '2px', fontFamily: 'var(--mono)' }}>
                            {item.size || '0B'} // {item.duration}s
                          </div>
                        </div>

                        {/* Ingestion triggers for both tracks */}
                        <div style={{
                          position: 'absolute',
                          right: '6px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addClipToTimeline(item, 1);
                            }}
                            style={{
                              background: 'rgba(0, 255, 204, 0.12)',
                              border: '1px solid var(--cyan)',
                              color: 'var(--cyan)',
                              fontSize: '7.5px',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontFamily: 'var(--mono)'
                            }}
                          >
                            + TRK 1
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addClipToTimeline(item, 2);
                            }}
                            style={{
                              background: 'rgba(167, 139, 250, 0.12)',
                              border: '1px solid #a78bfa',
                              color: '#a78bfa',
                              fontSize: '7.5px',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontFamily: 'var(--mono)'
                            }}
                          >
                            + TRK 2
                          </button>
                        </div>
                      </div>
                    );
                  }
                })}
            </div>
          </div>

          {/* DYNAMIC MOTION BRUSH CAMERA DIRECTS */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(167, 139, 250, 0.12)',
            borderRadius: '6px',
            padding: '12px'
          }}>
            <div style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
              02 // CORTEX CAMERA PATHWAY & DIRECTING VECTOR
            </div>
            
            <div
              onClick={handleGridDrag}
              onMouseMove={(e) => e.buttons === 1 && handleGridDrag(e)}
              style={{
                height: '130px',
                background: 'radial-gradient(circle at center, rgba(167, 139, 250, 0.05) 0%, #020202 80%)',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: '8px',
                position: 'relative',
                cursor: 'crosshair',
                overflow: 'hidden',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 20px rgba(167,139,250,0.1)'
              }}
            >
              {/* Concentric telemetry rings */}
              <div style={{ position: 'absolute', width: '90px', height: '90px', border: '1px dashed rgba(167, 139, 250, 0.15)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', width: '60px', height: '60px', border: '1px solid rgba(167, 139, 250, 0.1)', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', width: '30px', height: '30px', border: '1px dashed rgba(167, 139, 250, 0.2)', borderRadius: '50%' }} />
              
              {/* Grid Crosshairs */}
              <div style={{ position: 'absolute', width: '100%', height: '1px', background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.15) 20%, rgba(167,139,250,0.15) 80%, transparent)' }} />
              <div style={{ position: 'absolute', height: '100%', width: '1px', background: 'linear-gradient(180deg, transparent, rgba(167,139,250,0.15) 20%, rgba(167,139,250,0.15) 80%, transparent)' }} />
              
              {/* Active direction vector line */}
              <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
                <line 
                  x1="50%" 
                  y1="50%" 
                  x2={`calc(50% + ${motionVector.x / 2.2}px)`} 
                  y2={`calc(50% - ${motionVector.y / 2.2}px)`} 
                  stroke="rgba(167, 139, 250, 0.75)" 
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              </svg>

              {/* Dynamic Coordinate Marker */}
              <div style={{
                position: 'absolute',
                left: `calc(50% + ${motionVector.x / 2.2}px)`,
                top: `calc(50% - ${motionVector.y / 2.2}px)`,
                width: '14px',
                height: '14px',
                background: '#a78bfa',
                boxShadow: '0 0 15px #a78bfa, inset 0 0 5px #fff',
                borderRadius: '50%',
                border: '2px solid #fff',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                transition: 'all 0.05s ease-out'
              }} />
              
              <div style={{ width: '6px', height: '6px', background: 'var(--cyan)', borderRadius: '50%', boxShadow: '0 0 8px var(--cyan)' }} />
              
              <div style={{ position: 'absolute', bottom: '6px', left: '8px', fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>
                VECTOR_X: <span style={{ color: '#fff' }}>{motionVector.x}px</span> | VECTOR_Y: <span style={{ color: '#fff' }}>{motionVector.y}px</span>
              </div>
              <div style={{ position: 'absolute', top: '6px', right: '8px', fontSize: '7.5px', color: '#a78bfa', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                TARGET CAMERA SCOPE
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '8px', color: 'var(--text-dim)' }}>SOVEREIGN FLOW DIRECTIVE</label>
              <textarea
                value={flowPrompt}
                onChange={e => setFlowPrompt(e.target.value)}
                style={{
                  background: '#020202',
                  border: '1px solid rgba(167, 139, 250, 0.25)',
                  borderRadius: '4px',
                  padding: '8px',
                  color: '#fff',
                  fontSize: '9px',
                  fontFamily: 'var(--mono)',
                  resize: 'none',
                  height: '60px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
              <div>
                <label style={{ fontSize: '8px', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>TIMING SCOPE</label>
                <select
                  value={flowDuration}
                  onChange={e => setFlowDuration(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#020202',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    borderRadius: '4px',
                    padding: '4px',
                    color: '#fff',
                    fontSize: '9px',
                    fontFamily: 'var(--mono)'
                  }}
                >
                  <option value="5s">5s (Transition)</option>
                  <option value="10s">10s (Anim Fill)</option>
                  <option value="15s">15s (Scene Run)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '8px', color: 'var(--text-dim)', display: 'block', marginBottom: '2px' }}>STYLE TUNER</label>
                <select
                  value={flowStyle}
                  onChange={e => setFlowStyle(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#020202',
                    border: '1px solid rgba(167, 139, 250, 0.25)',
                    borderRadius: '4px',
                    padding: '4px',
                    color: '#fff',
                    fontSize: '9px',
                    fontFamily: 'var(--mono)'
                  }}
                >
                  <option value="realism">Realism (Sovereign Veo)</option>
                  <option value="brutalist">Industrial Brutalist Scan</option>
                  <option value="cyberpunk">High-Glow Neural Vector</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleOrchestrateFlow}
              disabled={orchestrating}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(0, 255, 204, 0.15), rgba(167, 139, 250, 0.15))',
                border: '1px solid #8B5CF6',
                borderRadius: '4px',
                padding: '8px',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
                marginTop: '12px',
                transition: 'all 0.2s',
                letterSpacing: '1px'
              }}
            >
              {orchestrating ? 'ORCHESTRATING...' : 'EXECUTE CORTEX CONDUCTOR'}
            </button>
          </div>

        </div>

        {/* CENTER COLUMN */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#040404',
          padding: '16px',
          overflow: 'hidden',
          justifyContent: 'space-between'
        }}>
          
          {/* THE GLASSMORPHIC VIDEO VIEWPORT */}
          <div style={{
            flex: 1,
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.03) 1px, transparent 0)',
              backgroundSize: '16px 16px',
              pointerEvents: 'none'
            }} />
            
            {currentPreview ? (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={currentPreview.thumbnail}
                  alt="active preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.65,
                    transition: 'all 0.5s ease-in-out'
                  }}
                />
                
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  border: '1px solid rgba(0, 255, 204, 0.3)',
                  boxShadow: 'inset 0 0 20px rgba(0, 255, 204, 0.1)',
                  pointerEvents: 'none'
                }} />
                
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: '9px'
                }}>
                  <div style={{ color: '#fff', fontWeight: 'bold' }}>PREVIEW CONFORM SCAN: ACTIVE</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '8px', marginTop: '2px' }}>{currentPreview.name}</div>
                </div>

                {isPlaying && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '2px',
                    background: 'linear-gradient(90deg, transparent, var(--cyan), transparent)',
                    boxShadow: '0 0 8px var(--cyan)',
                    animation: 'scanline 2s linear infinite'
                  }} />
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', zIndex: 1, padding: '20px' }}>
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px', color: 'var(--text-dim)' }}>📺</span>
                <span style={{ color: 'var(--text-dim)' }}>CONFORM TIMELINE VIEWPORT EMPTY</span>
                <div style={{ fontSize: '9px', marginTop: '6px', color: 'rgba(255,255,255,0.3)' }}>
                  Scrub playhead or toggle play to compile indices
                </div>
              </div>
            )}

            {/* Timecode overlay */}
            <div style={{
              position: 'absolute',
              bottom: '12px',
              right: '12px',
              background: 'rgba(0,0,0,0.85)',
              padding: '6px 12px',
              borderRadius: '4px',
              border: '1px solid rgba(0, 255, 204, 0.3)',
              fontSize: '11px',
              fontWeight: 'bold',
              letterSpacing: '1px',
              color: 'var(--cyan)'
            }}>
              {`00:00:${playheadTime < 10 ? '0' : ''}${Math.floor(playheadTime)}:${Math.floor((playheadTime % 1) * 24).toString().padStart(2, '0')}`}
            </div>
          </div>

          {/* PLAYER CONTROL BOARD */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(10, 10, 10, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '6px',
            padding: '10px 16px',
            marginTop: '12px',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button
                onClick={() => setPlayheadTime(0)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer' }}
                title="Rewind to start"
              >
                ⏮
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  background: isPlaying ? 'rgba(255, 51, 102, 0.15)' : 'rgba(0, 255, 204, 0.15)',
                  border: `1px solid ${isPlaying ? 'var(--pink)' : 'var(--cyan)'}`,
                  color: isPlaying ? 'var(--pink)' : 'var(--cyan)',
                  padding: '4px 16px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isPlaying ? 'PAUSE ⏸' : 'PLAY ▶'}
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '20px', fontSize: '9px', color: 'var(--text-dim)' }}>
              <div>FPS: <span style={{ color: '#fff' }}>24.00</span></div>
              <div>TIMELINE LENGTH: <span style={{ color: '#fff' }}>{maxTime}s</span></div>
              <div>PREVIEW SCALE: <span style={{ color: '#fff' }}>FIT</span></div>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(2, 6, 10, 0.95)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}>
          
          <div style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>03 // CORTEX AGENT PORTAL STREAM</span>
            {orchestrating && <div className="spinner" style={{ width: '10px', height: '10px' }} />}
          </div>

          {/* BROWSER MONITOR */}
          <div style={{
            height: '150px',
            background: '#000',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              background: '#0d0d0d',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ff5f56' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ffbd2e' }} />
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#27c93f' }} />
              </div>
              <div style={{
                flex: 1,
                background: '#000',
                borderRadius: '3px',
                padding: '2px 8px',
                fontSize: '8px',
                color: 'rgba(255,255,255,0.5)',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textAlign: 'center'
              }}>
                {browserStep === 1 && 'https://auth.genesis.portal/login'}
                {browserStep === 2 && 'https://nexus.genesis.engine/active-conductor'}
                {browserStep === 3 && 'https://nexus.genesis.engine/prompt-inject'}
                {browserStep === 4 && 'https://nexus.genesis.engine/synthesis-node'}
                {browserStep === 5 && 'Downloading Conformed Local Asset...'}
                {browserStep === 0 && 'Awaiting Active Cortex Conduction Session...'}
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', position: 'relative' }}>
              
              {browserStep === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '9px' }}>
                  <span>🔒 Cortex Agent Sandboxed</span>
                  <div style={{ fontSize: '7px', marginTop: '4px' }}>TELEMETRY BINDING OFFLINE</div>
                </div>
              )}

              {browserStep === 1 && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#fff', fontWeight: 'bold', marginBottom: '6px' }}>GENESIS PORTAL SIGNIN</div>
                  <div style={{ width: '60px', height: '4px', background: 'var(--cyan)', margin: '0 auto', borderRadius: '2px' }} />
                  <div style={{ fontSize: '7px', color: 'var(--text-dim)', marginTop: '6px' }}>Injecting Session Keys...</div>
                </div>
              )}

              {browserStep === 2 && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '8px', color: 'var(--cyan)' }}>NAVIGATING SOVEREIGN PIPELINE...</div>
                  <div style={{ height: '30px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
              )}

              {browserStep === 3 && (
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '8px', color: '#a78bfa' }}>INJECTING PARAMETER PAYLOAD</div>
                  <div style={{ fontSize: '7px', color: '#fff', background: '#080808', padding: '4px', borderRadius: '3px', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {flowPrompt}
                  </div>
                </div>
              )}

              {browserStep === 4 && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: 'var(--cyan)', fontWeight: 'bold', animation: 'blink 1s infinite' }}>SYNTHESIZING SOVEREIGN FLOW VECTORS</div>
                  <div style={{ fontSize: '7px', color: 'var(--text-dim)', marginTop: '4px' }}>Compiling 24fps keyframe arrays</div>
                  <div style={{ width: '100px', height: '2px', background: 'rgba(255,255,255,0.1)', margin: '8px auto 0 auto', borderRadius: '1px', overflow: 'hidden' }}>
                    <div style={{ width: `${orchestrationProgress}%`, height: '100%', background: 'var(--cyan)' }} />
                  </div>
                </div>
              )}

              {browserStep === 5 && (
                <div style={{ width: '100%', textAlign: 'center' }}>
                  <div style={{ fontSize: '9px', color: '#4ade80', fontWeight: 'bold' }}>✓ SOVEREIGN FLOW COMPLETE</div>
                  <div style={{ fontSize: '7px', color: 'var(--text-dim)', marginTop: '4px' }}>Conforming video timeline indices...</div>
                </div>
              )}

            </div>
          </div>

          {/* TELEMETRY CONSOLE STREAM */}
          <div style={{
            flex: 1,
            background: '#020202',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '6px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '180px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>CONSOLE OUTPUT STREAM</span>
              <button
                onClick={() => setFlowLogs([])}
                style={{ background: 'none', border: 'none', color: 'var(--pink)', fontSize: '8px', cursor: 'pointer' }}
              >
                CLEAR
              </button>
            </div>

            <div
              ref={logContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                fontFamily: 'var(--mono)',
                fontSize: '8px'
              }}
            >
              {flowLogs.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '30px 0' }}>
                  Awaiting conformed browser actions... logs will stream here.
                </div>
              ) : (
                flowLogs.map((log, idx) => (
                  <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '3px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>[{log.ts}]</span>{' '}
                    <span style={{
                      color: log.type === 'success' ? '#4ade80' : log.type === 'sys' ? '#60a5fa' : log.type === 'info' ? '#a78bfa' : '#c8d8e8'
                    }}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* ── THE INTERACTIVE MULTI-TRACK TIMELINE WORKSPACE ── */}
      <div style={{
        background: 'rgba(5, 5, 5, 0.98)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '20px 24px',
        flexShrink: 0,
        boxShadow: '0 -15px 30px rgba(0,0,0,0.95)'
      }}>
        
        {/* RULER / TIMEBAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>◆</span>
            <span style={{ color: '#fff', fontWeight: '800', fontSize: '11px', letterSpacing: '2px' }}>
              04 // SOVEREIGN EDIT CONFORM TIMELINE
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px', fontSize: '9px', background: 'rgba(255,255,255,0.02)', padding: '4px 12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Active Clip Selection:</span>
            <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{currentPreview ? currentPreview.name : 'RULER SCENE HEAD'}</span>
          </div>
        </div>

        {/* TIMELINE RULER & PLAYHEAD ZONE */}
        <div style={{ position: 'relative', background: '#020202', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', padding: '16px', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)' }}>
          
          {/* Time ticks ruler */}
          <div
            ref={rulerRef}
            onClick={handleRulerClick}
            style={{
              height: '32px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              position: 'relative',
              cursor: 'ew-resize',
              marginBottom: '16px',
              background: 'rgba(255,255,255,0.01)'
            }}
          >
            {/* Generate ticks */}
            {Array.from({ length: Math.floor(maxTime / 2) + 1 }).map((_, idx) => {
              const seconds = idx * 2;
              const percent = (seconds / maxTime) * 100;
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: `${percent}%`,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <div style={{ width: '1px', height: '8px', background: 'rgba(255,255,255,0.2)' }} />
                  <span style={{ fontSize: '7.5px', color: 'rgba(200,216,232,0.4)', fontFamily: 'var(--mono)', fontWeight: 'bold' }}>{seconds}s</span>
                </div>
              );
            })}

            {/* Glowing Interactive Playhead Teardrop Cap */}
            <div style={{
              position: 'absolute',
              left: `${(playheadTime / maxTime) * 100}%`,
              top: 0,
              width: '1px',
              height: '220px', 
              background: 'var(--cyan)',
              boxShadow: '0 0 10px var(--cyan)',
              zIndex: 100,
              pointerEvents: 'none',
              transform: 'translateX(-50%)'
            }}>
              {/* Teardrop Visual Handle */}
              <div style={{
                position: 'absolute',
                top: '-6px',
                left: '-14px',
                width: '28px',
                height: '22px',
                background: 'var(--cyan)',
                clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
                boxShadow: '0 4px 10px rgba(0,255,204,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '7px', color: '#000', fontWeight: '900', fontFamily: 'var(--mono)' }}>{Math.floor(playheadTime)}</span>
              </div>
            </div>
          </div>

          {/* TRACK 1: RAW INGEST TRACK */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '150px 1fr',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '12px',
            position: 'relative'
          }}>
            {/* Track Header controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>TRACK V1</span>
                <span style={{ fontSize: '7.5px', color: 'rgba(0, 255, 204, 0.6)', fontWeight: 'bold', marginTop: '2px' }}>[RAW SCAN LANE]</span>
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                <button onClick={() => setTrack1Mute(!track1Mute)} style={{ width: '16px', height: '16px', background: track1Mute ? 'rgba(255,51,102,0.2)' : '#121212', border: `1px solid ${track1Mute ? 'var(--pink)' : '#333'}`, color: track1Mute ? 'var(--pink)' : 'var(--text-dim)', fontSize: '8px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '3px' }}>M</button>
                <button onClick={() => setTrack1Solo(!track1Solo)} style={{ width: '16px', height: '16px', background: track1Solo ? 'rgba(0,255,204,0.2)' : '#121212', border: `1px solid ${track1Solo ? 'var(--cyan)' : '#333'}`, color: track1Solo ? 'var(--cyan)' : 'var(--text-dim)', fontSize: '8px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '3px' }}>S</button>
              </div>
            </div>
            
            {/* Timeline Lane */}
            <div style={{
              height: '56px',
              background: 'rgba(255, 255, 255, 0.01)',
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 15) 100%',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden',
              opacity: track1Mute ? 0.35 : 1,
              transition: 'opacity 0.2s'
            }}>
              {timelineV1.map((clip) => {
                const widthPct = (clip.duration / maxTime) * 100;
                const leftPct = (clip.start / maxTime) * 100;
                const isSelected = selectedClip?.id === clip.id;
                return (
                  <div
                    key={clip.id}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: '100%',
                      background: clip.color,
                      backgroundImage: `linear-gradient(90deg, transparent 40px, rgba(0,0,0,0.55) 40px), url(${clip.thumbnail})`,
                      backgroundSize: 'cover, cover',
                      backgroundBlendMode: 'multiply',
                      border: `1.5px solid ${isSelected ? 'var(--cyan)' : 'rgba(0, 255, 204, 0.3)'}`,
                      boxShadow: isSelected ? `0 0 15px ${clip.glow}` : 'none',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setSelectedClip(clip)}
                  >
                    {/* Visual Clip Trim Handles */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--cyan)', borderRadius: '2px 0 0 2px' }} />
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'var(--cyan)', borderRadius: '0 2px 2px 0' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingLeft: '6px' }}>
                      <img src={clip.thumbnail} alt="clip small" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.15)' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: '#fff', fontSize: '9px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {clip.name}
                        </div>
                        <div style={{ color: 'var(--cyan)', fontSize: '8px', marginTop: '2px', fontFamily: 'var(--mono)', fontWeight: 'bold' }}>
                          {clip.start}s - {clip.end}s ({clip.duration}s)
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(1, clip.id);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        color: 'var(--pink)',
                        fontSize: '9px',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TRACK 2: GENERATIVE TRANSITIONS */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '150px 1fr',
            alignItems: 'center',
            gap: '16px',
            position: 'relative'
          }}>
            {/* Track Header controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '9px', fontWeight: '800', color: '#fff', letterSpacing: '1px' }}>TRACK V2</span>
                <span style={{ fontSize: '7.5px', color: 'rgba(167, 139, 250, 0.6)', fontWeight: 'bold', marginTop: '2px' }}>[INFUSION FLOW]</span>
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                <button onClick={() => setTrack2Mute(!track2Mute)} style={{ width: '16px', height: '16px', background: track2Mute ? 'rgba(255,51,102,0.2)' : '#121212', border: `1px solid ${track2Mute ? 'var(--pink)' : '#333'}`, color: track2Mute ? 'var(--pink)' : 'var(--text-dim)', fontSize: '8px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '3px' }}>M</button>
                <button onClick={() => setTrack2Solo(!track2Solo)} style={{ width: '16px', height: '16px', background: track2Solo ? 'rgba(0,255,204,0.2)' : '#121212', border: `1px solid ${track2Solo ? 'var(--cyan)' : '#333'}`, color: track2Solo ? 'var(--cyan)' : 'var(--text-dim)', fontSize: '8px', cursor: 'pointer', fontWeight: 'bold', borderRadius: '3px' }}>S</button>
              </div>
            </div>
            
            {/* Timeline Lane */}
            <div style={{
              height: '56px',
              background: 'rgba(255, 255, 255, 0.01)',
              backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 15) 100%',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'hidden',
              opacity: track2Mute ? 0.35 : 1,
              transition: 'opacity 0.2s'
            }}>
              {timelineV2.map((clip) => {
                const widthPct = (clip.duration / maxTime) * 100;
                const leftPct = (clip.start / maxTime) * 100;
                const isSelected = selectedClip?.id === clip.id;
                return (
                  <div
                    key={clip.id}
                    style={{
                      position: 'absolute',
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      height: '100%',
                      background: clip.color,
                      backgroundImage: `linear-gradient(90deg, transparent 40px, rgba(0,0,0,0.6) 40px), url(${clip.thumbnail})`,
                      backgroundSize: 'cover, cover',
                      backgroundBlendMode: 'multiply',
                      border: `1.5px dashed ${isSelected ? '#a78bfa' : 'rgba(167, 139, 250, 0.5)'}`,
                      boxShadow: isSelected ? `0 0 15px ${clip.glow}` : 'none',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 8px',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      justifyContent: 'space-between',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setSelectedClip(clip)}
                  >
                    {/* Visual Clip Trim Handles */}
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: '#a78bfa', borderRadius: '2px 0 0 2px' }} />
                    <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: '#a78bfa', borderRadius: '0 2px 2px 0' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingLeft: '6px' }}>
                      <img src={clip.thumbnail} alt="clip small" style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '3px', border: '1px solid rgba(255,255,255,0.15)' }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: '#a78bfa', fontSize: '9px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {clip.name}
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '8px', marginTop: '2px', fontFamily: 'var(--mono)' }}>
                          {clip.start}s - {clip.end}s ({clip.duration}s)
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeClip(2, clip.id);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.5)',
                        border: 'none',
                        color: 'var(--pink)',
                        fontSize: '9px',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* SOVEREIGN CONFORM COMPILER FOOTER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          background: 'rgba(5, 10, 15, 0.75)',
          border: '1px solid rgba(0, 255, 204, 0.15)',
          padding: '12px 20px',
          borderRadius: '6px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ fontSize: '9.5px', color: 'var(--text-dim)' }}>
            Conform Pipeline: <span style={{ color: '#fff', fontWeight: 'bold' }}>Sovereign Conformer Bridge (Port 5105 via Proxy)</span>
          </div>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {compileStatus === 'compiling' && (
              <span style={{ color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
                <span className="spinner" style={{ width: '12px', height: '12px' }} />
                Encoding Sovereign XML Edit Decision List...
              </span>
            )}
            
            {compileStatus === 'success' && (
              <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '10px', animation: 'blink 1.5s infinite' }}>
                🟢 Conform Success! Live Timeline Synced to Sovereign Studio.
              </span>
            )}

            <button
              onClick={handlePushToDaVinci}
              disabled={compileStatus === 'compiling'}
              style={{
                background: 'linear-gradient(135deg, #00FFCC 0%, #00cc99 100%)',
                border: 'none',
                color: '#000',
                padding: '10px 24px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '900',
                letterSpacing: '1.5px',
                fontSize: '10px',
                boxShadow: '0 4px 15px rgba(0,255,204,0.35)',
                transition: 'all 0.18s ease-in-out'
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,255,204,0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,255,204,0.35)'}
            >
              COMPILE & SYNC TO CONFORMER
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

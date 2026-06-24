import React, { useState, useEffect, useRef } from 'react';
import { 
  Vector3, 
  CameraKeyframe, 
  CameraPathTrack, 
  SplatCloudMetadata, 
  RenderSettings, 
  PipelineTelemetry,
  ShadingModel,
  InterpolationType
} from './types';
import { 
  IconButton, 
  SliderControl, 
  PanelHeader, 
  ViewportCameraControls,
  Icons
} from './controls';

// ----------------------------------------------------
// DEFAULT HIGH-FIDELITY INITIAL STATES & MOCK TELEMETRY
// ----------------------------------------------------

const INITIAL_SPLAT_METADATA: SplatCloudMetadata = {
  pointCount: 1478290,
  boundingBox: {
    min: { x: -12.4, y: -5.2, z: -10.8 },
    max: { x: 12.4, y: 8.9, z: 11.2 }
  },
  shDegree: 3,
  compressed: true,
  compressionFormat: 'FLOAT16',
  averageDensity: 3450.4,
  diskSizeOctets: 47289560 // ~45.1 MB
};

const INITIAL_RENDER_SETTINGS: RenderSettings = {
  shadingModel: 'GAUSSIAN_SPLAT',
  voxelSize: 0.12,
  splatOpacity: 0.85,
  exposure: 1.1,
  renderBudget: 1500000,
  chromaticAberration: 0.25,
  nearFarPlane: [0.1, 1000.0],
  pointScale: 1.8,
  enableBloom: true,
  enableVoxelGridOverlay: false
};

const INITIAL_PATH_TRACK: CameraPathTrack = {
  id: 'path_director_alpha',
  name: 'Cinematic Orbit Track A',
  loop: true,
  totalDuration: 10.0,
  colorCode: '#00FFCC',
  keyframes: [
    {
      id: 'kf_0',
      timestamp: 0.0,
      position: { x: -8.5, y: 4.2, z: 12.0 },
      quaternion: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
      fov: 65,
      focalLength: 35,
      interpolation: 'CATMULL_ROM',
      tension: 0
    },
    {
      id: 'kf_1',
      timestamp: 3.5,
      position: { x: 4.0, y: 6.8, z: 9.5 },
      quaternion: { x: -0.15, y: 0.65, z: 0.15, w: 0.72 },
      fov: 55,
      focalLength: 50,
      interpolation: 'CATMULL_ROM',
      tension: 0
    },
    {
      id: 'kf_2',
      timestamp: 7.0,
      position: { x: 10.2, y: 2.1, z: -6.4 },
      quaternion: { x: -0.3, y: 0.3, z: 0.1, w: 0.9 },
      fov: 60,
      focalLength: 28,
      interpolation: 'LINEAR',
      tension: 0
    },
    {
      id: 'kf_3',
      timestamp: 10.0,
      position: { x: -8.5, y: 4.2, z: 12.0 },
      quaternion: { x: 0, y: 0.7071, z: 0, w: 0.7071 },
      fov: 65,
      focalLength: 35,
      interpolation: 'CATMULL_ROM',
      tension: 0
    }
  ]
};

export const SpectraSplatInspector: React.FC = () => {
  // --- UI Collapsible States ---
  const [isRenderSettingsCollapsed, setIsRenderSettingsCollapsed] = useState(false);
  const [isPathCollapsed, setIsPathCollapsed] = useState(false);
  const [isStatsCollapsed, setIsStatsCollapsed] = useState(false);

  // --- Core Domain State Hooks ---
  const [splatMetadata] = useState<SplatCloudMetadata>(INITIAL_SPLAT_METADATA);
  const [renderSettings, setRenderSettings] = useState<RenderSettings>(INITIAL_RENDER_SETTINGS);
  const [activeTrack, setActiveTrack] = useState<CameraPathTrack>(INITIAL_PATH_TRACK);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string>('kf_0');
  
  // --- Viewport State Hooks ---
  const [activeCamMode, setActiveCamMode] = useState<string>('orbit');
  const [projectionMode, setProjectionMode] = useState<'PERSPECTIVE' | 'ORTHOGRAPHIC'>('PERSPECTIVE');
  
  // --- Playback Telemetry Simulation ---
  const [telemetry, setTelemetry] = useState<PipelineTelemetry>({
    fps: 144,
    activePointsCount: 1120489,
    culledPointsCount: 357801,
    drawCallsCount: 124,
    gpuMemoryUsageMb: 248.5,
    voxelTraversalCount: 1840,
    isRecording: false,
    playbackState: 'PAUSED',
    currentTrackTime: 0.0
  });

  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live framerate / telemetry micro-jitter to represent hardware activity
  useEffect(() => {
    const jitter = setInterval(() => {
      setTelemetry(prev => ({
        ...prev,
        fps: Math.floor(138 + Math.random() * 8),
        gpuMemoryUsageMb: parseFloat((247.8 + Math.random() * 1.5).toFixed(1)),
        voxelTraversalCount: Math.floor(1810 + Math.random() * 60)
      }));
    }, 1000);
    return () => clearInterval(jitter);
  }, []);

  // Path playback tick
  useEffect(() => {
    if (telemetry.playbackState === 'PLAYING') {
      const dt = 0.05; // 50ms intervals
      playbackIntervalRef.current = setInterval(() => {
        setTelemetry(prev => {
          let newTime = prev.currentTrackTime + dt;
          if (newTime >= activeTrack.totalDuration) {
            if (activeTrack.loop) {
              newTime = 0.0;
            } else {
              newTime = activeTrack.totalDuration;
              clearInterval(playbackIntervalRef.current!);
              return { ...prev, playbackState: 'PAUSED', currentTrackTime: newTime };
            }
          }
          return { ...prev, currentTrackTime: newTime };
        });
      }, 50);
    } else {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    }

    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [telemetry.playbackState, activeTrack]);

  // Sync selected keyframe timestamp on time changes during playback
  useEffect(() => {
    if (telemetry.playbackState === 'PLAYING') {
      // Find closest keyframe to current time
      const closest = activeTrack.keyframes.reduce((prev, curr) => {
        return Math.abs(curr.timestamp - telemetry.currentTrackTime) < Math.abs(prev.timestamp - telemetry.currentTrackTime) ? curr : prev;
      });
      setSelectedKeyframeId(closest.id);
    }
  }, [telemetry.currentTrackTime, activeTrack.keyframes, telemetry.playbackState]);

  // Find currently selected keyframe
  const currentKeyframe = activeTrack.keyframes.find(kf => kf.id === selectedKeyframeId) || activeTrack.keyframes[0];

  // --- Handlers ---
  const handleRenderSettingChange = <K extends keyof RenderSettings>(key: K, value: RenderSettings[K]) => {
    setRenderSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleKeyframeCoordinateChange = (axis: 'x' | 'y' | 'z', delta: number) => {
    setActiveTrack(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf => {
        if (kf.id === selectedKeyframeId) {
          return {
            ...kf,
            position: {
              ...kf.position,
              [axis]: parseFloat((kf.position[axis] + delta).toFixed(2))
            }
          };
        }
        return kf;
      })
    }));
  };

  const handleKeyframePropertyChange = <K extends keyof CameraKeyframe>(key: K, value: CameraKeyframe[K]) => {
    setActiveTrack(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf => {
        if (kf.id === selectedKeyframeId) {
          return {
            ...kf,
            [key]: value
          };
        }
        return kf;
      })
    }));
  };

  const handleAddKeyframe = () => {
    const newId = `kf_${Date.now()}`;
    const timestamp = parseFloat(telemetry.currentTrackTime.toFixed(2));
    
    // Check if keyframe already exists at exactly this timestamp to avoid duplication issues
    const duplicateIdx = activeTrack.keyframes.findIndex(k => Math.abs(k.timestamp - timestamp) < 0.05);

    let updatedKeyframes = [...activeTrack.keyframes];
    const newKeyframe: CameraKeyframe = {
      id: newId,
      timestamp,
      position: { ...currentKeyframe.position, x: currentKeyframe.position.x + 1 },
      quaternion: { ...currentKeyframe.quaternion },
      fov: currentKeyframe.fov,
      focalLength: currentKeyframe.focalLength,
      interpolation: currentKeyframe.interpolation
    };

    if (duplicateIdx !== -1) {
      updatedKeyframes[duplicateIdx] = { ...newKeyframe, id: activeTrack.keyframes[duplicateIdx].id };
    } else {
      updatedKeyframes.push(newKeyframe);
      // Sort keyframes sequentially by timestamp
      updatedKeyframes.sort((a, b) => a.timestamp - b.timestamp);
    }

    setActiveTrack(prev => ({
      ...prev,
      keyframes: updatedKeyframes,
      totalDuration: Math.max(prev.totalDuration, updatedKeyframes[updatedKeyframes.length - 1].timestamp)
    }));
    setSelectedKeyframeId(newId);
  };

  const handleDeleteKeyframe = (id: string) => {
    if (activeTrack.keyframes.length <= 1) return; // Prevent deleting the last keyframe

    const updated = activeTrack.keyframes.filter(k => k.id !== id);
    setActiveTrack(prev => ({
      ...prev,
      keyframes: updated,
      totalDuration: updated[updated.length - 1]?.timestamp || 10.0
    }));

    if (selectedKeyframeId === id) {
      setSelectedKeyframeId(updated[0].id);
    }
  };

  const togglePlayback = () => {
    setTelemetry(prev => ({
      ...prev,
      playbackState: prev.playbackState === 'PLAYING' ? 'PAUSED' : 'PLAYING'
    }));
  };

  const stopPlayback = () => {
    setTelemetry(prev => ({
      ...prev,
      playbackState: 'STOPPED',
      currentTrackTime: 0.0
    }));
  };

  const handleTimelineScrub = (time: number) => {
    setTelemetry(prev => ({ ...prev, currentTrackTime: time }));
  };

  const exportPath = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeTrack, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `spectrasplat_path_${activeTrack.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Convert octets to human readable MB/GB
  const formatOctets = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="flex flex-col gap-5 w-full max-w-[420px] bg-[#020204]/80 backdrop-blur-xl border border-cyan-500/15 shadow-[0_0_35px_rgba(0,255,204,0.08)] rounded-xl overflow-hidden text-white font-sans select-none">
      
      {/* Title / Glassmorphism Panel Header */}
      <div className="relative">
        <PanelHeader 
          title="SpectraSplat Inspector" 
          subTitle="5D Gaussian Traversal Interface" 
          icon="Orbit"
          statusColor="cyan"
          onActionClick={() => alert("System Preferences: Synchronizing project context")}
        />
        {/* Holographic background gradient overlay */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00FFCC] to-transparent" />
      </div>

      <div className="flex flex-col gap-4 p-4 overflow-y-auto max-h-[85vh] scrollbar-thin scrollbar-thumb-neutral-900 scrollbar-track-transparent">
        
        {/* VIEWPORT CONTROLS EMISSION */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono text-neutral-500 font-bold uppercase tracking-wider">CAMERA INTERACTION LAYER</span>
          <ViewportCameraControls 
            activeCamera={activeCamMode}
            projectionMode={projectionMode}
            onCameraChange={(mode) => setActiveCamMode(mode)}
            onProjectionToggle={() => setProjectionMode(prev => prev === 'PERSPECTIVE' ? 'ORTHOGRAPHIC' : 'PERSPECTIVE')}
            onSaveView={() => alert("Vector View State Captured to Memory Spine")}
            onRestoreView={() => {
              setActiveCamMode('orbit');
              setProjectionMode('PERSPECTIVE');
            }}
          />
        </div>

        {/* 1. CLOUD METADATA PANEL */}
        <div className="rounded-lg bg-neutral-950/60 border border-neutral-900 overflow-hidden">
          <div 
            className="flex items-center justify-between p-3 bg-neutral-950/90 border-b border-neutral-900 cursor-pointer"
            onClick={() => setIsStatsCollapsed(!isStatsCollapsed)}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D946EF] shadow-[0_0_4px_rgba(217,70,239,0.8)]" />
              <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-300 uppercase">Splat Cloud Telemetry</span>
            </div>
            <div className={`text-neutral-500 transition-transform ${isStatsCollapsed ? 'transform -rotate-90' : ''}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {!isStatsCollapsed && (
            <div className="p-3.5 flex flex-col gap-2.5 font-mono text-[10px]">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2 rounded bg-neutral-900/40 border border-neutral-900/80">
                  <div className="text-neutral-500 uppercase tracking-tight">Active Points</div>
                  <div className="text-xs font-bold text-white mt-0.5">{(splatMetadata.pointCount).toLocaleString()} pts</div>
                </div>
                <div className="p-2 rounded bg-neutral-900/40 border border-neutral-900/80">
                  <div className="text-neutral-500 uppercase tracking-tight">SH Harmonics</div>
                  <div className="text-xs font-bold text-[#00FFCC] mt-0.5">Degree 3 (5D Vector)</div>
                </div>
                <div className="p-2 rounded bg-neutral-900/40 border border-neutral-900/80">
                  <div className="text-neutral-500 uppercase tracking-tight">Average Density</div>
                  <div className="text-xs font-bold text-neutral-300 mt-0.5">{splatMetadata.averageDensity.toFixed(1)} / m³</div>
                </div>
                <div className="p-2 rounded bg-neutral-900/40 border border-neutral-900/80">
                  <div className="text-neutral-500 uppercase tracking-tight">Hardware Size</div>
                  <div className="text-xs font-bold text-[#D946EF] mt-0.5">{formatOctets(splatMetadata.diskSizeOctets)}</div>
                </div>
              </div>

              {/* Bounding Box Info */}
              <div className="p-2.5 rounded bg-neutral-950 border border-neutral-900/80 flex flex-col gap-1">
                <div className="text-neutral-500 uppercase tracking-tight flex justify-between">
                  <span>Bounding Box Range</span>
                  <span className="text-[8px] text-[#00FFCC] bg-cyan-900/20 px-1 rounded">X Y Z MIN/MAX</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[9px] text-neutral-400 mt-1">
                  <div className="flex justify-between border-r border-neutral-800 pr-2">
                    <span>MIN:</span>
                    <span className="text-neutral-300 font-bold">[{splatMetadata.boundingBox.min.x}, {splatMetadata.boundingBox.min.y}, {splatMetadata.boundingBox.min.z}]</span>
                  </div>
                  <div className="flex justify-between pl-1">
                    <span>MAX:</span>
                    <span className="text-neutral-300 font-bold">[{splatMetadata.boundingBox.max.x}, {splatMetadata.boundingBox.max.y}, {splatMetadata.boundingBox.max.z}]</span>
                  </div>
                </div>
              </div>

              {/* Live Render Diagnostics */}
              <div className="pt-2 border-t border-neutral-900 flex justify-between text-[9px] text-neutral-500 font-semibold uppercase">
                <span>FPS: <strong className="text-green-400 font-bold">{telemetry.fps}</strong></span>
                <span>GPU-MEM: <strong className="text-white font-bold">{telemetry.gpuMemoryUsageMb} MB</strong></span>
                <span>VOX-TRAV: <strong className="text-cyan-400 font-bold">{telemetry.voxelTraversalCount}</strong></span>
              </div>
            </div>
          )}
        </div>

        {/* 2. LIVE CAMERA PATH TIMELINE EDITOR */}
        <div className="rounded-lg bg-neutral-950/60 border border-neutral-900 overflow-hidden">
          <div 
            className="flex items-center justify-between p-3 bg-neutral-950/90 border-b border-neutral-900 cursor-pointer"
            onClick={() => setIsPathCollapsed(!isPathCollapsed)}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FFCC] shadow-[0_0_4px_rgba(0,255,204,0.8)]" />
              <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-300 uppercase">Camera Path Tracking</span>
            </div>
            <div className={`text-neutral-500 transition-transform ${isPathCollapsed ? 'transform -rotate-90' : ''}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {!isPathCollapsed && (
            <div className="p-3.5 flex flex-col gap-4">
              
              {/* Timeline Track Scrubber */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400">
                  <span className="text-[#00FFCC] font-bold">{activeTrack.name}</span>
                  <span>{telemetry.currentTrackTime.toFixed(2)}s / {activeTrack.totalDuration.toFixed(1)}s</span>
                </div>

                {/* Scrubber Rail with Keyframe Diamond Markers */}
                <div className="relative w-full h-7 bg-neutral-900/60 border border-neutral-950 rounded flex items-center overflow-visible">
                  {/* Real slider mapping */}
                  <input 
                    type="range" 
                    min={0}
                    max={activeTrack.totalDuration}
                    step={0.01}
                    value={telemetry.currentTrackTime}
                    onChange={(e) => handleTimelineScrub(parseFloat(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />

                  {/* Render fill track */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 bg-cyan-900/20 border-r border-[#00FFCC]/40 transition-all pointer-events-none"
                    style={{ width: `${(telemetry.currentTrackTime / activeTrack.totalDuration) * 100}%` }}
                  />

                  {/* Render Keyframe Tick Diamonds */}
                  {activeTrack.keyframes.map((kf) => {
                    const posPct = (kf.timestamp / activeTrack.totalDuration) * 100;
                    const isSelected = kf.id === selectedKeyframeId;
                    return (
                      <div 
                        key={kf.id}
                        className={`absolute w-2.5 h-2.5 rotate-45 transform -translate-x-1.25 border pointer-events-none transition-all ${
                          isSelected 
                            ? 'bg-[#D946EF] border-[#FFFFFF] z-10 shadow-[0_0_8px_rgba(217,70,239,0.9)] scale-110' 
                            : 'bg-neutral-800 border-neutral-600'
                        }`}
                        style={{ left: `${posPct}%` }}
                      />
                    );
                  })}

                  {/* Playhead marker indicator */}
                  <div 
                    className="absolute w-[2px] h-full bg-[#00FFCC] pointer-events-none shadow-[0_0_5px_rgba(0,255,204,0.8)] z-10"
                    style={{ left: `${(telemetry.currentTrackTime / activeTrack.totalDuration) * 100}%` }}
                  />
                </div>
              </div>

              {/* Playback Controls & Keyframe Actions */}
              <div className="flex justify-between items-center bg-black/40 p-2 rounded-lg border border-neutral-900">
                <div className="flex gap-1.5">
                  <button 
                    onClick={togglePlayback}
                    className={`p-2 rounded-md border font-mono text-[9px] font-bold flex items-center gap-1.5 transition-all duration-300 ${
                      telemetry.playbackState === 'PLAYING'
                        ? 'bg-magenta-500/10 text-magenta-400 border-magenta-500/30'
                        : 'bg-cyan-500/10 text-[#00FFCC] border-cyan-500/30'
                    }`}
                  >
                    {telemetry.playbackState === 'PLAYING' ? (
                      <>
                        <span className="w-1.5 h-1.5 bg-magenta-400 animate-pulse rounded-full" />
                        PAUSE
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 bg-[#00FFCC] rounded-full" />
                        PLAY
                      </>
                    )}
                  </button>

                  <button 
                    onClick={stopPlayback}
                    className="p-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 rounded-md border border-neutral-800 hover:text-white transition-colors"
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                  </button>
                </div>

                <div className="flex gap-1">
                  <button
                    onClick={handleAddKeyframe}
                    className="px-2.5 py-1.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-[#00FFCC] font-mono text-[9px] font-bold hover:bg-cyan-950/70 hover:border-cyan-500/40 transition-all flex items-center gap-1"
                    title="Add Keyframe at current playhead"
                  >
                    + ADD KF
                  </button>
                  <button
                    onClick={() => handleDeleteKeyframe(selectedKeyframeId)}
                    disabled={activeTrack.keyframes.length <= 1}
                    className="px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-500 font-mono text-[9px] hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-neutral-500 disabled:hover:border-neutral-800 transition-all"
                    title="Delete Selected Keyframe"
                  >
                    DELETE
                  </button>
                </div>
              </div>

              {/* ACTIVE KEYFRAME DETAIL EDITOR */}
              <div className="p-3 bg-neutral-950 border border-neutral-900 rounded-lg flex flex-col gap-3 font-mono text-[10px]">
                <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                  <span className="text-neutral-400">ACTIVE KEYFRAME: <strong className="text-white font-bold">{currentKeyframe.id.toUpperCase()}</strong></span>
                  <span className="text-[9px] text-neutral-500 bg-neutral-900 px-1.5 py-0.5 rounded">T: {currentKeyframe.timestamp.toFixed(2)}s</span>
                </div>

                {/* Coordinate Delta Editor (Direct vector math adjustments) */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] text-neutral-500 uppercase tracking-wide">Spatial Node Coordinates [X, Y, Z]</span>
                  <div className="grid grid-cols-3 gap-2">
                    {/* X Coordinate */}
                    <div className="flex flex-col border border-neutral-900 rounded bg-neutral-900/30 p-1">
                      <span className="text-[8px] text-[#D946EF] font-bold">X (LATERAL)</span>
                      <div className="flex justify-between items-center mt-1">
                        <button onClick={() => handleKeyframeCoordinateChange('x', -0.5)} className="text-neutral-500 hover:text-white font-bold px-1 text-xs">-</button>
                        <span className="text-white font-bold">{currentKeyframe.position.x.toFixed(1)}</span>
                        <button onClick={() => handleKeyframeCoordinateChange('x', 0.5)} className="text-neutral-500 hover:text-white font-bold px-1 text-xs">+</button>
                      </div>
                    </div>
                    {/* Y Coordinate */}
                    <div className="flex flex-col border border-neutral-900 rounded bg-neutral-900/30 p-1">
                      <span className="text-[8px] text-[#00FFCC] font-bold">Y (ALTITUDE)</span>
                      <div className="flex justify-between items-center mt-1">
                        <button onClick={() => handleKeyframeCoordinateChange('y', -0.5)} className="text-neutral-500 hover:text-white font-bold px-1 text-xs">-</button>
                        <span className="text-white font-bold">{currentKeyframe.position.y.toFixed(1)}</span>
                        <button onClick={() => handleKeyframeCoordinateChange('y', 0.5)} className="text-neutral-500 hover:text-white font-bold px-1 text-xs">+</button>
                      </div>
                    </div>
                    {/* Z Coordinate */}
                    <div className="flex flex-col border border-neutral-900 rounded bg-neutral-900/30 p-1">
                      <span className="text-[8px] text-white opacity-60 font-bold">Z (DEPTH)</span>
                      <div className="flex justify-between items-center mt-1">
                        <button onClick={() => handleKeyframeCoordinateChange('z', -0.5)} className="text-neutral-500 hover:text-white font-bold px-1 text-xs">-</button>
                        <span className="text-white font-bold">{currentKeyframe.position.z.toFixed(1)}</span>
                        <button onClick={() => handleKeyframeCoordinateChange('z', 0.5)} className="text-neutral-500 hover:text-white font-bold px-1 text-xs">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Interpolation Type Selection */}
                <div className="flex justify-between items-center pt-1.5 border-t border-neutral-900">
                  <span className="text-neutral-400 uppercase tracking-tight">Path Interpolator</span>
                  <select
                    value={currentKeyframe.interpolation}
                    onChange={(e) => handleKeyframePropertyChange('interpolation', e.target.value as InterpolationType)}
                    className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[9px] text-[#00FFCC] focus:outline-none focus:border-cyan-500"
                  >
                    <option value="CATMULL_ROM">CATMULL-ROM (BEZIER SMOOTH)</option>
                    <option value="LINEAR">LINEAR INTERPOLATION</option>
                    <option value="STEP">STEP SEQUENCE</option>
                    <option value="HERMITE">HERMITE spline</option>
                  </select>
                </div>

                {/* FOV and Focal Length adjustment */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-neutral-900">
                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-neutral-500 uppercase">Camera FOV</span>
                    <input 
                      type="range"
                      min={15}
                      max={120}
                      value={currentKeyframe.fov}
                      onChange={(e) => handleKeyframePropertyChange('fov', parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-neutral-400 mt-0.5">
                      <span>15°</span>
                      <span className="text-cyan-400 font-bold">{currentKeyframe.fov}°</span>
                      <span>120°</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[8px] text-neutral-500 uppercase">Focal Dispersion</span>
                    <input 
                      type="range"
                      min={10}
                      max={200}
                      value={currentKeyframe.focalLength}
                      onChange={(e) => handleKeyframePropertyChange('focalLength', parseInt(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-neutral-400 mt-0.5">
                      <span>10mm</span>
                      <span className="text-magenta-400 font-bold">{currentKeyframe.focalLength}mm</span>
                      <span>200mm</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Voxel Traversal Vector Speed Chart (SVG drawn curves based on keyframes) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-mono text-neutral-500 uppercase font-bold tracking-wide">Voxel Vector Traversal Velocity Plot</span>
                <div className="h-16 w-full rounded-lg bg-neutral-950 border border-neutral-900 relative overflow-hidden p-1">
                  <svg className="w-full h-full" viewBox="0 0 300 60" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#00FFCC" stop-opacity="0.3"/>
                        <stop offset="100%" stop-color="#00FFCC" stop-opacity="0"/>
                      </linearGradient>
                    </defs>
                    {/* Background Grid Lines */}
                    <line x1="0" y1="20" x2="300" y2="20" stroke="#121217" strokeWidth="0.5" />
                    <line x1="0" y1="40" x2="300" y2="40" stroke="#121217" strokeWidth="0.5" />
                    
                    {/* Interpolated velocity visual curve representing speed trajectory */}
                    <path 
                      d="M 0,45 C 50,42 90,5 120,8 C 160,12 210,50 250,48 C 280,47 290,45 300,45"
                      fill="url(#chart-grad)" 
                      stroke="#00FFCC" 
                      strokeWidth="1.5" 
                    />
                    
                    {/* Dashed vertical marker mapping current playback time */}
                    <line 
                      x1={(telemetry.currentTrackTime / activeTrack.totalDuration) * 300} 
                      y1="0" 
                      x2={(telemetry.currentTrackTime / activeTrack.totalDuration) * 300} 
                      y2="60" 
                      stroke="#D946EF" 
                      strokeWidth="1" 
                      strokeDasharray="2 3"
                    />
                  </svg>
                  <div className="absolute top-1 left-2 text-[7px] font-mono text-neutral-600 uppercase">Traversal Speed (V/s)</div>
                  <div className="absolute bottom-1 right-2 text-[7px] font-mono text-neutral-500 uppercase">Playhead: {telemetry.currentTrackTime.toFixed(1)}s</div>
                </div>
              </div>

              {/* Export Path button */}
              <button
                onClick={exportPath}
                className="w-full py-2.5 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-cyan-500 hover:border-opacity-30 hover:text-cyan-400 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 group"
              >
                <span>EXPORT SPATIAL TRACK DATA</span>
                <Icons.ArrowUpRight className="w-4 h-4 transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

            </div>
          )}
        </div>

        {/* 3. SHADING & QUANTIZATION RENDER BUDGETS */}
        <div className="rounded-lg bg-neutral-950/60 border border-neutral-900 overflow-hidden">
          <div 
            className="flex items-center justify-between p-3 bg-neutral-950/90 border-b border-neutral-900 cursor-pointer"
            onClick={() => setIsRenderSettingsCollapsed(!isRenderSettingsCollapsed)}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
              <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-300 uppercase">Render Shader Engine</span>
            </div>
            <div className={`text-neutral-500 transition-transform ${isRenderSettingsCollapsed ? 'transform -rotate-90' : ''}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>

          {!isRenderSettingsCollapsed && (
            <div className="p-3.5 flex flex-col gap-4">
              
              {/* Shading Model Select */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-[10px] font-mono text-neutral-400">
                  <span className="font-semibold uppercase tracking-wide">Shading & Traversal Mode</span>
                  <span className="text-cyan-400 font-bold">{renderSettings.shadingModel.replace('_', ' ')}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 bg-black/60 p-1 border border-neutral-950 rounded-lg">
                  {(['GAUSSIAN_SPLAT', 'VOXEL_METRIC', 'DEPTH_MAP'] as ShadingModel[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleRenderSettingChange('shadingModel', mode)}
                      className={`py-1.5 rounded text-[8px] font-mono font-bold tracking-tighter uppercase transition-all ${
                        renderSettings.shadingModel === mode
                          ? 'bg-[#00FFCC]/10 text-[#00FFCC] border border-[#00FFCC]/20'
                          : 'text-neutral-500 hover:text-neutral-300 border border-transparent'
                      }`}
                    >
                      {mode.split('_')[0]} {mode.split('_')[1] || ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders Container using synthesized SliderControl */}
              <div className="flex flex-col gap-2">
                <SliderControl 
                  label="Voxel Mesh Grid Granularity" 
                  value={renderSettings.voxelSize}
                  min={0.01}
                  max={1.00}
                  step={0.01}
                  unit="m"
                  themeColor="cyan"
                  onChange={(val) => handleRenderSettingChange('voxelSize', val)}
                />

                <SliderControl 
                  label="Gaussian Kernel Opacity" 
                  value={renderSettings.splatOpacity}
                  min={0.00}
                  max={1.00}
                  step={0.05}
                  themeColor="magenta"
                  onChange={(val) => handleRenderSettingChange('splatOpacity', val)}
                />

                <SliderControl 
                  label="Viewport Render Budget" 
                  value={renderSettings.renderBudget}
                  min={100000}
                  max={3000000}
                  step={50000}
                  unit=" splats"
                  themeColor="neutral"
                  onChange={(val) => handleRenderSettingChange('renderBudget', val)}
                />

                <SliderControl 
                  label="Chromatic Dispersion Intensity" 
                  value={renderSettings.chromaticAberration}
                  min={0.00}
                  max={2.00}
                  step={0.05}
                  themeColor="cyan"
                  onChange={(val) => handleRenderSettingChange('chromaticAberration', val)}
                />
              </div>

              {/* Render Boolean Toggles */}
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono font-bold">
                <button
                  onClick={() => handleRenderSettingChange('enableBloom', !renderSettings.enableBloom)}
                  className={`py-2 px-3 border rounded-lg transition-all flex items-center justify-between ${
                    renderSettings.enableBloom
                      ? 'bg-magenta-500/10 text-[#D946EF] border-magenta-500/20'
                      : 'bg-[#020204]/40 text-neutral-500 border-neutral-900'
                  }`}
                >
                  <span>SPECTRUM BLOOM</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${renderSettings.enableBloom ? 'bg-[#D946EF]' : 'bg-neutral-800'}`} />
                </button>

                <button
                  onClick={() => handleRenderSettingChange('enableVoxelGridOverlay', !renderSettings.enableVoxelGridOverlay)}
                  className={`py-2 px-3 border rounded-lg transition-all flex items-center justify-between ${
                    renderSettings.enableVoxelGridOverlay
                      ? 'bg-cyan-500/10 text-[#00FFCC] border-cyan-500/20'
                      : 'bg-[#020204]/40 text-neutral-500 border-neutral-900'
                  }`}
                >
                  <span>GRID TRAVERSAL</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${renderSettings.enableVoxelGridOverlay ? 'bg-[#00FFCC]' : 'bg-neutral-800'}`} />
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

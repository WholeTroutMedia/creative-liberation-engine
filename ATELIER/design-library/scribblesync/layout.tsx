import React, { useState } from 'react';
import { Storyboard, ActiveFrame } from './types';
import { BrutalistButton, SyncButton, PlayButton, FrameActionButton } from './buttons';

/**
 * 1. HIGH-FIDELITY VECTOR GRAPHICS FOR STORYBOARD CELLS
 * Rendered inline inside cells to represent live scribbled storyboards
 */
const DrawWorkspaceSVG: React.FC = () => (
  <svg viewBox="0 0 320 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FDFBF7" />
    <path d="M 0 150 L 320 150 M 80 150 L 80 80 L 240 80 L 240 150" fill="none" stroke="#000000" strokeWidth="3" />
    <circle cx="160" cy="110" r="18" fill="none" stroke="#000000" strokeWidth="4" />
    <path d="M 155 110 L 165 110 M 160 105 L 160 115" stroke="#000000" strokeWidth="3" />
    <path d="M 100 95 C 120 105, 130 90, 150 115 C 180 85, 200 120, 220 95" fill="none" stroke="#FF4E00" strokeWidth="4" strokeLinecap="round" />
    <line x1="20" y1="40" x2="300" y2="40" stroke="#000000" strokeWidth="1" strokeDasharray="5 5" />
    <text x="30" y="30" font-family="monospace" font-size="10" fill="#FF4E00" font-weight="bold">ESTABLISHING SHOT: CANVAS BASE</text>
  </svg>
);

const DrawWiggleSVG: React.FC = () => (
  <svg viewBox="0 0 320 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FDFBF7" />
    <path d="M 0 150 C 100 130, 220 170, 320 150" fill="none" stroke="#000000" strokeWidth="3" />
    <path d="M 160 145 C 130 110, 120 70, 160 50 C 200 70, 190 110, 160 145" fill="#FF4E00" stroke="#000000" strokeWidth="3" opacity="0.8" />
    <circle cx="150" cy="80" r="3" fill="#000000" />
    <circle cx="170" cy="80" r="3" fill="#000000" />
    <path d="M 148 95 C 155 105, 165 105, 172 95" fill="none" stroke="#000000" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M 80 40 L 70 30 M 240 40 L 250 30 M 160 25 L 160 10" stroke="#000000" strokeWidth="2.5" strokeLinecap="round" />
    <text x="30" y="30" font-family="monospace" font-size="10" fill="#000000" font-weight="bold">ACTION: CORE WIGGLE TRIGGER</text>
  </svg>
);

const DrawBreakoutSVG: React.FC = () => (
  <svg viewBox="0 0 320 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FDFBF7" />
    <g transform="translate(10, -10) rotate(5 160 90)">
      <rect x="60" y="40" width="200" height="100" fill="none" stroke="#000000" strokeWidth="4" />
      <path d="M 100 90 C 110 50, 210 50, 220 90" fill="none" stroke="#000000" strokeWidth="3" strokeDasharray="4 4" />
      <path d="M 120 140 C 110 100, 210 100, 200 140" fill="none" stroke="#000000" strokeWidth="3" />
      <path d="M 160 90 C 180 50, 230 30, 260 20 C 240 50, 210 110, 160 90" fill="#FF4E00" stroke="#000000" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="230" cy="40" r="4" fill="#000000" />
    </g>
    <text x="30" y="30" font-family="monospace" font-size="10" fill="#FF4E00" font-weight="bold">VFX: 3D VOLUME ESCAPE</text>
  </svg>
);

const DrawSyncSVG: React.FC = () => (
  <svg viewBox="0 0 320 180" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#FDFBF7" />
    <circle cx="160" cy="90" r="45" fill="none" stroke="#000000" strokeWidth="5" />
    <path d="M 160 30 L 160 60 M 160 120 L 160 150 M 100 90 L 130 90 M 190 90 L 220 90" stroke="#000000" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="160" cy="90" r="15" fill="#FF4E00" stroke="#000000" strokeWidth="3" />
    <path d="M 110 40 C 130 20, 190 20, 210 40" fill="none" stroke="#FF4E00" strokeWidth="3" strokeLinecap="round" />
    <path d="M 110 140 C 130 160, 190 160, 210 140" fill="none" stroke="#FF4E00" strokeWidth="3" strokeLinecap="round" />
    <text x="30" y="30" font-family="monospace" font-size="10" fill="#000000" font-weight="bold">SYSTEM: SYNC COMPLETED</text>
  </svg>
);

/**
 * MOCK PRODUCTION DATA
 */
const mockStoryboard: Storyboard = {
  id: "storyboard-v7-1",
  title: "THE LAST LINE",
  description: "A rogue hand-drawn scribble breaks free from the limitations of the cream-paper boundaries and syncs across physical dimensions.",
  creatorId: "agent-k-9",
  aspectRatio: "16:9",
  targetFps: 24,
  version: "1.0.4",
  tags: ["Sci-Fi", "Animation", "Brutalist"],
  isArchived: false,
  createdAt: "2026-05-29T12:00:00Z",
  updatedAt: "2026-05-29T12:20:00Z",
  frames: [
    {
      id: "f-1",
      storyboardId: "storyboard-v7-1",
      sequenceNumber: 1,
      title: "The Artist's Workdesk",
      description: "Establishing wide shot. The desk is cluttered with pencils, paper grids, and a single centered orange ink blot.",
      imagePrompt: "Brutalist clean ink sketch of cluttered artist desk, cream paper backdrop, bold outlines, bright solar orange glowing spill in center",
      imageUrl: "svg-1",
      durationMs: 2400,
      isLocked: false,
      tags: ["Background", "Dialogue"],
      createdAt: "2026-05-29T12:00:00Z",
      updatedAt: "2026-05-29T12:05:00Z",
      cameraPath: {
        id: "cam-1",
        name: "Slow Dolly In",
        isLooping: false,
        durationMs: 2400,
        keyframes: [
          { id: "k-1", timeOffset: 0, position: { x: 0, y: 0, z: 10 }, rotation: { pitch: 0, yaw: 0, roll: 0 }, zoom: 1.0, interpolation: "linear" },
          { id: "k-2", timeOffset: 1, position: { x: 0, y: 0, z: 4 }, rotation: { pitch: -2, yaw: 0, roll: 0 }, zoom: 1.4, interpolation: "ease-out" }
        ]
      },
      audioTrack: {
        id: "aud-1",
        name: "Inkwell Clatter & Quill Scratch",
        url: "sounds/scratch.mp3",
        volume: 0.8,
        durationMs: 2400,
        startOffsetMs: 0,
        captionText: "NARRATOR: 'Every grand concept begins with a single, highly stubborn stroke.'",
        isSoundEffect: false
      },
      layers: [
        { id: "l-1", name: "Desk Outline Grid", type: "background", opacity: 1, isVisible: true, zIndex: 1 },
        { id: "l-2", name: "Scribble Blot", type: "scribble", opacity: 0.9, isVisible: true, zIndex: 2 }
      ]
    },
    {
      id: "f-2",
      storyboardId: "storyboard-v7-1",
      sequenceNumber: 2,
      title: "The Blot Wiggles",
      description: "Extreme close-up on the solar orange blot. It pulses, distorting its vector coordinates as if breathing.",
      imagePrompt: "Vector hand drawn drop pulsing, comic action lines, high contrast orange and black, cream background grid",
      imageUrl: "svg-2",
      durationMs: 1800,
      isLocked: true,
      tags: ["Action", "VFX"],
      createdAt: "2026-05-29T12:00:00Z",
      updatedAt: "2026-05-29T12:07:00Z",
      cameraPath: {
        id: "cam-2",
        name: "Tremor Shake",
        isLooping: true,
        durationMs: 1800,
        keyframes: [
          { id: "k-3", timeOffset: 0, position: { x: 0, y: 0, z: 2 }, rotation: { pitch: 0, yaw: 0, roll: 0 }, zoom: 2.0, interpolation: "linear" },
          { id: "k-4", timeOffset: 0.5, position: { x: 0.1, y: -0.1, z: 2.1 }, rotation: { pitch: 1, yaw: -1, roll: 2 }, zoom: 2.1, interpolation: "step" },
          { id: "k-5", timeOffset: 1, position: { x: 0, y: 0, z: 2 }, rotation: { pitch: 0, yaw: 0, roll: 0 }, zoom: 2.0, interpolation: "linear" }
        ]
      },
      audioTrack: {
        id: "aud-2",
        name: "Electric Hum Pulse",
        url: "sounds/hum.mp3",
        volume: 0.6,
        durationMs: 1800,
        startOffsetMs: 200,
        captionText: "[SOUND: High-frequency synth thrum starts to wobble]",
        isSoundEffect: true
      },
      layers: [
        { id: "l-3", name: "Pulse Vectors", type: "character", opacity: 1, isVisible: true, zIndex: 1 }
      ]
    },
    {
      id: "f-3",
      storyboardId: "storyboard-v7-1",
      sequenceNumber: 3,
      title: "3D Spatial Breakout",
      description: "The scribble breaks outside the 2D panel frame. Solid black borders twist, yielding to the dynamic solar trail.",
      imagePrompt: "Brutalist panel tear, solar orange trail slicing out of boundary, high contrast 3D volumetric paper tear",
      imageUrl: "svg-3",
      durationMs: 3000,
      isLocked: false,
      tags: ["Action", "VFX"],
      createdAt: "2026-05-29T12:00:00Z",
      updatedAt: "2026-05-29T12:12:00Z",
      cameraPath: {
        id: "cam-3",
        name: "Dynamic Whip-Pan Right",
        isLooping: false,
        durationMs: 3000,
        keyframes: [
          { id: "k-6", timeOffset: 0, position: { x: -2, y: 0, z: 5 }, rotation: { pitch: 0, yaw: -10, roll: 0 }, zoom: 1.2, interpolation: "ease-in-out" },
          { id: "k-7", timeOffset: 1, position: { x: 4, y: 1, z: 3 }, rotation: { pitch: 5, yaw: 15, roll: -4 }, zoom: 1.5, interpolation: "ease-out" }
        ]
      },
      audioTrack: {
        id: "aud-3",
        name: "Whip Swoosh sound effect",
        url: "sounds/swoosh.mp3",
        volume: 0.9,
        durationMs: 3000,
        startOffsetMs: 0,
        captionText: "NARRATOR: 'Frames are merely suggestions. Real lines refuse to be bound.'",
        isSoundEffect: false
      },
      layers: [
        { id: "l-4", name: "Border Tear", type: "background", opacity: 1, isVisible: true, zIndex: 1 },
        { id: "l-5", name: "Orange Slicer", type: "scribble", opacity: 1, isVisible: true, zIndex: 2 }
      ]
    },
    {
      id: "f-4",
      storyboardId: "storyboard-v7-1",
      sequenceNumber: 4,
      title: "Universal Cross-Sync",
      description: "The solar trail connects to the central cloud core, establishing sync across all distributed canvases.",
      imagePrompt: "Network nodes connection, massive circular loop with orange core, clean brutalist black grid lines",
      imageUrl: "svg-4",
      durationMs: 4000,
      isLocked: false,
      tags: ["Dialogue", "System"],
      createdAt: "2026-05-29T12:00:00Z",
      updatedAt: "2026-05-29T12:19:00Z",
      cameraPath: {
        id: "cam-4",
        name: "Steady Orbit Zoom Out",
        isLooping: false,
        durationMs: 4000,
        keyframes: [
          { id: "k-8", timeOffset: 0, position: { x: 0, y: 0, z: 3 }, rotation: { pitch: 0, yaw: 0, roll: 0 }, zoom: 1.8, interpolation: "ease-in" },
          { id: "k-9", timeOffset: 1, position: { x: 0, y: 0, z: 8 }, rotation: { pitch: 0, yaw: 0, roll: 0 }, zoom: 1.0, interpolation: "ease-out" }
        ]
      },
      audioTrack: {
        id: "aud-4",
        name: "Harmonic Chime Chord",
        url: "sounds/chime.mp3",
        volume: 0.7,
        durationMs: 4000,
        startOffsetMs: 1500,
        captionText: "[SOUND: Beautiful resonance chime rings out, fading cleanly]",
        isSoundEffect: true
      },
      layers: [
        { id: "l-6", name: "Sync Matrix", type: "background", opacity: 1, isVisible: true, zIndex: 1 }
      ]
    }
  ]
};

/**
 * 2. MAIN STORYBOARD WRAPPER LAYOUT COMPONENT
 */
export const StoryboardLayout: React.FC = () => {
  // Navigation & layout state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeFrameId, setActiveFrameId] = useState<string>("f-1");
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeFilterTag, setActiveFilterTag] = useState<string>("All");
  
  // Local project list state (simulating real editor storage mutations)
  const [storyboard, setStoryboard] = useState<Storyboard>(mockStoryboard);

  // Toggle Frame Lock Status
  const handleToggleLock = (frameId: string) => {
    setStoryboard(prev => ({
      ...prev,
      frames: prev.frames.map(f => {
        if (f.id === frameId) {
          return { ...f, isLocked: !f.isLocked };
        }
        return f;
      })
    }));
  };

  // Duplicate Target Frame
  const handleDuplicateFrame = (frameId: string) => {
    const target = storyboard.frames.find(f => f.id === frameId);
    if (!target) return;

    const duplicated: ActiveFrame = {
      ...target,
      id: `f-dup-${Date.now()}`,
      sequenceNumber: target.sequenceNumber + 0.5, // Temp ordering float
      title: `${target.title} (Copy)`,
      isLocked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const newFrames = [...storyboard.frames, duplicated]
      .sort((a, b) => a.sequenceNumber - b.sequenceNumber)
      .map((f, i) => ({ ...f, sequenceNumber: i + 1 })); // Recalculate indexes cleanly

    setStoryboard(prev => ({
      ...prev,
      frames: newFrames
    }));
  };

  // Delete Target Frame
  const handleDeleteFrame = (frameId: string) => {
    if (storyboard.frames.length <= 1) {
      alert("At least one frame must remain in the storyboard timeline.");
      return;
    }
    const filtered = storyboard.frames
      .filter(f => f.id !== frameId)
      .map((f, i) => ({ ...f, sequenceNumber: i + 1 }));

    setStoryboard(prev => ({ ...prev, frames: filtered }));
    if (activeFrameId === frameId) {
      setActiveFrameId(filtered[0].id);
    }
  };

  // Simulated Sync Trigger
  const handleSyncCloud = async () => {
    await new Promise(resolve => setTimeout(resolve, 800));
    console.log("ScribbleSync assets committed to NAS.");
  };

  // Tag list generation
  const allTags = ["All", ...Array.from(new Set(storyboard.frames.flatMap(f => f.tags)))];
  
  // Filtered frames list
  const filteredFrames = storyboard.frames.filter(f => 
    activeFilterTag === "All" ? true : f.tags.includes(activeFilterTag)
  );

  // Active highlighted frame object
  const activeFrame = storyboard.frames.find(f => f.id === activeFrameId) || storyboard.frames[0];

  // Map representation of inline vector components
  const renderSVGImage = (idStr: string) => {
    switch (idStr) {
      case "svg-1": return <DrawWorkspaceSVG />;
      case "svg-2": return <DrawWiggleSVG />;
      case "svg-3": return <DrawBreakoutSVG />;
      case "svg-4": return <DrawSyncSVG />;
      default: return <DrawWorkspaceSVG />;
    }
  };

  // Dynamic aspect ratio scaling utilities
  const aspectClassMap = {
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16] max-w-[280px] mx-auto',
    '1:1': 'aspect-square'
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-base,#FDFBF7)] text-[var(--color-text-primary,#000000)] font-[var(--font-body,'Plus_Jakarta_Sans')] flex flex-col selection:bg-[var(--color-primary,#FF4E00)] selection:text-black">
      
      {/* 1. TOP HEADER NAVIGATION BAR */}
      <header className="border-b-4 border-black bg-white px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50">
        
        {/* Left Side: Brand Details & Logo */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 border-2 border-black bg-[var(--color-primary,#FF4E00)] flex items-center justify-center font-[var(--font-heading,'Space_Grotesk')] font-black shadow-[2px_2px_0px_0px_#000000]">
            S
          </div>
          <div>
            <h1 className="text-xl font-black font-[var(--font-heading,'Space_Grotesk')] tracking-wider flex items-center gap-2">
              SCRIBBLESYNC
              <span className="text-xs bg-black text-[var(--color-primary,#FF4E00)] px-2 py-0.5 font-mono uppercase">V7.0.0</span>
            </h1>
            <p className="text-xs text-[var(--color-text-tertiary,#555555)] font-mono">
              Active Project: <span className="font-bold text-black uppercase">{storyboard.title}</span>
            </p>
          </div>
        </div>

        {/* Center: Global Canvas Controllers */}
        <div className="flex items-center gap-3">
          <PlayButton isPlaying={isPlaying} onToggle={() => setIsPlaying(!isPlaying)} />
          <SyncButton onSync={handleSyncCloud} />
        </div>

        {/* Right Side: Aspect / View Adjusters */}
        <div className="flex items-center gap-2 border-2 border-black p-1 bg-[var(--color-surface-base,#FDFBF7)]">
          {(['16:9', '9:16', '1:1'] as const).map(ratio => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={`
                px-3 py-1 text-xs font-mono font-bold transition-all
                ${aspectRatio === ratio 
                  ? 'bg-black text-[var(--color-primary,#FF4E00)]' 
                  : 'text-black hover:bg-gray-200'
                }
              `}
            >
              {ratio}
            </button>
          ))}
        </div>
      </header>

      {/* 2. MAIN LAYOUT GRID */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* LEFT COLUMN: ACTIVE WORKSPACE FLOW */}
        <main className="flex-1 p-6 md:p-8 space-y-6 overflow-y-auto">
          
          {/* Main Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
            <div>
              <h2 className="text-2xl font-black font-[var(--font-heading,'Space_Grotesk')]">
                STORYBOARD TIMELINE
              </h2>
              <p className="text-sm text-[var(--color-text-secondary,#1C1C1C)]">
                Chronological sequence frames. Click frame to open camera & sound layers.
              </p>
            </div>
            
            {/* Tag Filter Row */}
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveFilterTag(tag)}
                  className={`
                    px-3 py-1 text-xs font-mono font-bold border border-black shadow-[1.5px_1.5px_0px_0px_#000000]
                    active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all
                    ${activeFilterTag === tag 
                      ? 'bg-[var(--color-primary,#FF4E00)] text-black' 
                      : 'bg-white text-black hover:bg-gray-100'
                    }
                  `}
                >
                  {tag.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Storyboard Frame Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {filteredFrames.map((frame) => {
              const isSelected = frame.id === activeFrameId;
              
              return (
                <div
                  key={frame.id}
                  onClick={() => setActiveFrameId(frame.id)}
                  className={`
                    bg-white border-4 border-black transition-all flex flex-col cursor-pointer group
                    ${isSelected 
                      ? 'shadow-[8px_8px_0px_0px_#FF4E00] -translate-x-1 -translate-y-1' 
                      : 'shadow-[6px_6px_0px_0px_#000000] hover:shadow-[8px_8px_0px_0px_#000000] hover:-translate-x-0.5 hover:-translate-y-0.5'
                    }
                  `}
                >
                  {/* Frame Header */}
                  <div className="border-b-2 border-black px-4 py-2.5 bg-[#FDFBF7] flex items-center justify-between font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="bg-black text-[var(--color-primary,#FF4E00)] px-2 py-0.5 font-bold">
                        SHOT {String(frame.sequenceNumber).padStart(2, '0')}
                      </span>
                      {frame.isLocked && (
                        <span className="text-[var(--color-primary,#FF4E00)] font-bold uppercase tracking-wider flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          LOCKED
                        </span>
                      )}
                    </div>
                    <span className="text-gray-600 font-bold">{frame.durationMs / 1000}s duration</span>
                  </div>

                  {/* Frame Visual Sketch Canvas */}
                  <div className={`w-full overflow-hidden border-b-2 border-black bg-gray-50 ${aspectClassMap[aspectRatio]}`}>
                    {renderSVGImage(frame.imageUrl || '')}
                  </div>

                  {/* Frame Details Panel */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="font-black font-[var(--font-heading,'Space_Grotesk')] text-md uppercase">
                        {frame.title}
                      </h4>
                      <p className="text-xs text-[var(--color-text-secondary,#1C1C1C)] mt-1.5 line-clamp-2">
                        {frame.description}
                      </p>
                    </div>

                    {/* Dialogue block */}
                    {frame.audioTrack?.captionText && (
                      <div className="bg-[var(--color-surface-base,#FDFBF7)] border border-black p-2.5 font-mono text-[10px] text-black">
                        <span className="text-[var(--color-primary,#FF4E00)] font-bold">DIALOGUE:</span> {frame.audioTrack.captionText}
                      </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-black pt-3">
                      {/* Frame tags */}
                      <div className="flex gap-1">
                        {frame.tags.map(t => (
                          <span key={t} className="text-[9px] font-mono bg-gray-100 text-black px-1.5 py-0.5 border border-black uppercase font-bold">
                            {t}
                          </span>
                        ))}
                      </div>

                      {/* Modular Frame Action Triggers */}
                      <div className="flex items-center gap-1.5">
                        <FrameActionButton
                          actionType={frame.isLocked ? 'unlock' : 'lock'}
                          onClick={() => handleToggleLock(frame.id)}
                        />
                        <FrameActionButton
                          actionType="duplicate"
                          onClick={() => handleDuplicateFrame(frame.id)}
                        />
                        <FrameActionButton
                          actionType="delete"
                          onClick={() => handleDeleteFrame(frame.id)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* RIGHT COLUMN: INTERACTIVE EDITOR SIDEBAR */}
        <aside 
          className={`
            border-t-4 md:border-t-0 md:border-l-4 border-black bg-white transition-all duration-300 flex flex-col
            ${sidebarOpen ? 'w-full md:w-[420px]' : 'w-full md:w-16'}
          `}
        >
          {/* Sidebar Toggle Header */}
          <div className="border-b-2 border-black p-4 flex items-center justify-between bg-[#FDFBF7]">
            <h3 className={`font-black font-[var(--font-heading,'Space_Grotesk')] uppercase tracking-wider ${!sidebarOpen && 'hidden md:block md:rotate-90 md:origin-left md:absolute md:translate-x-3 md:translate-y-8'}`}>
              {sidebarOpen ? 'FRAME PROPERTIES' : 'PROPS'}
            </h3>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 hover:bg-gray-100 hidden md:block"
            >
              {sidebarOpen ? (
                // Left Arrow
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
              ) : (
                // Right Arrow
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </svg>
              )}
            </button>
          </div>

          {/* Sidebar content container */}
          {sidebarOpen ? (
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Context Block of Selected Frame */}
              <div className="border-2 border-black p-4 bg-[var(--color-surface-base,#FDFBF7)] shadow-[4px_4px_0px_0px_#000000]">
                <span className="text-[10px] font-mono font-bold bg-black text-[var(--color-primary,#FF4E00)] px-2 py-0.5 uppercase">
                  Active Editor View
                </span>
                <h3 className="text-lg font-black font-[var(--font-heading,'Space_Grotesk')] uppercase mt-2.5">
                  {activeFrame.title}
                </h3>
                <p className="text-xs text-[var(--color-text-secondary,#1C1C1C)] mt-1 font-mono">
                  ID: {activeFrame.id}
                </p>
                <div className="mt-4 pt-3 border-t border-black/10 text-xs">
                  <span className="font-bold uppercase text-[var(--color-primary,#FF4E00)]">AI PROMPT ENVELOPE:</span>
                  <p className="text-gray-700 italic mt-1 font-mono text-[11px] bg-white border border-black p-2">
                    "{activeFrame.imagePrompt}"
                  </p>
                </div>
              </div>

              {/* Camera Vector Configuration */}
              <div className="space-y-3">
                <h4 className="font-black font-[var(--font-heading,'Space_Grotesk')] text-sm uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-[#FF4E00]">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  CAMERA MOVEMENT CONTRACT
                </h4>
                
                {activeFrame.cameraPath ? (
                  <div className="border border-black p-3 bg-white space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between border-b border-gray-100 pb-1.5 font-bold">
                      <span>Path: {activeFrame.cameraPath.name}</span>
                      <span className="text-[var(--color-primary,#FF4E00)]">
                        {activeFrame.cameraPath.keyframes.length} KEYFRAMES
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {activeFrame.cameraPath.keyframes.map((kf, i) => (
                        <div key={kf.id} className="flex justify-between text-[10px] bg-gray-50 p-1 border border-black/10">
                          <span>K{i + 1} (T: {kf.timeOffset * 100}%)</span>
                          <span>X:{kf.position.x} Y:{kf.position.y} Z:{kf.position.z}</span>
                          <span className="text-[#FF4E00] uppercase font-bold">{kf.interpolation}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 font-mono italic">No camera path mapped to frame.</p>
                )}
              </div>

              {/* Synchronized Audio Track details */}
              <div className="space-y-3">
                <h4 className="font-black font-[var(--font-heading,'Space_Grotesk')] text-sm uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-[#FF4E00]">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  AUDIO SYNCRONIZATION
                </h4>

                {activeFrame.audioTrack ? (
                  <div className="border border-black p-3 bg-white space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-black uppercase truncate max-w-[200px]" title={activeFrame.audioTrack.name}>
                        {activeFrame.audioTrack.name}
                      </span>
                      <span className="bg-[var(--color-primary-subtle,rgba(255,78,0,0.1))] text-[#FF4E00] px-1.5 py-0.5 border border-[#FF4E00]/20 font-bold uppercase text-[9px]">
                        {activeFrame.audioTrack.isSoundEffect ? 'SFX' : 'VOICE'}
                      </span>
                    </div>

                    {/* Waveform Mockup */}
                    <div className="h-8 border border-black bg-[#FDFBF7] flex items-center justify-between px-2 gap-[2px]">
                      <div className="w-[4px] h-[30%] bg-black"></div>
                      <div className="w-[4px] h-[50%] bg-black"></div>
                      <div className="w-[4px] h-[80%] bg-[var(--color-primary,#FF4E00)]"></div>
                      <div className="w-[4px] h-[90%] bg-[var(--color-primary,#FF4E00)]"></div>
                      <div className="w-[4px] h-[40%] bg-black"></div>
                      <div className="w-[4px] h-[75%] bg-black"></div>
                      <div className="w-[4px] h-[60%] bg-black"></div>
                      <div className="w-[4px] h-[85%] bg-[var(--color-primary,#FF4E00)]"></div>
                      <div className="w-[4px] h-[20%] bg-black"></div>
                      <div className="w-[4px] h-[45%] bg-black"></div>
                      <div className="w-[4px] h-[70%] bg-black"></div>
                      <div className="w-[4px] h-[95%] bg-[var(--color-primary,#FF4E00)]"></div>
                      <div className="w-[4px] h-[10%] bg-black"></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Volume: {activeFrame.audioTrack.volume * 100}%</span>
                      <span>Offset: {activeFrame.audioTrack.startOffsetMs}ms</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 font-mono italic">No synchronized audio assigned.</p>
                )}
              </div>

              {/* Drawing Layers panel */}
              <div className="space-y-3">
                <h4 className="font-black font-[var(--font-heading,'Space_Grotesk')] text-sm uppercase flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-[#FF4E00]">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="3" x2="9" y2="21" />
                  </svg>
                  DRAWING LAYERS
                </h4>
                <div className="border border-black bg-white divide-y divide-black font-mono text-xs">
                  {activeFrame.layers.map(layer => (
                    <div key={layer.id} className="flex items-center justify-between p-2.5 hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={layer.isVisible} 
                          readOnly 
                          className="w-3.5 h-3.5 border-2 border-black rounded-none appearance-none checked:bg-black cursor-pointer"
                        />
                        <span className="font-bold">{layer.name}</span>
                      </div>
                      <span className="text-[10px] bg-black text-[#FDFBF7] px-1.5 font-bold uppercase">
                        {layer.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            // Collapsed view placeholder
            <div className="hidden md:flex flex-col items-center pt-8 gap-6 flex-1">
              <div className="w-2.5 h-2.5 bg-black rounded-full animate-ping"></div>
              <div className="text-[10px] font-mono tracking-widest uppercase origin-center rotate-90 translate-y-24 text-gray-400">
                PROPERTIES STACK MINIFIED
              </div>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
};

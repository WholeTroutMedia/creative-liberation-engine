import { useState, useEffect } from 'react';

/* ── Track Clip Component ── */
const TrackClip = ({ name, color, left, width }) => (
  <div
    className="absolute h-[80%] top-[10%] border rounded-sm flex items-center px-2 cursor-pointer hover:brightness-110 transition-all"
    style={{
      left: `${left}%`,
      width: `${width}%`,
      background: color + '22',
      borderColor: color + '55',
    }}
  >
    <span className="text-[9px] font-mono text-[var(--color-primary)] truncate">{name}</span>
  </div>
);

/* ── Property Row ── */
const PropRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-1.5 border-b border-[var(--color-surface-border-subtle)]">
    <span className="text-[11px] text-[var(--color-primary-muted)]">{label}</span>
    <span className="text-[11px] font-mono text-[var(--color-primary)]">{value}</span>
  </div>
);

/* ── File icon helper ── */
function mediaIcon(name) {
  if (/\.(wav|mp3|aac|flac|ogg)$/i.test(name)) return 'audio_file';
  if (/\.(png|jpg|jpeg|tiff|bmp|gif|webp)$/i.test(name)) return 'image';
  return 'movie';
}
function clipColor(name) {
  if (/\.(wav|mp3|aac|flac|ogg)$/i.test(name)) return '#4ADE80';
  if (/\.(png|jpg|jpeg|tiff|bmp|gif|webp)$/i.test(name)) return '#FFBA43';
  return '#7C8CFF';
}

export default function LinearEditorPane() {
  const [activeTab, setActiveTab] = useState('media');
  const [mediaAssets, setMediaAssets] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [selectedClip, setSelectedClip] = useState(null);
  const [timelineClips, setTimelineClips] = useState([]);

  // Tracks for the timeline — start empty, populate via drag/drop or selection
  const [tracks, setTracks] = useState([
    { id: 'V3', type: 'video', clips: [] },
    { id: 'V2', type: 'video', clips: [] },
    { id: 'V1', type: 'video', clips: [] },
    { id: 'A1', type: 'audio', clips: [] },
    { id: 'A2', type: 'audio', clips: [] },
  ]);

  /* ── Fetch real media assets from NAS ── */
  useEffect(() => {
    async function loadMedia() {
      setLoadingMedia(true);
      try {
        const res = await fetch('/api/media/assets');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setMediaAssets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[LinearEditor] Media load failed:', err);
        setMediaAssets([]);
      } finally {
        setLoadingMedia(false);
      }
    }
    loadMedia();
  }, []);

  /* ── Add clip to timeline ── */
  const addToTimeline = (asset) => {
    const isAudio = /\.(wav|mp3|aac|flac|ogg)$/i.test(asset.name);
    const trackType = isAudio ? 'audio' : 'video';
    
    setTracks(prev => {
      const newTracks = [...prev];
      // Find first matching track with room
      const targetIdx = newTracks.findIndex(t => t.type === trackType);
      if (targetIdx >= 0) {
        const existing = newTracks[targetIdx].clips;
        const lastEnd = existing.length > 0 ? Math.max(...existing.map(c => c.left + c.width)) : 0;
        const newClip = {
          name: asset.name,
          color: clipColor(asset.name),
          left: Math.min(lastEnd + 1, 90),
          width: Math.min(20, 95 - lastEnd),
        };
        newTracks[targetIdx] = { ...newTracks[targetIdx], clips: [...existing, newClip] };
      }
      return newTracks;
    });
  };

  const hasTimeline = tracks.some(t => t.clips.length > 0);

  return (
    <section className="h-full flex flex-col bg-[var(--color-surface-base)] overflow-hidden">
      {/* Top: Source Panel + Viewer + Inspector */}
      <div className="flex-[3] flex gap-[1px] bg-[var(--color-surface-border)]">

        {/* Left: Source Panel / Media Bin */}
        <div className="w-[280px] bg-[var(--color-surface-panel)] flex flex-col">
          <div className="panel-header">
            <div className="flex gap-3">
              {['media', 'effects', 'markers'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[11px] font-medium uppercase pb-0 ${activeTab === tab ? 'text-[var(--color-primary)] border-b border-[var(--color-accent)]' : 'text-[var(--color-primary-muted)]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {activeTab === 'media' && (
              <>
                {loadingMedia ? (
                  <div className="flex items-center justify-center h-32">
                    <span className="material-symbols-outlined text-[20px] animate-spin text-[var(--color-accent)]">progress_activity</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {mediaAssets.slice(0, 40).map((asset) => (
                      <div
                        key={asset.id}
                        className={`group cursor-pointer ${selectedClip?.id === asset.id ? 'ring-1 ring-[var(--color-accent)] rounded' : ''}`}
                        onClick={() => setSelectedClip(asset)}
                        onDoubleClick={() => addToTimeline(asset)}
                        title={`${asset.name} — ${asset.size}\nDouble-click to add to timeline`}
                      >
                        <div className="aspect-video bg-[var(--color-surface-base)] border border-[var(--color-surface-border)] flex items-center justify-center group-hover:border-[var(--color-primary-muted)] transition-colors relative">
                          <span className={`material-symbols-outlined text-[20px] opacity-40 ${
                            asset.type === 'video' ? 'text-[#7C8CFF]' :
                            asset.type === 'audio' ? 'text-[#4ADE80]' :
                            'text-[#FFBA43]'
                          }`}>
                            {mediaIcon(asset.name)}
                          </span>
                          {asset.duration && asset.duration !== '--:--:--' && (
                            <div className="absolute bottom-0.5 right-0.5 px-1 bg-black/70 text-[8px] font-mono text-white rounded-sm">
                              {asset.duration}
                            </div>
                          )}
                        </div>
                        <div className="text-[9px] font-mono text-[var(--color-primary-muted)] mt-1 truncate" title={asset.name}>
                          {asset.name}
                        </div>
                      </div>
                    ))}
                    {mediaAssets.length === 0 && (
                      <div className="col-span-2 text-[11px] text-[var(--color-primary-muted)] text-center py-8">
                        No media assets found on NAS
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            {activeTab === 'effects' && (
              <div className="space-y-1">
                {['Cross Dissolve', 'Dip to Black', 'Wipe Right', 'Color Correct', 'Sharpen', 'Denoise', 'Gaussian Blur', 'LUT — Rec.709'].map((fx, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 px-2 hover:bg-[var(--color-surface-hover)] cursor-pointer transition-colors">
                    <span className="material-symbols-outlined text-[14px] text-[var(--color-accent)]">auto_fix_high</span>
                    <span className="text-[11px] text-[var(--color-primary)]">{fx}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'markers' && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <span className="material-symbols-outlined text-[24px] text-[var(--color-primary-muted)] opacity-40">bookmark_border</span>
                <span className="text-[11px] text-[var(--color-primary-muted)]">No markers set</span>
                <span className="text-[10px] text-[var(--color-primary-muted)] opacity-60">Add clips to timeline first</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: Program Viewer */}
        <div className="flex-1 bg-[var(--color-surface-panel)] flex flex-col">
          <div className="panel-header">
            <div className="panel-header-title">
              <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-muted)]">smart_display</span>
              Program Monitor
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">1920×1080</span>
              <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">24fps</span>
              <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">ProRes 422</span>
            </div>
          </div>
          <div className="flex-1 p-4 flex items-center justify-center bg-[var(--color-surface-base)]">
            <div className="w-full max-w-[640px] aspect-video bg-black border border-[var(--color-surface-border)] flex flex-col items-center justify-center relative gap-2">
              {selectedClip ? (
                <>
                  <span className={`material-symbols-outlined text-[48px] opacity-30 ${
                    selectedClip.type === 'video' ? 'text-[#7C8CFF]' : 'text-[#4ADE80]'
                  }`}>
                    {mediaIcon(selectedClip.name)}
                  </span>
                  <span className="text-[var(--color-primary)] font-mono text-[12px]">{selectedClip.name}</span>
                  <span className="text-[var(--color-primary-muted)] font-mono text-[10px]">{selectedClip.size}</span>
                  <button
                    onClick={() => addToTimeline(selectedClip)}
                    className="nexus-button-primary text-[10px] px-3 py-1 mt-2"
                  >
                    Add to Timeline
                  </button>
                </>
              ) : (
                <span className="text-[var(--color-primary-muted)] font-mono text-sm">
                  {mediaAssets.length > 0 ? 'SELECT A CLIP FROM MEDIA BIN' : 'NO MEDIA LOADED'}
                </span>
              )}
              {/* Safe area overlay */}
              <div className="absolute inset-[10%] border border-dashed border-[var(--color-surface-border)] pointer-events-none" />
            </div>
          </div>
          {/* Transport Controls */}
          <div className="h-10 border-t border-[var(--color-surface-border)] flex items-center justify-center gap-1">
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">first_page</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">skip_previous</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">fast_rewind</span></button>
            <button className="nexus-button-icon bg-[var(--color-surface-elevated)] rounded mx-1"><span className="material-symbols-outlined text-[22px]">play_arrow</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">fast_forward</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">skip_next</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">last_page</span></button>
            <div className="ml-4 text-[11px] font-mono text-[var(--color-accent)]">00:00:00:00</div>
          </div>
        </div>

        {/* Right: Inspector */}
        <div className="w-[240px] bg-[var(--color-surface-panel)] flex flex-col">
          <div className="panel-header">
            <div className="panel-header-title">
              <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-muted)]">tune</span>
              Inspector
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {selectedClip ? (
              <>
                <div className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2">Selected Clip</div>
                <PropRow label="Name" value={selectedClip.name} />
                <PropRow label="Type" value={selectedClip.type} />
                <PropRow label="Size" value={selectedClip.size} />
                <PropRow label="Date" value={selectedClip.date || '--'} />
                <PropRow label="Status" value={selectedClip.status || '--'} />
                <PropRow label="Project" value={selectedClip.project || '--'} />

                <div className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 mt-4">Transform</div>
                <PropRow label="Position X" value="0.0" />
                <PropRow label="Position Y" value="0.0" />
                <PropRow label="Scale" value="100%" />
                <PropRow label="Rotation" value="0°" />
                <PropRow label="Opacity" value="100%" />

                <div className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 mt-4">Color</div>
                <PropRow label="Exposure" value="+0.0" />
                <PropRow label="Contrast" value="0" />
                <PropRow label="Saturation" value="100" />
                <PropRow label="Temperature" value="6500K" />

                {selectedClip.type === 'video' && (
                  <>
                    <div className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 mt-4">Audio</div>
                    <PropRow label="Volume" value="0 dB" />
                    <PropRow label="Pan" value="C" />
                  </>
                )}

                <div className="mt-4">
                  <div className="text-[9px] font-mono text-[var(--color-primary-muted)] break-all bg-[var(--color-surface-base)] p-2 rounded border border-[var(--color-surface-border)]">
                    {selectedClip.path}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                <span className="material-symbols-outlined text-[24px] text-[var(--color-primary-muted)]">tune</span>
                <span className="text-[10px] text-[var(--color-primary-muted)]">Select a clip to inspect</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Timeline */}
      <div className="flex-[2] bg-[var(--color-surface-panel)] flex flex-col border-t border-[var(--color-surface-border)]">
        {/* Timeline toolbar */}
        <div className="h-8 flex items-center px-3 border-b border-[var(--color-surface-border)] gap-2">
          <span className="text-[11px] font-semibold text-[var(--color-primary)] uppercase">Timeline</span>
          <div className="flex gap-1 ml-2">
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">content_cut</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">content_copy</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">content_paste</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">undo</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">redo</span></button>
          </div>
          <div className="h-4 w-[1px] bg-[var(--color-surface-border)] mx-2" />
          <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">link</span></button>
          <button className="nexus-button-icon"><span className="material-symbols-outlined text-[14px]">straighten</span></button>
          <div className="ml-auto flex items-center gap-2">
            {!hasTimeline && (
              <span className="text-[10px] text-[var(--color-primary-muted)] italic">Double-click clips in media bin to add</span>
            )}
            <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-muted)]">zoom_out</span>
            <div className="w-24 h-1 bg-[var(--color-surface-base)] rounded-full">
              <div className="w-[60%] h-full bg-[var(--color-accent)] rounded-full" />
            </div>
            <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-muted)]">zoom_in</span>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex-1 flex overflow-hidden">
          {/* Track Headers */}
          <div className="w-28 bg-[var(--color-surface-elevated)] border-r border-[var(--color-surface-border)] flex flex-col">
            {tracks.map((track) => (
              <div key={track.id} className="flex-1 border-b border-[var(--color-surface-border)] flex items-center px-2 justify-between min-h-[28px]">
                <span className="text-[10px] font-mono text-[var(--color-primary)] font-medium">{track.id}</span>
                <div className="flex gap-1">
                  <span className="material-symbols-outlined text-[11px] text-[var(--color-primary-muted)] cursor-pointer hover:text-[var(--color-primary)]">visibility</span>
                  <span className="material-symbols-outlined text-[11px] text-[var(--color-primary-muted)] cursor-pointer hover:text-[var(--color-primary)]">lock</span>
                </div>
              </div>
            ))}
          </div>

          {/* Track Lanes */}
          <div className="flex-1 relative bg-[var(--color-surface-base)] flex flex-col overflow-x-auto">
            {/* Playhead */}
            <div className="absolute top-0 bottom-0 left-[2%] w-[1px] bg-[var(--color-accent)] z-10">
              <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent border-t-[var(--color-accent)] -ml-[4px]" />
            </div>

            {/* Time ruler */}
            <div className="h-5 border-b border-[var(--color-surface-border)] flex items-end px-2 gap-[10%] min-h-[20px]">
              {['00:00', '00:15', '00:30', '00:45', '01:00', '01:15', '01:30', '01:45', '02:00'].map((t, i) => (
                <span key={i} className="text-[8px] font-mono text-[var(--color-primary-muted)]">{t}</span>
              ))}
            </div>

            {tracks.map((track) => (
              <div key={track.id} className="flex-1 border-b border-[var(--color-surface-border)] relative min-h-[28px]">
                {track.clips.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[8px] text-[var(--color-primary-muted)] opacity-30 italic">empty</span>
                  </div>
                )}
                {track.clips.map((clip, ci) => (
                  <TrackClip key={ci} {...clip} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

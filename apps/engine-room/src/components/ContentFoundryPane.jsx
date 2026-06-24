import { useState, useEffect } from 'react';

/* â”€â”€ Sub-view Components â”€â”€ */

const StudioView = () => (
  <div className="cf-view">
    <div className="cf-hero-section">
      <div className="cf-hero-icon-wrap">
        <span className="material-symbols-outlined cf-hero-icon">videocam</span>
      </div>
      <h2 className="cf-hero-title">Studio</h2>
      <p className="cf-hero-subtitle">Record, capture, and import media from any source</p>
    </div>
    <div className="cf-grid-3">
      <SourceCard icon="camera" title="FX30 Camera" desc="Sony FX30 direct capture via USB/HDMI" status="connected" />
      <SourceCard icon="desktop_windows" title="Screen Capture" desc="Record screen, window, or region" status="ready" />
      <SourceCard icon="upload_file" title="Import File" desc="Drag & drop or browse media-vault" status="ready" />
      <SourceCard icon="mic" title="Audio Only" desc="Record microphone input directly" status="ready" />
      <SourceCard icon="cloud_download" title="Remote Ingest" desc="Pull from URL, YouTube, or RSS" status="ready" />
      <SourceCard icon="cast" title="OBS Capture" desc="Receive OBS virtual camera feed" status="offline" />
    </div>
    <div className="panel mt-6">
      <div className="panel-header"><span className="panel-header-title"><span className="material-symbols-outlined text-[14px]">history</span>Recent Recordings</span></div>
      <div className="p-4 text-center text-[var(--color-primary-muted)] text-xs font-mono">No recordings yet â€” start a session above</div>
    </div>
  </div>
);

const SourceCard = ({ icon, title, desc, status }) => (
  <div className="cf-source-card">
    <div className="cf-source-card-header">
      <span className="material-symbols-outlined text-[20px] text-[var(--color-accent)]">{icon}</span>
      <span className={`status-dot ${status === 'connected' ? 'online' : status === 'ready' ? 'online' : 'inactive'}`} />
    </div>
    <div className="cf-source-card-title">{title}</div>
    <div className="cf-source-card-desc">{desc}</div>
    <div className="cf-source-card-status">{status.toUpperCase()}</div>
  </div>
);

const fmtSize = (bytes) => { if (!bytes) return 'â€”'; const u = ['B','KB','MB','GB','TB']; let i = 0; let s = bytes; while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; } return `${s.toFixed(i > 1 ? 1 : 0)} ${u[i]}`; };
const fileIcon = (item) => {
  if (item.type === 'folder') return 'folder';
  const ext = item.extension || '';
  if (['.mp4','.mov','.mkv','.avi','.mxf','.webm'].includes(ext)) return 'movie';
  if (['.mp3','.wav','.flac','.aac','.ogg','.m4a'].includes(ext)) return 'audio_file';
  if (['.jpg','.jpeg','.png','.gif','.tiff','.webp','.arw','.cr2','.nef','.dng'].includes(ext)) return 'image';
  if (['.pdf','.doc','.docx','.txt','.md'].includes(ext)) return 'description';
  if (['.json','.xml','.csv','.srt','.vtt'].includes(ext)) return 'code';
  return 'insert_drive_file';
};
const fileColor = (item) => {
  if (item.type === 'folder') return '#FACC15';
  const ext = item.extension || '';
  if (['.mp4','.mov','.mkv','.avi','.mxf','.webm'].includes(ext)) return '#BC13FE';
  if (['.mp3','.wav','.flac','.aac','.ogg','.m4a'].includes(ext)) return '#00DBE9';
  if (['.jpg','.jpeg','.png','.gif','.tiff','.webp','.arw','.cr2','.nef','.dng'].includes(ext)) return '#4ADE80';
  return 'var(--color-primary-muted)';
};

const NASBrowser = () => {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState(null);

  const navigate = (subpath) => {
    setLoading(true);
    setSelectedFile(null);
    fetch(`/api/media/browse?path=${encodeURIComponent(subpath)}`)
      .then(r => r.json())
      .then(data => { setItems(data.items || []); setCurrentPath(subpath); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { navigate(''); }, []);

  const breadcrumbs = currentPath ? currentPath.split('/') : [];

  return (
    <div className="flex gap-0 h-full overflow-hidden">
      <div className={`flex-1 flex flex-col overflow-hidden`}>
        {/* Breadcrumb bar */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--color-surface-border)] bg-black/20 text-xs font-mono">
          <button className="text-[var(--color-accent)] hover:underline cursor-pointer" onClick={() => navigate('')}>The Vault</button>
          {breadcrumbs.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="text-[var(--color-primary-muted)]">/</span>
              <button className="text-[var(--color-accent)] hover:underline cursor-pointer" onClick={() => navigate(breadcrumbs.slice(0, i + 1).join('/'))}>{seg}</button>
            </span>
          ))}
          <span className="ml-auto text-[var(--color-primary-muted)]">{items.length} items</span>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-[var(--color-primary-muted)] font-mono text-xs">Scanning NAS...</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="nexus-table">
              <thead><tr><th>Name</th><th>Size</th><th>Modified</th></tr></thead>
              <tbody>
                {currentPath && (
                  <tr className="cursor-pointer hover:bg-white/5" onClick={() => navigate(breadcrumbs.slice(0, -1).join('/'))}>
                    <td className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[#FACC15]">arrow_upward</span><span className="text-[var(--color-primary-muted)]">..</span></td>
                    <td>â€”</td><td>â€”</td>
                  </tr>
                )}
                {items.map(item => (
                  <tr key={item.path} className={`cursor-pointer transition-colors ${selectedFile?.path === item.path ? 'bg-[var(--color-accent)]/10' : 'hover:bg-white/5'}`}
                    onClick={() => item.type === 'folder' ? navigate(item.path) : setSelectedFile(item)}>
                    <td className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]" style={{ color: fileColor(item) }}>{fileIcon(item)}</span>
                      <span className="truncate max-w-[300px]">{item.name}</span>
                    </td>
                    <td className="font-mono text-xs text-[var(--color-primary-muted)]">{item.type === 'folder' ? 'â€”' : fmtSize(item.size)}</td>
                    <td className="font-mono text-xs text-[var(--color-primary-muted)] whitespace-nowrap">{item.modified ? new Date(item.modified).toLocaleDateString() : 'â€”'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selectedFile && (
        <div className="w-[300px] flex-shrink-0 border-l border-[var(--color-surface-border)] bg-[var(--color-surface-panel)] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
            <span className="font-semibold text-sm text-[var(--color-primary)]">File Info</span>
            <button className="nexus-button-icon" onClick={() => setSelectedFile(null)}><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="h-28 bg-black/40 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-[40px]" style={{ color: fileColor(selectedFile) }}>{fileIcon(selectedFile)}</span>
            </div>
            <h3 className="font-semibold text-[var(--color-primary)] break-all text-sm">{selectedFile.name}</h3>
            <div className="space-y-2 text-xs">
              {[['Extension', selectedFile.extension || 'â€”'], ['Size', fmtSize(selectedFile.size)], ['Modified', selectedFile.modified ? new Date(selectedFile.modified).toLocaleString() : 'â€”']].map(([k,v]) => (
                <div key={k} className="flex justify-between"><span className="text-[var(--color-primary-muted)]">{k}</span><span className="font-mono text-[var(--color-primary)]">{v}</span></div>
              ))}
            </div>
            <div className="pt-2 border-t border-[var(--color-surface-border)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-primary-muted)] mb-1">Full Path</div>
              <div className="text-[11px] font-mono text-[var(--color-primary)] break-all bg-black/20 p-2 rounded">/vault/{selectedFile.path}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LibraryView = () => {
  const [libraryMode, setLibraryMode] = useState('assets');
  const [viewMode, setViewMode] = useState('list');
  const [allAssets, setAllAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/media/assets')
      .then(r => r.json())
      .then(data => { setAllAssets(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Derive unique projects from path data
  const projects = [...new Set(allAssets.map(a => a.project || 'Unknown'))].sort();
  const types = [...new Set(allAssets.map(a => a.type))].sort();
  const statuses = [...new Set(allAssets.map(a => a.status))].sort();

  // Filter + search
  const filtered = allAssets.filter(a => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.path || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (projectFilter !== 'all' && (a.project || 'Unknown') !== projectFilter) return false;
    return true;
  });

  // Sort
  const parseSize = (s) => { const m = (s||'').match(/([\d.]+)\s*(GB|MB|KB)/i); if (!m) return 0; return parseFloat(m[1]) * (m[2].toUpperCase() === 'GB' ? 1024 : m[2].toUpperCase() === 'KB' ? 0.001 : 1); };
  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortBy === 'date') cmp = (a.date || '').localeCompare(b.date || '');
    else if (sortBy === 'size') cmp = parseSize(a.size) - parseSize(b.size);
    else if (sortBy === 'type') cmp = (a.type || '').localeCompare(b.type || '');
    return sortDir === 'desc' ? -cmp : cmp;
  });

  const toggleSort = (col) => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('asc'); } };
  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? 'â†‘' : 'â†“') : '';

  // Derive folder path from asset path
  const folderOf = (a) => { const p = a.path || ''; const parts = p.split('/'); return parts.slice(0, -1).join('/') || 'â€”'; };

  const renderAssetsList = () => {
    if (loading) {
      return <div className="flex-1 flex items-center justify-center text-[var(--color-primary-muted)] font-mono text-xs">Loading assets from NAS...</div>;
    }
    if (viewMode === 'list') {
      return (
        <div className="flex-1 overflow-auto">
          <table className="nexus-table">
            <thead><tr>
              <th className="cursor-pointer select-none" onClick={() => toggleSort('name')}>Name {sortIcon('name')}</th>
              <th className="cursor-pointer select-none" onClick={() => toggleSort('type')}>Type {sortIcon('type')}</th>
              <th>Duration</th>
              <th className="cursor-pointer select-none" onClick={() => toggleSort('size')}>Size {sortIcon('size')}</th>
              <th>Status</th>
              <th className="cursor-pointer select-none" onClick={() => toggleSort('date')}>Date {sortIcon('date')}</th>
              <th>Project</th>
            </tr></thead>
            <tbody>{sorted.length === 0 ? <tr><td colSpan="7" className="text-center text-[var(--color-primary-muted)] text-xs font-mono py-4">No assets match filters</td></tr> : sorted.map(a => (
              <tr key={a.id} className={`cursor-pointer ${selected?.id === a.id ? 'bg-[var(--color-accent)]/10' : ''}`} onClick={() => setSelected(a)}>
                <td className="flex items-center gap-2"><span className="material-symbols-outlined text-[16px] text-[var(--color-accent)]">{a.type === 'video' ? 'movie' : 'audio_file'}</span><span className="truncate max-w-[200px]">{a.name}</span></td>
                <td><span className="nexus-chip">{a.type}</span></td>
                <td className="font-mono text-xs">{a.duration}</td>
                <td className="text-[var(--color-primary-muted)]">{a.size}</td>
                <td><span className={`nexus-chip ${a.status === 'transcribed' ? 'accent' : a.status === 'edited' ? 'success' : a.status === 'processing' ? 'warning' : ''}`}>{a.status}</span></td>
                <td className="text-[var(--color-primary-muted)] whitespace-nowrap">{a.date}</td>
                <td className="text-[var(--color-primary-muted)] text-xs">{a.project || 'â€”'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      );
    }
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="cf-grid-4">{sorted.length === 0 ? <div className="col-span-4 text-center text-[var(--color-primary-muted)] text-xs font-mono py-4">No assets match filters</div> : sorted.map(a => (
          <div key={a.id} className={`cf-asset-card ${selected?.id === a.id ? 'ring-1 ring-[var(--color-accent)]' : ''}`} onClick={() => setSelected(a)} style={{ cursor: 'pointer' }}>
            <div className="cf-asset-thumb"><span className="material-symbols-outlined text-[32px] text-[var(--color-primary-muted)]">{a.type === 'video' ? 'movie' : 'audio_file'}</span></div>
            <div className="cf-asset-info">
              <div className="cf-asset-name">{a.name}</div>
              <div className="cf-asset-meta">{a.duration} Â· {a.size}</div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`nexus-chip ${a.status === 'transcribed' ? 'accent' : a.status === 'edited' ? 'success' : a.status === 'processing' ? 'warning' : ''}`}>{a.status}</span>
                <span className="text-[9px] text-[var(--color-primary-muted)]">{a.project}</span>
              </div>
            </div>
          </div>
        ))}</div>
      </div>
    );
  };

  const renderDetailPanel = () => {
    if (!selected) return null;
    return (
      <div className="w-[340px] flex-shrink-0 border-l border-[var(--color-surface-border)] bg-[var(--color-surface-panel)] flex flex-col overflow-hidden">
        <div className="p-4 border-b border-[var(--color-surface-border)] flex justify-between items-center">
          <span className="font-semibold text-sm text-[var(--color-primary)]">Asset Details</span>
          <button className="nexus-button-icon" onClick={() => setSelected(null)}><span className="material-symbols-outlined text-[16px]">close</span></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="h-40 bg-black/40 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-[48px] text-[var(--color-primary-muted)]">{selected.type === 'video' ? 'movie' : 'audio_file'}</span>
          </div>
          <h3 className="font-semibold text-[var(--color-primary)] break-all">{selected.name}</h3>
          <div className="space-y-2 text-xs">
            {[['Type', selected.type], ['Size', selected.size], ['Duration', selected.duration], ['Date', selected.date], ['Status', selected.status], ['Project', selected.project || 'â€”']].map(([k,v]) => (
              <div key={k} className="flex justify-between"><span className="text-[var(--color-primary-muted)]">{k}</span><span className="font-mono text-[var(--color-primary)]">{v}</span></div>
            ))}
          </div>
          <div className="pt-2 border-t border-[var(--color-surface-border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-primary-muted)] mb-1">NAS Path</div>
            <div className="text-[11px] font-mono text-[var(--color-primary)] break-all bg-black/20 p-2 rounded">{selected.path || 'â€”'}</div>
          </div>
          <div className="pt-2 border-t border-[var(--color-surface-border)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-primary-muted)] mb-1">Folder</div>
            <div className="text-[11px] font-mono text-[var(--color-primary)] break-all">{folderOf(selected)}</div>
          </div>
          <div className="flex gap-2 pt-3">
            <button className="nexus-button-primary flex-1 text-xs"><span className="material-symbols-outlined text-[14px]">edit_note</span>Edit</button>
            <button className="nexus-button-secondary flex-1 text-xs"><span className="material-symbols-outlined text-[14px]">auto_awesome</span>Transcribe</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="cf-view flex flex-col gap-0 h-full overflow-hidden">
      {/* Mode toggle + filters toolbar */}
      <div className="cf-toolbar" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5">
            <button className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${libraryMode === 'assets' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-primary-muted)] hover:text-[var(--color-primary)]'}`} onClick={() => setLibraryMode('assets')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">video_library</span>Asset Registry
            </button>
            <button className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${libraryMode === 'browse' ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' : 'text-[var(--color-primary-muted)] hover:text-[var(--color-primary)]'}`} onClick={() => setLibraryMode('browse')}>
              <span className="material-symbols-outlined text-[14px] align-middle mr-1">folder_open</span>NAS Browser
            </button>
          </div>
          {libraryMode === 'assets' && (
            <>
              <input className="nexus-input" placeholder="Search name or path..." style={{ maxWidth: 240 }} value={search} onChange={e => setSearch(e.target.value)} />
              <select className="nexus-select" style={{ width: 120 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">All Types</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="nexus-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select className="nexus-select" style={{ width: 160 }} value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
                <option value="all">All Projects</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">{sorted.length}/{allAssets.length}</span>
            </>
          )}
        </div>
        {libraryMode === 'assets' && (
          <div className="flex items-center gap-2">
            <button className={`nexus-button-icon ${viewMode === 'grid' ? 'text-[var(--color-accent)]' : ''}`} onClick={() => setViewMode('grid')}><span className="material-symbols-outlined text-[18px]">grid_view</span></button>
            <button className={`nexus-button-icon ${viewMode === 'list' ? 'text-[var(--color-accent)]' : ''}`} onClick={() => setViewMode('list')}><span className="material-symbols-outlined text-[18px]">view_list</span></button>
          </div>
        )}
      </div>

      {/* Content area */}
      {libraryMode === 'browse' ? (
        <NASBrowser />
      ) : (
        <div className="flex gap-0 flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderAssetsList()}
          </div>
          {renderDetailPanel()}
        </div>
      )}
    </div>
  );
};

const EditorView = () => {
  const [transcript, setTranscript] = useState([]);
  const [origTranscript, setOrigTranscript] = useState([]);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [showFillers, setShowFillers] = useState(true);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch('/api/media/transcripts').then(r => r.json()).then(data => { setTranscript(data); setOrigTranscript(JSON.parse(JSON.stringify(data))); }).catch(() => {});
    fetch('/api/media/assets').then(r => r.json()).then(data => setAssets(Array.isArray(data) ? data.slice(0, 8) : [])).catch(() => {});
  }, []);

  const handleTextEdit = (id, newText) => {
    setTranscript(prev => prev.map(s => s.id === id ? { ...s, text: newText } : s));
    setDirty(true);
    setSaved(false);
  };

  const handleDiscard = () => {
    setTranscript(JSON.parse(JSON.stringify(origTranscript)));
    setDirty(false); setSaved(false);
  };

  const handleSave = () => {
    setSaved(false);
    fetch('/api/media/transcripts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(transcript) })
      .then(() => { setSaved(true); setDirty(false); setOrigTranscript(JSON.parse(JSON.stringify(transcript))); setTimeout(() => setSaved(false), 2000); })
      .catch(() => alert('Save failed â€” check NAS connection'));
  };

  const handleExportVTT = () => {
    let vtt = 'WEBVTT\n\n';
    transcript.forEach((seg, i) => {
      vtt += `${i + 1}\n${seg.start}.000 --> ${seg.end}.000\n${seg.text}\n\n`;
    });
    const blob = new Blob([vtt], { type: 'text/vtt' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `transcript_${Date.now()}.vtt`; a.click();
  };

  return (
    <div className="cf-view relative flex flex-col h-full">
      <div className="cf-toolbar mb-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[18px] text-[var(--color-accent)]">edit_document</span>
          <span className="font-semibold text-sm">Transcript Editor</span>
          {dirty && <span className="nexus-chip warning text-[9px]">UNSAVED</span>}
          {saved && <span className="nexus-chip success text-[9px]">SAVED âœ“</span>}
        </div>
        <div className="flex gap-2">
          <button className="nexus-button-secondary text-xs" onClick={() => setShowFillers(f => !f)}>
            <span className="material-symbols-outlined text-[14px]">{showFillers ? 'visibility' : 'visibility_off'}</span>{showFillers ? 'Hide' : 'Show'} Fillers
          </button>
          <button className="nexus-button-secondary text-xs" onClick={handleExportVTT} disabled={transcript.length === 0}>
            <span className="material-symbols-outlined text-[14px]">download</span>Export VTT
          </button>
          <button className="nexus-button-secondary text-xs" onClick={handleDiscard} disabled={!dirty}>
            <span className="material-symbols-outlined text-[14px]">undo</span>Discard
          </button>
          <button className="nexus-button-primary text-xs" onClick={handleSave} disabled={!dirty}>
            <span className="material-symbols-outlined text-[14px]">save</span>Save
          </button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Asset sidebar */}
        <div className="w-[240px] flex-shrink-0 panel flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--color-surface-border)] text-xs font-semibold text-[var(--color-primary-muted)] uppercase tracking-wider">Assets ({assets.length})</div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {assets.map(a => (
              <div key={a.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer text-xs transition-colors ${selectedAsset?.id === a.id ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30' : 'hover:bg-white/5 border border-transparent'}`} onClick={() => setSelectedAsset(a)}>
                <span className="material-symbols-outlined text-[14px] text-[var(--color-accent)]">{a.type === 'video' ? 'movie' : 'audio_file'}</span>
                <span className="truncate text-[var(--color-primary)]">{a.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transcript panel */}
        <div className="flex-1 panel flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--color-surface-border)] flex justify-between items-center">
            <span className="font-semibold text-sm text-[#BC13FE]">Transcript ({transcript.length} segments)</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            {transcript.length === 0 ? <div className="text-center text-[var(--color-primary-muted)] text-xs font-mono py-8">No transcript loaded</div> : transcript.map(seg => (
              <div key={seg.id} className={`flex gap-3 p-2 rounded-lg border border-transparent hover:bg-white/5 hover:border-white/10 transition-all ${seg.filler && showFillers ? 'bg-yellow-500/5 border-yellow-500/20' : ''}`}>
                <div className="text-[#BC13FE] font-mono text-[10px] pt-1 w-16 flex-shrink-0">{seg.start}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--color-primary-muted)] mb-0.5">{seg.speaker}</div>
                  <div className="text-sm text-[var(--color-on-surface)] leading-relaxed outline-none focus:bg-white/5 focus:ring-1 focus:ring-[#BC13FE]/30 p-1 -ml-1 rounded transition-colors" contentEditable suppressContentEditableWarning onBlur={e => handleTextEdit(seg.id, e.target.textContent)}>{seg.text}</div>
                </div>
                {seg.filler && showFillers && <span className="nexus-chip warning text-[8px] self-start mt-1">FILLER</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ClipsView = () => (
  <div className="cf-view">
    <div className="cf-hero-section">
      <div className="cf-hero-icon-wrap"><span className="material-symbols-outlined cf-hero-icon">auto_awesome</span></div>
      <h2 className="cf-hero-title">Magic Clips</h2>
      <p className="cf-hero-subtitle">AI-detected highlights and social-ready clip extraction</p>
    </div>
    <div className="cf-grid-3">
      {['Vertical 9:16 (Reels/TikTok)', 'Square 1:1 (Instagram)', 'Horizontal 16:9 (YouTube)'].map((fmt, i) => (
        <div key={i} className="cf-source-card">
          <span className="material-symbols-outlined text-[24px] text-[var(--color-accent)]">{['smartphone', 'crop_square', 'crop_16_9'][i]}</span>
          <div className="cf-source-card-title">{fmt}</div>
          <div className="cf-source-card-desc">Auto-format and export clips</div>
        </div>
      ))}
    </div>
    <div className="panel mt-6"><div className="panel-header"><span className="panel-header-title"><span className="material-symbols-outlined text-[14px]">movie_filter</span>Generated Clips</span></div>
      <div className="p-4 text-center text-[var(--color-primary-muted)] text-xs font-mono">Select a transcript segment and click "Create Clip" to generate</div>
    </div>
  </div>
);

const AnalyticsView = () => {
  const [assets, setAssets] = useState([]);
  useEffect(() => { fetch('/api/media/assets').then(r => r.json()).then(d => setAssets(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const totalAssets = assets.length;
  const videoCount = assets.filter(a => a.type === 'video').length;
  const audioCount = assets.filter(a => a.type === 'audio').length;
  const transcribed = assets.filter(a => a.status === 'transcribed' || a.status === 'edited').length;
  const projects = [...new Set(assets.map(a => a.project || 'Unknown'))];
  const byProject = projects.map(p => ({ name: p, count: assets.filter(a => (a.project || 'Unknown') === p).length })).sort((a,b) => b.count - a.count);
  const byStatus = ['raw','processing','transcribed','edited'].map(s => ({ status: s, count: assets.filter(a => a.status === s).length }));

  return (
    <div className="cf-view">
      <div className="cf-grid-4">
        <div className="metric-card"><div className="metric-label">Total Assets</div><div className="metric-value">{totalAssets}</div><div className="metric-sub">{videoCount} video Â· {audioCount} audio</div></div>
        <div className="metric-card"><div className="metric-label">Transcribed</div><div className="metric-value">{transcribed}</div><div className="metric-sub">{totalAssets > 0 ? Math.round((transcribed/totalAssets)*100) : 0}% coverage</div></div>
        <div className="metric-card"><div className="metric-label">Projects</div><div className="metric-value">{projects.length}</div><div className="metric-sub">active project folders</div></div>
        <div className="metric-card"><div className="metric-label">Raw Pending</div><div className="metric-value">{assets.filter(a => a.status === 'raw').length}</div><div className="metric-sub">awaiting processing</div></div>
      </div>
      <div className="cf-grid-2 mt-6">
        <div className="panel"><div className="panel-header"><span className="panel-header-title"><span className="material-symbols-outlined text-[14px]">folder</span>By Project</span></div>
          <div className="p-4 space-y-2">{byProject.map(p => (
            <div key={p.name} className="flex justify-between items-center text-xs">
              <span className="text-[var(--color-primary)]">{p.name}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-[var(--color-surface-border)] rounded-full overflow-hidden"><div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${(p.count / totalAssets) * 100}%` }} /></div>
                <span className="font-mono text-[var(--color-primary-muted)] w-8 text-right">{p.count}</span>
              </div>
            </div>
          ))}</div>
        </div>
        <div className="panel"><div className="panel-header"><span className="panel-header-title"><span className="material-symbols-outlined text-[14px]">trending_up</span>By Status</span></div>
          <div className="p-4 space-y-2">{byStatus.map(s => (
            <div key={s.status} className="flex justify-between items-center text-xs">
              <span className={`nexus-chip ${s.status === 'transcribed' ? 'accent' : s.status === 'edited' ? 'success' : s.status === 'processing' ? 'warning' : ''}`}>{s.status}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-[var(--color-surface-border)] rounded-full overflow-hidden"><div className="h-full bg-[var(--color-accent)] rounded-full" style={{ width: `${totalAssets ? (s.count / totalAssets) * 100 : 0}%` }} /></div>
                <span className="font-mono text-[var(--color-primary-muted)] w-8 text-right">{s.count}</span>
              </div>
            </div>
          ))}</div>
        </div>
      </div>
    </div>
  );
};

const PublishView = () => {
  const [data, setData] = useState(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetch('/api/media/publish')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(e => console.error(e));
  }, []);

  const handlePublish = () => {
    if (!data) return;
    setPublishing(true);
    fetch('/api/media/publish/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data.metadata)
    })
      .then(r => r.json())
      .then(() => {
        setTimeout(() => setPublishing(false), 1500); // Simulate network delay
      })
      .catch(e => {
        console.error(e);
        setPublishing(false);
      });
  };

  const toggleChannel = (id) => {
    setData(prev => ({
      ...prev,
      channels: prev.channels.map(c => c.id === id ? { ...c, active: !c.active } : c)
    }));
  };

  if (!data) return <div className="cf-view p-8 text-center font-mono text-[var(--color-primary-muted)]">Loading publish data...</div>;

  const activeChannelsCount = data.channels.filter(c => c.active).length;

  return (
    <div className="cf-view relative pb-32">
      <div className="cf-hero-section">
        <div className="cf-hero-icon-wrap"><span className="material-symbols-outlined cf-hero-icon">publish</span></div>
        <h2 className="cf-hero-title">Publish & Distribute</h2>
        <p className="cf-hero-subtitle">Multi-destination publishing to all platforms</p>
      </div>

      <div className="grid grid-cols-12 gap-5 mt-6">
        {/* Rendering Pipeline */}
        <section className="col-span-12 lg:col-span-8 panel p-6 space-y-6 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg text-[var(--color-primary)] flex items-center gap-2">
              Rendering Pipeline
            </h3>
            <span className="material-symbols-outlined text-[var(--color-primary-muted)]">pending_actions</span>
          </div>
          <div className="space-y-4">
            {data.pipelines.map(pipeline => (
              <div key={pipeline.id} className="p-4 rounded-lg bg-[var(--color-surface-container-low)] border border-white/5 space-y-2">
                <div className="flex justify-between items-end">
                  <div>
                    <div className="font-bold text-[var(--color-on-surface)]">{pipeline.name}</div>
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)] mt-1">{pipeline.specs}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--color-primary-muted)] font-mono text-xs">ETA: {pipeline.eta}</div>
                    <div className="text-[var(--color-on-surface)] font-semibold text-lg">{pipeline.progress}%</div>
                  </div>
                </div>
                <div className="w-full h-1 bg-[var(--color-surface-variant)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--color-primary-fixed-dim)] shadow-[0_0_10px_var(--color-primary-fixed-dim)]" style={{ width: `${pipeline.progress}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Metadata Panel */}
        <section className="col-span-12 lg:col-span-4 panel p-6 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-lg text-[#BC13FE]">Metadata Panel</h3>
            <span className="material-symbols-outlined text-[#BC13FE]/50">auto_awesome</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">TITLE</label>
              <div className="p-3 rounded bg-[#050505] border border-[#BC13FE]/30 text-sm">
                {data.metadata.title}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">DESCRIPTION</label>
              <div className="p-3 rounded bg-[#050505] border border-[#BC13FE]/30 text-sm h-32 overflow-y-auto leading-relaxed">
                {data.metadata.description}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-widest text-[var(--color-on-surface-variant)]">TAGS</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.metadata.tags.map(tag => (
                  <span key={tag} className="px-2 py-1 bg-[#BC13FE]/10 border border-[#BC13FE]/30 rounded text-[#BC13FE] text-xs">{tag}</span>
                ))}
                <span className="px-2 py-1 bg-[var(--color-surface-variant)] border border-white/10 rounded text-[var(--color-on-surface-variant)] text-xs cursor-pointer hover:bg-white/10 transition-colors">+ Add Tag</span>
              </div>
            </div>
          </div>
        </section>

        {/* Distribution Channels */}
        <section className="col-span-12 panel p-6 mb-24">
          <h3 className="font-semibold text-lg text-[var(--color-on-surface)] mb-4">Distribution Channels</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {data.channels.map(channel => (
              <DistributionCard 
                key={channel.id}
                {...channel}
                onToggle={() => toggleChannel(channel.id)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Global CTA Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-24 panel border-t border-white/10 flex items-center justify-between px-8 bg-black/80 backdrop-blur-xl rounded-b-xl z-40">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest mb-1">ESTIMATED TOTAL UPLOAD</span>
            <span className="text-[var(--color-primary)] font-bold text-lg">{data.stats.totalUpload}</span>
          </div>
          <div className="h-8 w-px bg-white/10"></div>
          <div className="flex flex-col">
            <span className="text-[var(--color-on-surface-variant)] text-[10px] uppercase tracking-widest mb-1">TARGET NETWORKS</span>
            <span className="text-[var(--color-primary)] font-bold text-lg">{activeChannelsCount} ACTIVE</span>
          </div>
        </div>
        <button 
          onClick={handlePublish}
          disabled={publishing || activeChannelsCount === 0}
          className={`nexus-button-primary flex items-center gap-2 px-8 py-4 text-sm font-bold shadow-[0_0_20px_rgba(0,219,233,0.3)] transition-transform uppercase tracking-wider ${publishing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {publishing ? 'sync' : 'rocket_launch'}
          </span>
          {publishing ? 'Initiating...' : 'Initiate Publish Sequence'}
        </button>
      </div>
    </div>
  );
};

const DistributionCard = ({ icon, name, desc, color, bg, active, onToggle }) => {
  return (
    <div className={`p-4 rounded-lg bg-[var(--color-surface-container-high)] border flex flex-col items-center gap-4 transition-colors ${active ? 'border-[var(--color-primary-fixed-dim)] shadow-[0_0_15px_rgba(0,219,233,0.1)]' : 'border-white/5 hover:border-[var(--color-primary-fixed-dim)]/40'}`}>
      <div className={`w-12 h-12 flex items-center justify-center rounded-full ${bg} ${color}`}>
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <div className="text-center">
        <div className="font-bold text-sm text-[var(--color-on-surface)]">{name}</div>
        <div className="text-xs text-[var(--color-on-surface-variant)] mt-1">{desc}</div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer mt-2">
        <input type="checkbox" className="sr-only peer" checked={active} onChange={onToggle} />
        <div className="w-11 h-6 bg-[var(--color-surface-variant)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary-fixed-dim)] peer-checked:shadow-[0_0_10px_rgba(0,219,233,0.6)]"></div>
      </label>
    </div>
  );
};

const SettingsView = () => {
  const [lang, setLang] = useState(() => localStorage.getItem('cf-lang') || 'English');
  const [model, setModel] = useState(() => localStorage.getItem('cf-model') || 'large-v3');
  const [autoTranscribe, setAutoTranscribe] = useState(() => localStorage.getItem('cf-auto') === 'true');
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem('cf-lang', lang);
    localStorage.setItem('cf-model', model);
    localStorage.setItem('cf-auto', autoTranscribe);
    setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="cf-view" style={{ maxWidth: 640 }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-primary-muted)]">Content Foundry Settings</h3>
        {saved && <span className="nexus-chip success text-[9px]">SAVED âœ“</span>}
      </div>
      <div className="space-y-4">
        <div className="panel p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-muted)]">Default Language</label>
          <select className="nexus-select mt-2" value={lang} onChange={e => setLang(e.target.value)}>
            {['English','Spanish','French','Mandarin','Arabic','Hindi','Portuguese','Japanese','Korean','German'].map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="panel p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-muted)]">Media Vault Path</label>
          <input className="nexus-input mt-2" value="//127.0.0.1/The Vault/RAW Backups/" readOnly />
          <div className="text-[10px] text-[var(--color-primary-muted)] mt-1 font-mono">NAS-resident Â· read-only</div>
        </div>
        <div className="panel p-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-muted)]">Whisper Model</label>
          <select className="nexus-select mt-2" value={model} onChange={e => setModel(e.target.value)}>
            {['large-v3','large-v3-turbo','medium','small','base'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="panel p-4 flex justify-between items-center">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-muted)]">Auto-Transcribe on Import</label>
            <div className="text-[10px] text-[var(--color-primary-muted)] mt-1">Automatically queue Whisper transcription when new media is imported</div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={autoTranscribe} onChange={e => setAutoTranscribe(e.target.checked)} />
            <div className="w-11 h-6 bg-[var(--color-surface-variant)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-accent)]" />
          </label>
        </div>
        <button className="nexus-button-primary w-full" onClick={save}><span className="material-symbols-outlined text-[14px]">save</span>Save Settings</button>
      </div>
    </div>
  );
};

/* â”€â”€ Sub-navigation tabs â”€â”€ */
const CF_TABS = [
  { id: 'studio', icon: 'videocam', label: 'Studio' },
  { id: 'library', icon: 'video_library', label: 'Library' },
  { id: 'editor', icon: 'edit_note', label: 'Editor' },
  { id: 'clips', icon: 'auto_awesome', label: 'Clips' },
  { id: 'analytics', icon: 'analytics', label: 'Analytics' },
  { id: 'publish', icon: 'publish', label: 'Publish' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

/* â”€â”€ Main Content Foundry Pane â”€â”€ */
export default function ContentFoundryPane() {
  const [activeTab, setActiveTab] = useState('studio');

  const renderView = () => {
    switch (activeTab) {
      case 'studio': return <StudioView />;
      case 'library': return <LibraryView />;
      case 'editor': return <EditorView />;
      case 'clips': return <ClipsView />;
      case 'analytics': return <AnalyticsView />;
      case 'publish': return <PublishView />;
      case 'settings': return <SettingsView />;
      default: return null;
    }
  };

  return (
    <div className="cf-root">
      {/* Internal Tab Bar */}
      <div className="cf-tabbar">
        <div className="cf-tabbar-left">
          <span className="material-symbols-outlined text-[18px] text-[var(--color-accent)]">movie_edit</span>
          <span className="cf-brand">Content Foundry</span>
        </div>
        <div className="cf-tabs">
          {CF_TABS.map(tab => (
            <button
              key={tab.id}
              className={`cf-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Content */}
      <div className="cf-content">
        {renderView()}
      </div>
    </div>
  );
}

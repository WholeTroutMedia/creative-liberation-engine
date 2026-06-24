import { useState, useEffect, useMemo } from 'react';

/* ── Icon resolver ── */
function fileIcon(type, name) {
  if (type === 'folder') return 'folder';
  if (type === 'video' || /\.(mp4|mov|mxf|avi|mkv|webm)$/i.test(name)) return 'movie';
  if (type === 'audio' || /\.(wav|mp3|aac|flac|ogg)$/i.test(name)) return 'audio_file';
  if (type === 'image' || /\.(png|jpg|jpeg|tiff|bmp|gif|webp|raw|arw|cr2|cr3)$/i.test(name)) return 'image';
  if (/\.(pdf|doc|docx|txt|md)$/i.test(name)) return 'description';
  if (/\.(zip|tar|gz|rar|7z)$/i.test(name)) return 'folder_zip';
  return 'insert_drive_file';
}

function getFileTypeCategory(name, isFolder) {
  if (isFolder) return 'folder';
  if (/\.(mp4|mov|mxf|avi|mkv|webm)$/i.test(name)) return 'video';
  if (/\.(wav|mp3|aac|flac|ogg)$/i.test(name)) return 'audio';
  if (/\.(png|jpg|jpeg|tiff|bmp|gif|webp|raw|arw|cr2|cr3)$/i.test(name)) return 'image';
  return 'file';
}

/* ── File extension â†’ readable type ── */
function readableType(name, type) {
  if (type === 'folder') return 'FOLDER';
  const ext = name.split('.').pop()?.toUpperCase() || '';
  return ext;
}

/* ── Format size ── */
function formatSize(sizeInBytes) {
  if (sizeInBytes === undefined || sizeInBytes === null || sizeInBytes === '--') return '--';
  const size = Number(sizeInBytes);
  if (isNaN(size)) return sizeInBytes;
  if (size === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/* ── Format path into breadcrumb ── */
function pathBreadcrumb(filePath) {
  if (!filePath) return '/';
  return '/' + filePath.replace(/^\/+/, '');
}

export default function AssetsPane() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [currentPath, setCurrentPath] = useState('');

  /* ── Fetch real assets from NAS mcp-hub ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/media/browse?path=${encodeURIComponent(currentPath)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setAssets(Array.isArray(data.items) ? data.items : []);
        if (!cancelled) setSelected(null);
      } catch (err) {
        console.error('[AssetsPane] Fetch failed:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [currentPath]);

  /* ── Derived: filtered + sorted ── */
  const filtered = useMemo(() => {
    let list = [...assets];

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter(a => {
        if (a.type === 'folder') return false; 
        return getFileTypeCategory(a.name, false) === typeFilter;
      });
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.path?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      // Folders always first when sorting by name/type
      if ((sortBy === 'name' || sortBy === 'type') && a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      
      let va = a[sortBy] || '';
      let vb = b[sortBy] || '';
      if (sortBy === 'size') {
        va = a.size || 0;
        vb = b.size || 0;
      } else if (sortBy === 'date') {
        va = a.modified || '';
        vb = b.modified || '';
      }
      
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [assets, typeFilter, search, sortBy, sortDir]);

  /* ── Counts by type ── */
  const counts = useMemo(() => {
    const c = { all: assets.length, video: 0, image: 0, audio: 0 };
    assets.forEach(a => { 
      const cat = getFileTypeCategory(a.name, a.type === 'folder');
      if (c[cat] !== undefined) c[cat]++; 
    });
    return c;
  }, [assets]);

  const toggleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };
  
  const handleNavigate = (item) => {
    if (item.type === 'folder') {
      setCurrentPath(item.path);
    } else {
      setSelected(selected?.path === item.path ? null : item);
    }
  };

  const handleNavigateUp = () => {
    if (!currentPath || currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  return (
    <section className="h-full flex flex-col bg-[var(--color-surface-base)] overflow-hidden">
      {/* ── Header Bar ── */}
      <header className="h-14 bg-[var(--color-surface-panel)] border-b border-[var(--color-surface-border)] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[13px] font-semibold text-[var(--color-primary)]">
            Media Assets
          </span>
          <div className="h-4 w-[1px] bg-[var(--color-surface-border)]" />

          {/* Type Filter Tabs */}
          <div className="flex gap-1">
            {[
              { key: 'all', label: 'All Files' },
              { key: 'video', label: 'Video' },
              { key: 'image', label: 'Images' },
              { key: 'audio', label: 'Audio' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => { setTypeFilter(f.key); setSelected(null); }}
                className={`px-2.5 py-1 rounded text-[11px] transition-colors cursor-pointer ${
                  typeFilter === f.key
                    ? 'bg-[var(--color-surface-hover)] text-[var(--color-primary)] border border-[var(--color-surface-border)] font-medium'
                    : 'text-[var(--color-primary-muted)] hover:bg-[var(--color-surface-hover)]'
                }`}
              >
                {f.label}
                <span className="ml-1 text-[9px] opacity-60">({counts[f.key]})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-[var(--color-primary-muted)]">search</span>
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="nexus-input pl-8 text-[11px] w-64"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-[var(--color-primary-muted)] hover:text-[var(--color-primary)]"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="nexus-select text-[11px] py-1 w-28"
          >
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
            <option value="type">Type</option>
          </select>
          <button
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="nexus-button-icon"
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            <span className="material-symbols-outlined text-[16px]">
              {sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
            </span>
          </button>

          {/* View mode */}
          <div className="flex gap-[1px]">
            <button
              onClick={() => setViewMode('grid')}
              className={`nexus-button-icon ${viewMode === 'grid' ? 'bg-[var(--color-surface-hover)]' : ''}`}
            >
              <span className="material-symbols-outlined text-[16px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`nexus-button-icon ${viewMode === 'list' ? 'bg-[var(--color-surface-hover)]' : ''}`}
            >
              <span className="material-symbols-outlined text-[16px]">view_list</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Breadcrumb Bar ── */}
      <div className="h-10 bg-[var(--color-surface-base)] border-b border-[var(--color-surface-border)] flex items-center px-6 gap-2 shrink-0">
        <button 
          onClick={handleNavigateUp}
          disabled={!currentPath || currentPath === '/'}
          className={`flex items-center justify-center p-1 rounded transition-colors ${!currentPath || currentPath === '/' ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[var(--color-surface-hover)] cursor-pointer text-[var(--color-primary)]'}`}
        >
          <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
        </button>
        <div className="h-4 w-[1px] bg-[var(--color-surface-border)] mx-1" />
        <div className="text-[11px] font-['Geist_Mono'] text-[var(--color-primary)] flex items-center gap-1.5 flex-1 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <span 
            className="cursor-pointer hover:underline text-[var(--color-primary-muted)] hover:text-[var(--color-primary)] transition-colors"
            onClick={() => setCurrentPath('')}
          >
            Vault
          </span>
          {currentPath.split('/').filter(Boolean).map((part, i, arr) => {
            const pathSoFar = arr.slice(0, i + 1).join('/');
            return (
              <span key={i} className="flex items-center gap-1.5">
                <span className="text-[var(--color-primary-muted)]">/</span>
                <span 
                  className={`cursor-pointer hover:underline transition-colors ${i === arr.length - 1 ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-primary-muted)] hover:text-[var(--color-primary)]'}`}
                  onClick={() => setCurrentPath(pathSoFar)}
                >
                  {part}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main asset area */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
              <span className="material-symbols-outlined text-[32px] animate-spin text-[var(--color-accent)]">progress_activity</span>
              <span className="text-[12px] text-[var(--color-primary-muted)]">Loading assets from NAS...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <span className="material-symbols-outlined text-[32px] text-[var(--color-error)]">error</span>
              <span className="text-[12px] text-[var(--color-error)]">Failed to load assets: {error}</span>
              <button onClick={() => window.location.reload()} className="nexus-button-primary text-[11px] px-3 py-1">
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
              <span className="material-symbols-outlined text-[32px] text-[var(--color-primary-muted)]">folder_open</span>
              <span className="text-[12px] text-[var(--color-primary-muted)]">
                {search ? `No results for "${search}"` : 'Folder is empty'}
              </span>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
              {filtered.map(asset => {
                const isFolder = asset.type === 'folder';
                const cat = getFileTypeCategory(asset.name, isFolder);
                return (
                <div
                  key={asset.path}
                  onClick={() => handleNavigate(asset)}
                  onDoubleClick={() => isFolder && handleNavigate(asset)}
                  className={`flex flex-col gap-1.5 group cursor-pointer rounded-md transition-all ${
                    selected?.path === asset.path
                      ? 'ring-2 ring-[var(--color-accent)] bg-[var(--color-accent-container)]'
                      : ''
                  }`}
                >
                  <div className="aspect-square bg-[var(--color-surface-panel)] border border-[var(--color-surface-border)] rounded-md flex items-center justify-center relative group-hover:border-[var(--color-primary-muted)] transition-colors overflow-hidden">
                    {/* Preview Image for actual images */}
                    {cat === 'image' && !isFolder ? (
                      <img 
                        src={`/api/media/browse?path=${encodeURIComponent(asset.path)}&download=1`} 
                        alt={asset.name}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                      />
                    ) : null}

                    {/* Fallback Icon */}
                    <span className={`material-symbols-outlined text-[28px] opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all ${
                      cat === 'image' && !isFolder ? 'hidden' : ''
                    } ${
                      isFolder ? 'text-[var(--color-primary)]' :
                      cat === 'video' ? 'text-[#7C8CFF]' :
                      cat === 'audio' ? 'text-[#4ADE80]' :
                      cat === 'image' ? 'text-[#FFBA43]' :
                      'text-[var(--color-primary-muted)]'
                    }`}>
                      {fileIcon(cat, asset.name)}
                    </span>

                    {/* Type badge */}
                    <div className="absolute top-1 left-1 px-1 py-0.5 bg-[var(--color-surface-base)]/80 rounded-sm text-[8px] font-['Geist_Mono'] text-[var(--color-primary-muted)] uppercase">
                      {readableType(asset.name, asset.type)}
                    </div>
                  </div>
                  <div className="flex flex-col px-1">
                    <span className="text-[10px] font-medium text-[var(--color-primary)] truncate" title={asset.name}>
                      {asset.name}
                    </span>
                    <span className="text-[9px] text-[var(--color-primary-muted)] font-['Geist_Mono']">
                      {isFolder ? '--' : formatSize(asset.size)}
                    </span>
                  </div>
                </div>
              )})}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && viewMode === 'list' && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left border-b border-[var(--color-surface-border)]">
                  <th className="py-2 px-3 text-[10px] uppercase font-bold text-[var(--color-primary-muted)] cursor-pointer hover:text-[var(--color-primary)]" onClick={() => toggleSort('name')}>
                    Name {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 px-3 text-[10px] uppercase font-bold text-[var(--color-primary-muted)] cursor-pointer hover:text-[var(--color-primary)] w-20" onClick={() => toggleSort('type')}>
                    Type {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 px-3 text-[10px] uppercase font-bold text-[var(--color-primary-muted)] cursor-pointer hover:text-[var(--color-primary)] w-24" onClick={() => toggleSort('size')}>
                    Size {sortBy === 'size' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-2 px-3 text-[10px] uppercase font-bold text-[var(--color-primary-muted)] cursor-pointer hover:text-[var(--color-primary)] w-36" onClick={() => toggleSort('date')}>
                    Modified {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(asset => {
                  const isFolder = asset.type === 'folder';
                  const cat = getFileTypeCategory(asset.name, isFolder);
                  return (
                  <tr
                    key={asset.path}
                    onClick={() => handleNavigate(asset)}
                    className={`border-b border-[var(--color-surface-border-subtle)] cursor-pointer transition-colors ${
                      selected?.path === asset.path
                        ? 'bg-[var(--color-accent-container)]'
                        : 'hover:bg-[var(--color-surface-hover)]'
                    }`}
                  >
                    <td className="py-2 px-3 flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[16px] ${
                        isFolder ? 'text-[var(--color-primary)]' :
                        cat === 'video' ? 'text-[#7C8CFF]' :
                        cat === 'audio' ? 'text-[#4ADE80]' :
                        cat === 'image' ? 'text-[#FFBA43]' :
                        'text-[var(--color-primary-muted)]'
                      }`}>
                        {fileIcon(cat, asset.name)}
                      </span>
                      <span className="text-[var(--color-primary)] font-medium truncate max-w-[400px]" title={asset.name}>
                        {asset.name}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[var(--color-primary-muted)] font-['Geist_Mono'] uppercase text-[10px]">
                      {readableType(asset.name, asset.type)}
                    </td>
                    <td className="py-2 px-3 text-[var(--color-primary-muted)] font-['Geist_Mono']">
                      {isFolder ? '--' : formatSize(asset.size)}
                    </td>
                    <td className="py-2 px-3 text-[var(--color-primary-muted)] font-['Geist_Mono']">
                      {asset.modified ? new Date(asset.modified).toLocaleString() : '--'}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Detail Sidebar ── */}
        {selected && (
          <div className="w-[300px] bg-[var(--color-surface-panel)] border-l border-[var(--color-surface-border)] flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-[var(--color-surface-border)] flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[var(--color-primary)]">Asset Details</span>
              <button onClick={() => setSelected(null)} className="nexus-button-icon">
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            {/* Preview placeholder */}
            <div className="aspect-video bg-[var(--color-surface-base)] border-b border-[var(--color-surface-border)] flex items-center justify-center overflow-hidden">
              {getFileTypeCategory(selected.name, false) === 'image' ? (
                <img 
                  src={`/api/media/browse?path=${encodeURIComponent(selected.path)}&download=1`} 
                  alt={selected.name}
                  className="w-full h-full object-contain"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                />
              ) : null}
              <span className={`material-symbols-outlined text-[48px] opacity-30 ${
                getFileTypeCategory(selected.name, false) === 'image' ? 'hidden' : ''
              } ${
                getFileTypeCategory(selected.name, false) === 'video' ? 'text-[#7C8CFF]' :
                getFileTypeCategory(selected.name, false) === 'audio' ? 'text-[#4ADE80]' :
                getFileTypeCategory(selected.name, false) === 'image' ? 'text-[#FFBA43]' :
                'text-[var(--color-primary-muted)]'
              }`}>
                {fileIcon(getFileTypeCategory(selected.name, false), selected.name)}
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Filename */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-1">Filename</div>
                <div className="text-[12px] text-[var(--color-primary)] font-medium break-all">{selected.name}</div>
              </div>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <div className="text-[9px] uppercase text-[var(--color-primary-muted)] font-bold tracking-wider">Type</div>
                  <div className="text-[11px] text-[var(--color-primary)] font-['Geist_Mono']">{readableType(selected.name, selected.type)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase text-[var(--color-primary-muted)] font-bold tracking-wider">Size</div>
                  <div className="text-[11px] text-[var(--color-primary)] font-['Geist_Mono']">{formatSize(selected.size)}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] uppercase text-[var(--color-primary-muted)] font-bold tracking-wider">Modified</div>
                  <div className="text-[11px] text-[var(--color-primary)] font-['Geist_Mono']">{selected.modified ? new Date(selected.modified).toLocaleString() : '--'}</div>
                </div>
              </div>

              {/* Full Path */}
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-1">NAS Path</div>
                <div className="text-[10px] text-[var(--color-primary-muted)] font-['Geist_Mono'] break-all bg-[var(--color-surface-base)] p-2 rounded border border-[var(--color-surface-border)]">
                  {selected.path}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 mt-2">
                <button className="nexus-button-primary text-[11px] py-2">
                  <span className="material-symbols-outlined text-[14px]">play_circle</span>
                  Open in Editor
                </button>
                <button className="nexus-button-secondary text-[11px] py-2">
                  <span className="material-symbols-outlined text-[14px]">record_voice_over</span>
                  Transcribe
                </button>
                <button className="nexus-button-secondary text-[11px] py-2">
                  <span className="material-symbols-outlined text-[14px]">analytics</span>
                  Analyze
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Status Bar ── */}
      <footer className="h-7 bg-[var(--color-surface-panel)] border-t border-[var(--color-surface-border)] flex items-center px-4 justify-between shrink-0">
        <span className="text-[10px] text-[var(--color-primary-muted)] font-['Geist_Mono']">
          {filtered.length} of {assets.length} items
          {search && ` • filtered by "${search}"`}
        </span>
        <span className="text-[10px] text-[var(--color-primary-muted)] font-['Geist_Mono']">
          Source: NAS {pathBreadcrumb(currentPath)}
        </span>
      </footer>
    </section>
  );
}

import { useState, useCallback } from 'react';

/* ── Queue Item Component ── */
const QueueItem = ({ prompt, model, status, progress, time, onClick, isActive }) => (
  <div
    onClick={onClick}
    className={`p-3 border-b border-[var(--color-surface-border-subtle)] cursor-pointer transition-colors ${
      isActive ? 'bg-[var(--color-accent-container)]' : 'hover:bg-[var(--color-surface-hover)]'
    }`}
  >
    <div className="flex items-center justify-between mb-1">
      <span className={`nexus-chip ${status === 'Complete' ? 'success' : status === 'Running' ? 'accent' : status === 'Failed' ? 'error' : 'warning'}`}>{status}</span>
      <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">{time}</span>
    </div>
    <div className="text-[11px] text-[var(--color-primary)] line-clamp-2 mb-1">{prompt}</div>
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">{model}</span>
      {progress !== undefined && status === 'Running' && (
        <div className="w-20">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
    </div>
  </div>
);

/* ── Timestamp helper ── */
function nowTime() {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** ComfyUI HTTP API base (trailing slash stripped). Dev defaults to Vite `/comfy` proxy. */
function resolveComfyBaseUrl() {
  const explicit = String(import.meta.env?.VITE_COMFYUI_BASE_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (import.meta.env?.DEV) return '/comfy';
  return '';
}

function parseResolutionLabel(res) {
  const m = String(res).match(/(\d+)\s*[×x]\s*(\d+)/i);
  if (!m) return { width: 512, height: 512 };
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

async function fetchComfyCheckpointName(base) {
  const res = await fetch(`${base}/object_info/CheckpointLoaderSimple`);
  if (!res.ok) throw new Error(`ComfyUI object_info HTTP ${res.status}`);
  const data = await res.json();
  const names = data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0];
  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('ComfyUI returned no checkpoints (CheckpointLoaderSimple.ckpt_name empty)');
  }
  return names[0];
}

/** Minimal txt2img graph for ComfyUI `/prompt` (API format). */
function buildTxt2ImgWorkflow(ckptName, positive, negative, seed, steps, cfg, width, height) {
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckptName } },
    2: { class_type: 'CLIPTextEncode', inputs: { text: positive, clip: ['1', 1] } },
    3: { class_type: 'CLIPTextEncode', inputs: { text: negative || ' ', clip: ['1', 1] } },
    4: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    5: {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    6: { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    7: { class_type: 'SaveImage', inputs: { filename_prefix: 'EngineRoom', images: ['6', 0] } },
  };
}

async function postComfyPrompt(base, workflow) {
  const client_id = `engine-room-${Date.now()}`;
  const res = await fetch(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, client_id }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ComfyUI /prompt HTTP ${res.status}: ${text.slice(0, 240)}`);
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export default function GenMediaPane() {
  const [prompt, setPrompt] = useState('');
  const [negPrompt, setNegPrompt] = useState('');
  const [activeModel, setActiveModel] = useState('comfyui');
  const [mediaType, setMediaType] = useState('image');
  const [viewTab, setViewTab] = useState('gallery');
  const [resolution, setResolution] = useState('1024 × 1024');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [cfgScale, setCfgScale] = useState(7.5);
  const [steps, setSteps] = useState(30);
  const [seed, setSeed] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedQueueItem, setSelectedQueueItem] = useState(null);

  // Queue lives in local state — persists during session
  const [queue, setQueue] = useState([]);

  const models = [
    { id: 'comfyui', name: 'ComfyUI (Local)', type: 'Image/Video', speed: 'Varies', local: true },
    { id: 'flux-pro', name: 'FLUX Pro', type: 'Image', speed: 'Fast', local: false },
    { id: 'sd-xl', name: 'Stable Diffusion XL', type: 'Image', speed: 'Medium', local: false },
    { id: 'kling', name: 'Kling V1.6', type: 'Video', speed: 'Slow', local: false },
    { id: 'runway', name: 'Runway Gen-3', type: 'Video', speed: 'Medium', local: false },
    { id: 'sora', name: 'Sora', type: 'Video', speed: 'Slow', local: false },
    { id: 'luma', name: 'Luma Dream Machine', type: 'Video', speed: 'Fast', local: false },
  ];

  const currentModel = models.find(m => m.id === activeModel) || models[0];

  /* ── Submit generation job ── */
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    const job = {
      id: Date.now(),
      prompt: prompt.trim(),
      negPrompt: negPrompt.trim(),
      model: currentModel.name,
      modelId: activeModel,
      mediaType,
      resolution,
      aspectRatio,
      cfgScale,
      steps,
      seed: seed || 'Random',
      status: 'Queued',
      time: nowTime(),
      progress: 0,
      result: null,
    };

    setQueue(prev => [job, ...prev]);
    setGenerating(true);

    // Simulate progression for non-local models (no backend yet)
    // For ComfyUI local: would POST to ComfyUI API on NAS
    if (activeModel === 'comfyui') {
      const comfyBase = resolveComfyBaseUrl();
      try {
        setQueue(prev => prev.map(j => (j.id === job.id ? { ...j, status: 'Running', progress: 10 } : j)));
        if (!comfyBase) {
          throw new Error(
            'ComfyUI base URL missing: set VITE_COMFYUI_BASE_URL, or run dev with vite proxy /comfy (see vite.config.js + COMFYUI_PROXY_TARGET).'
          );
        }
        const ckpt = await fetchComfyCheckpointName(comfyBase);
        const { width, height } = parseResolutionLabel(resolution);
        const seedNum =
          seed && /^\d+$/.test(String(seed).trim())
            ? parseInt(String(seed).trim(), 10)
            : Math.floor(Math.random() * 2147483647);
        const workflow = buildTxt2ImgWorkflow(
          ckpt,
          prompt.trim(),
          negPrompt.trim(),
          seedNum,
          steps,
          cfgScale,
          width,
          height
        );
        const queued = await postComfyPrompt(comfyBase, workflow);
        setQueue(prev =>
          prev.map(j =>
            j.id === job.id
              ? { ...j, comfyPromptId: queued.prompt_id ?? null, progress: 40, status: 'Running' }
              : j
          )
        );
        await simulateProgress(job.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setQueue(prev =>
          prev.map(j => (j.id === job.id ? { ...j, status: 'Failed', lastError: msg } : j))
        );
      }
    } else {
      // External API models — simulate until real APIs are connected
      await simulateProgress(job.id);
    }

    setGenerating(false);
  }, [prompt, negPrompt, activeModel, mediaType, resolution, aspectRatio, cfgScale, steps, seed, currentModel]);

  /* ── Simulate progress for demo ── */
  async function simulateProgress(jobId) {
    const intervals = [15, 30, 50, 70, 85, 95, 100];
    for (const pct of intervals) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
      setQueue(prev => prev.map(j => 
        j.id === jobId ? { ...j, status: pct >= 100 ? 'Complete' : 'Running', progress: pct } : j
      ));
    }
  }

  const completedJobs = queue.filter(j => j.status === 'Complete');
  const activeJobs = queue.filter(j => j.status === 'Running' || j.status === 'Queued');

  return (
    <section className="h-full flex bg-[var(--color-surface-base)] overflow-hidden">

      {/* Left: Controls Panel */}
      <div className="w-[320px] bg-[var(--color-surface-panel)] flex flex-col border-r border-[var(--color-surface-border)]">
        <div className="panel-header">
          <div className="panel-header-title">
            <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-muted)]">auto_awesome</span>
            GenMedia Studio
          </div>
          {currentModel.local && (
            <span className="nexus-chip success text-[8px]">LOCAL</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Media Type Selector */}
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 block">Output Type</label>
            <div className="flex gap-[1px] bg-[var(--color-surface-border)]">
              {['image', 'video', 'audio', '3d'].map(type => (
                <button
                  key={type}
                  onClick={() => setMediaType(type)}
                  className={`flex-1 py-1.5 text-[11px] font-medium uppercase ${mediaType === type ? 'bg-[var(--color-accent)] text-[var(--color-surface-base)]' : 'bg-[var(--color-surface-elevated)] text-[var(--color-primary-muted)] hover:text-[var(--color-primary)]'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 block">Prompt</label>
            <textarea
              className="nexus-input min-h-[120px] resize-none text-[12px] leading-relaxed"
              placeholder="Describe the scene, style, composition..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--color-primary-muted)]">{prompt.length} chars</span>
              <button className="text-[10px] text-[var(--color-accent)] hover:underline">Enhance with AI</button>
            </div>
          </div>

          {/* Negative Prompt */}
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 block">Negative Prompt</label>
            <input
              className="nexus-input text-[12px]"
              placeholder="blur, watermark, low quality..."
              value={negPrompt}
              onChange={(e) => setNegPrompt(e.target.value)}
            />
          </div>

          {/* Model Selection */}
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 block">Model</label>
            <div className="space-y-1">
              {models
                .filter(m => {
                  if (mediaType === 'image') return m.type.includes('Image');
                  if (mediaType === 'video') return m.type.includes('Video');
                  return true;
                })
                .map(m => (
                <div
                  key={m.id}
                  onClick={() => setActiveModel(m.id)}
                  className={`flex items-center justify-between py-2 px-3 cursor-pointer border transition-colors ${
                    activeModel === m.id
                      ? 'bg-[var(--color-accent-container)] border-[rgba(124,140,255,0.3)]'
                      : 'bg-[var(--color-surface-base)] border-[var(--color-surface-border)] hover:border-[var(--color-primary-muted)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {m.local && <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />}
                    <div>
                      <div className="text-[12px] text-[var(--color-primary)] font-medium">{m.name}</div>
                      <div className="text-[10px] text-[var(--color-primary-muted)]">{m.type}</div>
                    </div>
                  </div>
                  <span className="nexus-chip">{m.speed}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 block">Settings</label>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--color-primary)]">Resolution</span>
                <select className="nexus-select w-[140px] text-[11px] py-1" value={resolution} onChange={e => setResolution(e.target.value)}>
                  <option>1920 × 1080</option>
                  <option>1024 × 1024</option>
                  <option>1280 × 720</option>
                  <option>3840 × 2160</option>
                  <option>512 × 512</option>
                </select>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--color-primary)]">Aspect Ratio</span>
                <div className="flex gap-[1px] bg-[var(--color-surface-border)]">
                  {['16:9', '1:1', '9:16', '4:3'].map(ar => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`px-2 py-0.5 text-[10px] ${
                        aspectRatio === ar
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--color-surface-elevated)] text-[var(--color-primary-muted)] hover:text-[var(--color-primary)]'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--color-primary)]">CFG Scale</span>
                <input
                  type="number"
                  className="nexus-input w-16 text-[11px] text-right py-0.5 font-mono"
                  value={cfgScale}
                  min={1} max={20} step={0.5}
                  onChange={e => setCfgScale(parseFloat(e.target.value) || 7.5)}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--color-primary)]">Steps</span>
                <input
                  type="number"
                  className="nexus-input w-16 text-[11px] text-right py-0.5 font-mono"
                  value={steps}
                  min={1} max={150}
                  onChange={e => setSteps(parseInt(e.target.value) || 30)}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-[var(--color-primary)]">Seed</span>
                <input
                  type="text"
                  className="nexus-input w-24 text-[11px] text-right py-0.5 font-mono"
                  value={seed}
                  placeholder="Random"
                  onChange={e => setSeed(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Reference Image Upload */}
          <div>
            <label className="text-[10px] font-bold tracking-widest text-[var(--color-primary-muted)] uppercase mb-2 block">Reference Image</label>
            <div className="border border-dashed border-[var(--color-surface-border)] bg-[var(--color-surface-base)] p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[var(--color-primary-muted)] transition-colors">
              <span className="material-symbols-outlined text-[24px] text-[var(--color-primary-muted)]">add_photo_alternate</span>
              <span className="text-[10px] text-[var(--color-primary-muted)]">Drop image or click to upload</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className={`nexus-button-primary py-3 mt-2 ${(!prompt.trim() || generating) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {generating ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Generating...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                Generate
              </>
            )}
          </button>
        </div>
      </div>

      {/* Center: Output Canvas / Gallery */}
      <div className="flex-1 flex flex-col bg-[var(--color-surface-base)] overflow-hidden">
        {/* Tabs */}
        <div className="h-10 flex items-center px-4 border-b border-[var(--color-surface-border)] gap-4 bg-[var(--color-surface-panel)]">
          {['gallery', 'canvas', 'compare'].map(tab => (
            <button
              key={tab}
              onClick={() => setViewTab(tab)}
              className={`text-[11px] font-medium uppercase ${viewTab === tab ? 'text-[var(--color-primary)] border-b-2 border-[var(--color-accent)] pb-2 -mb-[1px]' : 'text-[var(--color-primary-muted)]'}`}
            >
              {tab}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-mono text-[var(--color-primary-muted)]">{completedJobs.length} outputs</span>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">grid_view</span></button>
            <button className="nexus-button-icon"><span className="material-symbols-outlined text-[16px]">view_list</span></button>
          </div>
        </div>

        {/* Gallery Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {completedJobs.length === 0 && queue.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
              <span className="material-symbols-outlined text-[48px] text-[var(--color-primary-muted)]">auto_awesome</span>
              <span className="text-[13px] text-[var(--color-primary-muted)]">No generations yet</span>
              <span className="text-[11px] text-[var(--color-primary-muted)]">Write a prompt and click Generate to start</span>
            </div>
          )}

          {queue.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {queue.map((job) => (
                <div
                  key={job.id}
                  onClick={() => setSelectedQueueItem(selectedQueueItem?.id === job.id ? null : job)}
                  className={`flex flex-col gap-2 group cursor-pointer rounded-md transition-all ${
                    selectedQueueItem?.id === job.id ? 'ring-2 ring-[var(--color-accent)]' : ''
                  }`}
                >
                  <div className="aspect-video bg-[var(--color-surface-panel)] border border-[var(--color-surface-border)] overflow-hidden relative group-hover:border-[var(--color-primary-muted)] transition-colors flex items-center justify-center">
                    {job.status === 'Complete' ? (
                      <>
                        {/* Completed generation — show colored placeholder */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent-container)] to-[var(--color-surface-panel)]" />
                        <span className="material-symbols-outlined text-[32px] text-[var(--color-accent)] opacity-40 z-10">image</span>
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 transition-opacity z-20">
                          <div className="flex gap-2">
                            <button className="nexus-button-icon bg-[var(--color-surface-panel)]">
                              <span className="material-symbols-outlined text-[16px] text-white">fullscreen</span>
                            </button>
                            <button className="nexus-button-icon bg-[var(--color-surface-panel)]">
                              <span className="material-symbols-outlined text-[16px] text-white">download</span>
                            </button>
                            <button className="nexus-button-icon bg-[var(--color-surface-panel)]">
                              <span className="material-symbols-outlined text-[16px] text-white">content_copy</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : job.status === 'Running' ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="material-symbols-outlined text-[24px] animate-spin text-[var(--color-accent)]">progress_activity</span>
                        <span className="text-[10px] font-mono text-[var(--color-accent)]">{job.progress}%</span>
                      </div>
                    ) : job.status === 'Failed' ? (
                      <span className="material-symbols-outlined text-[24px] text-[var(--color-error)]">error</span>
                    ) : (
                      <span className="material-symbols-outlined text-[24px] text-[var(--color-primary-muted)] opacity-30">hourglass_top</span>
                    )}

                    {/* Model badge */}
                    <div className="absolute bottom-1 left-1 flex gap-1 z-10">
                      <span className="nexus-chip text-[8px] py-0">{job.model}</span>
                    </div>
                    <div className="absolute bottom-1 right-1 z-10">
                      <span className="text-[8px] font-mono text-[var(--color-primary-muted)] bg-[var(--color-surface-panel)] px-1">{job.resolution}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-[var(--color-primary-muted)] line-clamp-2 leading-relaxed px-1">
                    {job.prompt}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Queue / History */}
      <div className="w-[280px] bg-[var(--color-surface-panel)] flex flex-col border-l border-[var(--color-surface-border)]">
        <div className="panel-header">
          <div className="panel-header-title">
            <span className="material-symbols-outlined text-[14px] text-[var(--color-primary-muted)]">queue</span>
            Queue
          </div>
          {activeJobs.length > 0 && (
            <span className="nexus-chip accent">{activeJobs.length} active</span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-40">
              <span className="material-symbols-outlined text-[20px] text-[var(--color-primary-muted)]">queue</span>
              <span className="text-[10px] text-[var(--color-primary-muted)]">Queue empty</span>
            </div>
          ) : (
            queue.map(job => (
              <QueueItem
                key={job.id}
                prompt={job.prompt}
                model={job.model}
                status={job.status}
                progress={job.progress}
                time={job.time}
                isActive={selectedQueueItem?.id === job.id}
                onClick={() => setSelectedQueueItem(selectedQueueItem?.id === job.id ? null : job)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

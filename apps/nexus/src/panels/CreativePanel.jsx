import React, { useState, useRef, useEffect, useCallback } from 'react';

const GENKIT_BASE = `http://${window.location.hostname}:4100`;
const DISPATCH_BASE = `http://${window.location.hostname}:5050`;

const INITIAL_PIPELINE = [
    { id: 'prompt', icon: '✦', name: 'Creative Prompt', sub: 'Text → directive', status: 'complete' },
    { id: 'image', icon: '◈', name: 'Image Synthesis', sub: 'Imagen 3 / Flux', status: 'complete' },
    { id: 'model3d', icon: '⬡', name: '3D Model Gen', sub: 'TripoSR / Zero123++', status: 'active' },
    { id: 'video', icon: '▶', name: 'Video Synthesis', sub: 'Veo 2 / AnimateDiff', status: 'idle' },
    { id: 'audio', icon: '♪', name: 'Audio Layer', sub: 'Lyria / Chirp', status: 'idle' },
    { id: 'export', icon: '↗', name: 'Export & Delivery', sub: 'CDN / local output', status: 'idle' },
];

const PROVIDERS_DATA = [
    { id: 'fal', name: 'FAL.ai', models: 'Flux · TripoSR · AnimateDiff', status: 'online', latency: 420, maxLatency: 2000, jobs: 3 },
    { id: 'vertex', name: 'Vertex AI', models: 'Imagen 3 · Veo 2 · Chirp', status: 'online', latency: 680, maxLatency: 2000, jobs: 1 },
    { id: 'gai', name: 'Google AI Studio', models: 'Gemini 2.5 Pro · Flash', status: 'online', latency: 245, maxLatency: 2000, jobs: 5 },
    { id: 'ollama', name: 'Ollama (Local)', models: 'Llama 3 · Mistral', status: 'degraded', latency: 1400, maxLatency: 2000, jobs: 0 },
    { id: 'hf', name: 'HuggingFace', models: 'Zero123 · SDXL · RealVis', status: 'offline', latency: 0, maxLatency: 2000, jobs: 0 },
];

const INITIAL_JOBS = [
    { id: '1', name: 'Album Cover — Horizon 50', provider: 'FAL.ai', progress: 78, status: 'running', type: 'IMG→3D', eta: '~1m' },
    { id: '2', name: 'Promo Loop — &Gather', provider: 'Vertex AI', progress: 100, status: 'complete', type: 'IMG→VID', eta: 'done' },
    { id: '3', name: 'Brand Identity — Jaymee', provider: 'FAL.ai', progress: 45, status: 'running', type: 'IMG', eta: '~3m' },
];

const STATUS_COLOR = { idle: 'var(--text-tertiary)', active: 'var(--accent)', complete: 'var(--success)', error: 'var(--live)' };
const STATUS_LABEL = { idle: 'IDLE', active: 'ACTIVE', complete: 'DONE', error: 'ERR' };
const PROVIDER_DOT = { online: 'var(--success)', degraded: 'var(--warning)', offline: 'var(--live)' };
const JOB_TAG_STYLE = {
    running: { background: 'rgba(196,122,62,0.15)', color: 'var(--accent-light)', border: '1px solid var(--accent-border)' },
    complete: { background: 'rgba(90,154,74,0.15)', color: 'var(--success)', border: '1px solid rgba(90,154,74,0.3)' },
    failed: { background: 'rgba(212,74,58,0.15)', color: 'var(--live)', border: '1px solid rgba(212,74,58,0.3)' },
    queued: { background: 'rgba(138,127,115,0.15)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' },
};

const hasKey = (id) => id === 'ollama' || true; // Mock true for now since it's the desktop panel

const TOOL_SECTIONS = [
    {
        id: 'create', label: 'Create',
        tools: [
            { id: 'gen-image', icon: '◎', label: 'Generate Image', desc: 'Text → Image with Imagen 3, Flux Pro, SDXL', providers: ['google', 'fal', 'replicate'], color: 'var(--color-neutral-400)', mode: 'image' },
            { id: 'gen-video', icon: '▶', label: 'Generate Video', desc: 'Text/Image → Video with Veo 2, WAN, LTX', providers: ['google', 'fal', 'replicate'], color: 'var(--color-neutral-400)', mode: 'video' },
            { id: 'gen-audio', icon: '♫', label: 'Generate Music', desc: 'Compose with Lyria 2, MusicGen, AudioCraft', providers: ['google', 'replicate'], color: 'var(--color-neutral-400)', mode: 'music' },
            { id: 'gen-voice', icon: '🎤', label: 'Voice Synthesis', desc: 'Clone & synthesise voice, multilingual TTS', providers: ['eleven', 'google'], color: 'var(--color-neutral-400)', mode: 'voice' },
        ],
    },
    {
        id: 'enhance', label: 'Enhance & Edit',
        tools: [
            { id: 'upscale', icon: '⬡', label: 'Upscale', desc: 'Up to 4K — Real-ESRGAN, Clarity, Topaz', providers: ['fal', 'replicate'], color: 'var(--color-neutral-400)', mode: 'upscale' },
            { id: 'img2img', icon: '◈', label: 'Image → Image', desc: 'Style transfer, inpainting, outpainting', providers: ['fal', 'replicate'], color: 'var(--color-neutral-400)', mode: 'img2img' },
            { id: 'img2video', icon: '◧', label: 'Image → Video', desc: 'Animate a still image with controlled motion', providers: ['fal', 'google'], color: 'var(--color-neutral-400)', mode: 'img2video' },
            { id: 'stylize', icon: '◆', label: 'Stylize Audio', desc: 'Apply stems, effects, EQ to audio', providers: ['replicate'], color: 'var(--color-neutral-400)', mode: 'stylize' },
        ],
    },
    {
        id: 'apps', label: 'One-Click Apps',
        tools: [
            { id: 'cinematic', icon: '🎬', label: 'Cinematic Shot', desc: 'Film-school lighting & grade in one prompt', providers: ['fal', 'google'], color: 'var(--color-neutral-400)', mode: 'image', preset: 'cinematic' },
            { id: 'moodboard', icon: '◉', label: 'Moodboard', desc: 'Auto-compose a visual moodboard from a theme', providers: ['fal'], color: 'var(--color-neutral-400)', mode: 'image', preset: 'moodboard' },
            { id: 'animorph', icon: '◑', label: 'Character Warp', desc: 'Warp a subject into an alternate style', providers: ['fal', 'replicate'], color: 'var(--color-neutral-400)', mode: 'img2img', preset: 'animorph' },
            { id: 'relight', icon: '●', label: 'Relight Scene', desc: 'Change lighting conditions on any photo', providers: ['fal'], color: 'var(--color-neutral-400)', mode: 'img2img', preset: 'relight' },
            { id: 'expand', icon: '□', label: 'Expand Canvas', desc: 'Outpaint in any direction with continuity', providers: ['fal', 'replicate'], color: 'var(--color-neutral-400)', mode: 'img2img', preset: 'expand' },
            { id: 'vary', icon: '◇', label: 'Variations', desc: 'Generate multiple creative takes on a theme', providers: ['fal', 'google'], color: 'var(--color-neutral-400)', mode: 'image', preset: 'vary' },
        ],
    },
    {
        id: 'intelligence', label: 'Intelligence',
        tools: [
            { id: 'gemini', icon: '◆', label: 'Gemini 2.0 Flash', desc: 'Fast multimodal reasoning, 1M token context', providers: ['google'], color: 'var(--color-neutral-400)', mode: 'text' },
            { id: 'claude', icon: '◇', label: 'Claude 3.5 Sonnet', desc: 'Creative writing, analysis, long-form', providers: ['anthropic'], color: 'var(--color-neutral-400)', mode: 'text' },
            { id: 'llama', icon: '○', label: 'Llama 3.3 (Local)', desc: 'Fully sovereign — runs on your hardware', providers: ['ollama'], color: 'var(--color-neutral-400)', mode: 'text' },
            { id: 'sonar', icon: '◉', label: 'Sonar Pro (Web)', desc: 'Real-time web search with cited responses', providers: ['perplexity'], color: 'var(--color-neutral-400)', mode: 'text' },
        ],
    },
];

const ALL_TOOLS = TOOL_SECTIONS.flatMap(s => s.tools);

const MODE_PRESETS = {
    image: { placeholder: 'A cinematic portrait of a lone astronaut in a neon Tokyo alley at 3am, anamorphic lens flares, ultra-detailed…', options: ['1:1', '16:9', '4:3', '9:16', '3:2'], optionLabel: 'Aspect' },
    video: { placeholder: 'A slow-motion macro shot of a dandelion releasing seeds into golden hour, 4K, gentle camera drift…', options: ['5s', '10s', '15s'], optionLabel: 'Duration' },
    music: { placeholder: 'A 32-bar lo-fi hip-hop beat: warm upright bass, dusty vinyl crackle, lazy brushed snare at 82bpm…', options: ['15s', '30s', '60s', '2min'], optionLabel: 'Length' },
    voice: { placeholder: 'Speak these words in a warm, confident, slightly husky female voice with a slight British accent…', options: ['Warm', 'Clinical', 'Dramatic', 'ASMR'], optionLabel: 'Tone' },
    text: { placeholder: 'Write a compelling product brief for a sovereign creative AI OS built for independent artists…', options: ['Concise', 'Standard', 'Detailed'], optionLabel: 'Length' },
    upscale: { placeholder: 'Upload an image and describe any enhancement directives…', options: ['2×', '4×', '8×'], optionLabel: 'Scale' },
    img2img: { placeholder: 'Describe the transformation — "convert to oil painting style", "add cinematic rain"…', options: ['0.3', '0.5', '0.7', '0.9'], optionLabel: 'Strength' },
    img2video: { placeholder: 'Describe the motion — "gentle zoom in", "camera pans left revealing background"…', options: ['5s', '10s'], optionLabel: 'Duration' },
    stylize: { placeholder: 'Describe the audio transformation — "lo-fi vinyl warmth", "orchestral reverb", "8-bit chiptune"…', options: ['Subtle', 'Medium', 'Strong'], optionLabel: 'Intensity' },
};
const DEFAULT_PRESET = MODE_PRESETS.text;

export function CreativePanel({ dispatch }) {
    const [activeTool, setActiveTool] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [option, setOption] = useState('');
    const [outputs, setOutputs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [loadMsg, setLoadMsg] = useState('Thinking…');
    const textRef = useRef(null);

    // CreativeWorkstation states
    const [pipeline, setPipeline] = useState(INITIAL_PIPELINE);
    const [jobs, setJobs] = useState(INITIAL_JOBS);
    const [, setActiveNode] = useState('model3d');

    // Simulate job progress
    useEffect(() => {
        const iv = setInterval(() => {
            setJobs(prev => prev.map(job => {
                if (job.status === 'running' && job.progress < 100) {
                    const next = Math.min(job.progress + Math.random() * 2, 100);
                    return { ...job, progress: Math.round(next), status: next >= 100 ? 'complete' : 'running' };
                }
                return job;
            }));
        }, 800);
        return () => clearInterval(iv);
    }, []);

    // Simulate pipeline advance
    useEffect(() => {
        const iv = setInterval(() => {
            setPipeline(prev => {
                const activeIdx = prev.findIndex(s => s.status === 'active');
                if (activeIdx === -1 || activeIdx >= prev.length - 1) return prev;
                const next = [...prev];
                if (Math.random() < 0.15) {
                    next[activeIdx] = { ...next[activeIdx], status: 'complete' };
                    next[activeIdx + 1] = { ...next[activeIdx + 1], status: 'active' };
                    setActiveNode(next[activeIdx + 1].id);
                }
                return next;
            });
        }, 3000);
        return () => clearInterval(iv);
    }, []);

    // Cycle loading messages
    useEffect(() => {
        if (!loading) return;
        const msgs = ['Thinking…', 'Processing…', 'Generating…', 'Rendering…', 'Almost there…'];
        let i = 0;
        const t = setInterval(() => { i = (i + 1) % msgs.length; setLoadMsg(msgs[i]); }, 1800);
        return () => clearInterval(t);
    }, [loading]);

    const openTool = (tool) => {
        setActiveTool(tool);
        const p = MODE_PRESETS[tool.mode] ?? DEFAULT_PRESET;
        setOption(p.options[0]);
        setPrompt('');
        setTimeout(() => textRef.current?.focus(), 80);
    };

    const filteredSections = search.trim()
        ? [{
            id: 'search', label: 'Results', tools: ALL_TOOLS.filter(t =>
                t.label.toLowerCase().includes(search.toLowerCase()) ||
                t.desc.toLowerCase().includes(search.toLowerCase())
            )
        }]
        : TOOL_SECTIONS;

    const generate = useCallback(async () => {
        if (!activeTool || !prompt.trim() || loading) return;
        const id = crypto.randomUUID();
        const modeInfo = (MODE_PRESETS[activeTool.mode] ?? DEFAULT_PRESET).optionLabel;
        setLoading(true); setLoadMsg('Thinking…');
        setOutputs(prev => [{
            id, toolId: activeTool.id, toolLabel: activeTool.label, prompt,
            result: '', resultType: 'placeholder', ts: Date.now(), providerKey: activeTool.providers[0],
        }, ...prev]);

        const newJob = {
            id,
            name: `${activeTool.label} task`,
            provider: activeTool.providers[0].toUpperCase(),
            progress: 0,
            status: 'running',
            type: activeTool.mode.toUpperCase(),
            eta: '~2m'
        };
        setJobs(prev => [newJob, ...prev]);

        try {
            // Queue via dispatch first (real integration)
            await fetch(`${DISPATCH_BASE}/api/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: activeTool.id, payload: { prompt, modeInfo, option, appPreset: activeTool.preset }, status: 'pending', created: new Date().toISOString() })
            }).catch(() => null);

            // Direct Genkit execution
            const r = await fetch(`${GENKIT_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, mode: activeTool.mode, option, modeInfo, appPreset: activeTool.preset }),
            });
            const text = r.ok
                ? await r.json().then(d => String(d.text ?? d.url ?? d.output ?? JSON.stringify(d))).catch(() => 'Done')
                : `[${r.status}] Service error`;
            const resType = activeTool.mode === 'image' && text.startsWith('http') ? 'image' : 'text';
            setOutputs(prev => prev.map(o => o.id === id ? { ...o, result: text, resultType: resType } : o));
            setJobs(prev => prev.map(j => j.id === id ? { ...j, progress: 100, status: 'complete', eta: 'done' } : j));
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            setOutputs(prev => prev.map(o => o.id === id ? { ...o, result: `Error: ${msg}`, resultType: 'text' } : o));
            setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'failed', eta: 'failed' } : j));
        } finally { setLoading(false); setPrompt(''); }
    }, [activeTool, prompt, option, loading]);

    const preset = activeTool ? (MODE_PRESETS[activeTool.mode] ?? DEFAULT_PRESET) : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>
            <div style={{ flex: 1, display: 'flex', background: 'transparent', minHeight: 0 }}>
                {/* LEFT: Tool browser */}
                <aside style={{
                    width: 280, flexShrink: 0, borderRight: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,0,0,0.2)'
                }}>
                    <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 900, letterSpacing: 2.5, marginBottom: 12 }}>TOOL DIRECTORY</div>
                        <div style={{ position: 'relative' }}>
                            <input
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search tools…"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 30px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-default)', borderRadius: 8, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--chalk)', outline: 'none' }}
                            />
                            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', fontSize: 12, pointerEvents: 'none' }}>⌕</span>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 40px' }}>
                        {filteredSections.map(section => (
                            <div key={section.id}>
                                <div style={{ padding: '12px 18px 6px', fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: 'var(--text-tertiary)' }}>
                                    {section.label.toUpperCase()}
                                </div>
                                {section.tools.map(tool => {
                                    const active = activeTool?.id === tool.id;
                                    const live = tool.providers.some(hasKey);
                                    return (
                                        <div
                                            key={tool.id} onClick={() => openTool(tool)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', cursor: 'pointer', background: active ? `${tool.color}0e` : 'transparent', borderLeft: active ? `2px solid ${tool.color}` : '2px solid transparent', transition: 'all 0.15s' }}
                                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: `${tool.color}15`, border: `1px solid ${tool.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: tool.color }}>{tool.icon}</div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--chalk)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    {tool.label}
                                                    {!live && <span style={{ fontSize: 8, color: 'var(--status-warning)', background: 'rgba(245,165,36,0.1)', padding: '1px 5px', borderRadius: 100, fontWeight: 700 }}>NO KEY</span>}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tool.desc}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </aside>

                {/* CENTER: Canvas */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
                        {activeTool ? (
                            <>
                                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${activeTool.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: activeTool.color }}>{activeTool.icon}</div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--chalk)' }}>{activeTool.label}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{activeTool.desc}</div>
                                </div>
                                {preset && (
                                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: 1 }}>{preset.optionLabel.toUpperCase()}</span>
                                        {preset.options.map(o => (
                                            <button key={o} onClick={() => setOption(o)} style={{ padding: '3px 10px', borderRadius: 100, fontSize: 10, fontWeight: 700, background: option === o ? `${activeTool.color}20` : 'rgba(255,255,255,0.04)', color: option === o ? activeTool.color : 'var(--text-tertiary)', border: `1px solid ${option === o ? activeTool.color + '50' : 'transparent'}`, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' }}>{o}</button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>← Select a tool to interact with the Canvas</span>
                        )}
                    </div>

                    {activeTool && (
                        <div style={{ padding: '16px 24px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
                            <textarea
                                ref={textRef}
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate(); }}
                                placeholder={preset?.placeholder ?? 'Describe what you want to create…'}
                                rows={3}
                                style={{ width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-sans)', fontSize: 14.5, color: 'var(--chalk)', lineHeight: 1.7, boxSizing: 'border-box' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginRight: 'auto' }}>⌘↵ to generate</span>
                                <button
                                    onClick={generate}
                                    disabled={!prompt.trim() || loading}
                                    style={{ padding: '9px 28px', borderRadius: 100, fontSize: 12, fontWeight: 800, background: prompt.trim() && !loading ? activeTool.color : 'rgba(255,255,255,0.06)', color: prompt.trim() && !loading ? 'var(--color-neutral-1000)' : 'var(--text-tertiary)', border: 'none', cursor: prompt.trim() && !loading ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', transition: 'all 0.18s' }}
                                >{loading ? loadMsg : `Generate ${activeTool.icon}`}</button>
                            </div>
                        </div>
                    )}

                    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 120px' }}>
                        {!activeTool && outputs.length === 0 && (
                            <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
                                <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 900, letterSpacing: 2.5, marginBottom: 16 }}>CREATIVE CANVAS IDLE</div>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Select a tool from the directory on the left to begin generating media.</p>
                            </div>
                        )}

                        {outputs.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
                                {outputs.map(o => (
                                    <div key={o.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', animation: 'fadeSlideIn 0.3s ease' }}>
                                        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-tertiary)', letterSpacing: 1 }}>{o.toolLabel.toUpperCase()}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{new Date(o.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        {o.resultType === 'placeholder' ? (
                                            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--amber)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{loadMsg}</span>
                                            </div>
                                        ) : o.resultType === 'image' && o.result.startsWith('http') ? (
                                            <img src={o.result} alt={o.prompt} style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ padding: 16, fontSize: 13, color: 'var(--chalk)', lineHeight: 1.75, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>{o.result || '—'}</div>
                                        )}
                                        <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.prompt}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Kroma / Workstation Pipeline & Providers */}
                <aside style={{
                    width: 340, flexShrink: 0, borderLeft: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '20px'
                }}>
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>PIPELINE STAGE</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent)', letterSpacing: '0.06em' }}>
                                {pipeline.filter(s => s.status === 'complete').length}/{pipeline.length}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {pipeline.map((stage, i) => (
                                <div key={stage.id} style={{ display: 'flex', gap: 12, opacity: stage.status === 'idle' ? 0.55 : 1 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: stage.status === 'active' ? 'var(--accent-glow)' : 'var(--bg-primary)',
                                            border: `1px solid ${stage.status === 'active' ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                                            color: STATUS_COLOR[stage.status], fontSize: 12
                                        }}>
                                            {stage.icon}
                                        </div>
                                        {i < pipeline.length - 1 && <div style={{ width: 1, height: 16, background: pipeline[i].status === 'complete' ? 'var(--accent)' : 'var(--border-default)', margin: '4px 0' }} />}
                                    </div>
                                    <div style={{ paddingTop: 4 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: STATUS_COLOR[stage.status] }}>{stage.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{stage.sub}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>ACTIVE QUEUE</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--success)' }}>{jobs.filter(j => j.status === 'complete').length} done</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {jobs.slice(0, 5).map(job => (
                                <div key={job.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--chalk)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.name}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{job.provider} · {job.type}</div>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 6px', borderRadius: 4, ...JOB_TAG_STYLE[job.status] }}>{job.status}</span>
                                    </div>
                                    {(job.status === 'running' || job.status === 'complete') && (
                                        <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${job.progress}%`, background: job.status === 'complete' ? 'var(--success)' : 'var(--accent)', transition: 'width 0.3s ease' }} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>PROVIDERS</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {PROVIDERS_DATA.map(prov => (
                                <div key={prov.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PROVIDER_DOT[prov.status] }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--chalk)' }}>{prov.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{prov.latency > 0 ? `${prov.latency}ms` : 'Offline'}</div>
                                    </div>
                                    {prov.jobs > 0 && (
                                        <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', background: 'var(--accent-glow)', border: '1px solid var(--accent-border)', padding: '2px 6px', borderRadius: 10 }}>{prov.jobs}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </aside>
            </div>
            <style>{`
                @keyframes fadeSlideIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
                @keyframes spin        { from { transform:rotate(0deg) }              to { transform:rotate(360deg) } }
            `}</style>
        </div>
    );
}

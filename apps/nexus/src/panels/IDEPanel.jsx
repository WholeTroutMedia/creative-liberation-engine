import React, { useState, useEffect, useRef } from 'react';

const BRIDGE_BASE = `http://${window.location.hostname}:3901`;
const GENKIT_BASE = `http://${window.location.hostname}:4100`;

const IDEATIONS_DATA = [
  // Wave 1
  {
    id: 'IE-IDX-0368',
    title: 'How the community trained Gemma to "Think"',
    wave: 'Wave 1',
    target: 'services/thinking-machines-lab',
    targetUrl: 'file:///y:/creative-liberation-engine/services/thinking-machines-lab',
    rationale: 'Unifies explicit, multi-stage Chain-of-Thought (CoT) trace reasoning execution inside the Genkit framework.'
  },
  {
    id: 'IE-IDX-0351',
    title: 'AIs like ChatGPT fall apart in Stroop test',
    wave: 'Wave 1',
    target: 'services/thinking-machines-lab',
    targetUrl: 'file:///y:/creative-liberation-engine/services/thinking-machines-lab',
    rationale: 'Implements the Sovereign Executive Control Agent (ECA) conflict graph to arbitrate competing agent directives.'
  },
  {
    id: 'IE-IDX-0359',
    title: 'Anthropic and DeepMind AI Consciousness',
    wave: 'Wave 1',
    target: 'services/agent-observability',
    targetUrl: 'file:///y:/creative-liberation-engine/services/agent-observability',
    rationale: 'Houses the Agent Introspection and sentience proxy (ASP) framework alignment checklists and audit logs.'
  },
  {
    id: 'IE-IDX-0372',
    title: 'OmniRetrieval: Unified Retrieval',
    wave: 'Wave 1',
    target: 'packages/memory',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/memory',
    rationale: 'Connects the Unified Knowledge Weaver registry to search heterogeneous sources (text, tables, graphs, code).'
  },
  {
    id: 'IE-IDX-0367',
    title: 'RAG Is Not Machine Learning',
    wave: 'Wave 1',
    target: 'services/knowledge-ingestion',
    targetUrl: 'file:///y:/creative-liberation-engine/services/knowledge-ingestion',
    rationale: 'Exposes the Domain-Centric RAG vector debugger to trace exact chunk embeddings and resolve index errors.'
  },
  {
    id: 'IE-IDX-0366',
    title: 'Next Bottleneck in AI-Assisted Engineering',
    wave: 'Wave 1',
    target: 'services/averi-memory-service',
    targetUrl: 'file:///y:/creative-liberation-engine/services/averi-memory-service',
    rationale: 'Integrates the Contextual Retrieval Engine to pre-fetch codebase dependencies and eliminate semantic lookup delay.'
  },
  {
    id: 'IE-IDX-0355',
    title: '2026.6: Pick a card, any card',
    wave: 'Wave 1',
    target: 'packages/gen-ui',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/gen-ui',
    rationale: 'Embeds the Contextual Component Weaver to visualize entities and components during creation workflows.'
  },

  // Wave 2
  {
    id: 'IE-IDX-0352',
    title: 'Claude Code Action prompt injection hijack',
    wave: 'Wave 2',
    target: 'services/averi-gateway',
    targetUrl: 'file:///y:/creative-liberation-engine/services/averi-gateway',
    rationale: 'Enforces the Adaptive Semantic Guardrail validator inside the primary gateway to catch injection attempts.'
  },
  {
    id: 'IE-IDX-0360',
    title: 'AI-powered computer worm defense',
    wave: 'Wave 2',
    target: 'services/averi-gateway',
    targetUrl: 'file:///y:/creative-liberation-engine/services/averi-gateway',
    rationale: 'Integrates the Autonomous Adaptive Defense Grid (A2DG) firewall to trace and block malicious network handshakes.'
  },
  {
    id: 'IE-IDX-0353',
    title: 'X Article by Shubham Saboo',
    wave: 'Wave 2',
    target: 'services/averi-gateway',
    targetUrl: 'file:///y:/creative-liberation-engine/services/averi-gateway',
    rationale: 'Embeds the Metadata Input Remediation subsystem to repair broken payloads and validate incoming text formats.'
  },

  // Wave 3
  {
    id: 'IE-IDX-0348',
    title: 'Token prices fell 98%, bills tripled',
    wave: 'Wave 3',
    target: 'services/token-optimizer',
    targetUrl: 'file:///y:/creative-liberation-engine/services/token-optimizer',
    rationale: 'Unifies the Sovereign Tokenomics Command Center to monitor live token spend and compute cost parameters.'
  },
  {
    id: 'IE-IDX-0346',
    title: 'Token prices fell 98%, bills tripled (Part 2)',
    wave: 'Wave 3',
    target: 'services/token-optimizer',
    targetUrl: 'file:///y:/creative-liberation-engine/services/token-optimizer',
    rationale: 'Pairs with `0348` to dynamically route requests based on model costs and optimize inference budgets.'
  },
  {
    id: 'IE-IDX-0349',
    title: 'Google AI Edge Gallery macOS local runtimes',
    wave: 'Wave 3',
    target: 'services/cle-ai-runtime',
    targetUrl: 'file:///y:/creative-liberation-engine/services/cle-ai-runtime',
    rationale: 'Implements the Universal AI Model Gallery picker to register and run local parameters (e.g. Gemma, Llama).'
  },
  {
    id: 'IE-IDX-0347',
    title: 'My AI Couldn\'t See My Files (MCP Server)',
    wave: 'Wave 3',
    target: 'packages/scribe-mcp',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/scribe-mcp',
    rationale: 'Connects the Creative Liberation Engine Native MCP Core to check local server connections and verify context file mappings.'
  },
  {
    id: 'IE-IDX-0357',
    title: 'Fine-tuned Models for google/gemma-4-12B',
    wave: 'Wave 3',
    target: 'services/cle-ai-runtime',
    targetUrl: 'file:///y:/creative-liberation-engine/services/cle-ai-runtime',
    rationale: 'Establishes the Sovereign Model Fabric to catalog and discover fine-tuned models registered on the NAS.'
  },
  {
    id: 'IE-IDX-0358',
    title: 'Alibaba Qwen Team Launches Qwen3.7-Plus',
    wave: 'Wave 3',
    target: 'services/cle-ai-runtime',
    targetUrl: 'file:///y:/creative-liberation-engine/services/cle-ai-runtime',
    rationale: 'Connects the Multimodal Perception Engine status trackers to verify vision-based tool invocation steps.'
  },
  {
    id: 'IE-IDX-0370',
    title: 'NVIDIA X-Token Cross-Tokenizer KD',
    wave: 'Wave 3',
    target: 'packages/inference',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/inference',
    rationale: 'Houses the Cross-Tokenizer Model Interoperability chart to review model output alignments across model shapes.'
  },
  {
    id: 'IE-IDX-0374',
    title: 'Cloudflare support for Claude Managed Agents',
    wave: 'Wave 3',
    target: 'services/sovereign-coder',
    targetUrl: 'file:///y:/creative-liberation-engine/services/sovereign-coder',
    rationale: 'Houses the Universal Pluggable Execution Fabric to map and configure agent execution to different cloud backends.'
  },
  {
    id: 'IE-IDX-0364',
    title: 'JetBrains open-sources Mellum2 coding core',
    wave: 'Wave 3',
    target: 'services/sovereign-coder',
    targetUrl: 'file:///y:/creative-liberation-engine/services/sovereign-coder',
    rationale: 'Integrates the Sovereign Code Synthesis Core console to benchmark Mellum2 execution speed.'
  },
  {
    id: 'IE-IDX-0350',
    title: 'KPMG puts Claude in front of 276,000 staff',
    wave: 'Wave 3',
    target: 'services/dispatch',
    targetUrl: 'file:///y:/creative-liberation-engine/services/dispatch',
    rationale: 'Configures the Enterprise Agent Orchestration platform (SEAOP) scaling thresholds for concurrent team sessions.'
  },
  {
    id: 'IE-IDX-0373',
    title: 'Apple quantum-resistant encryption (PQ3)',
    wave: 'Wave 3',
    target: 'packages/constitution',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/constitution',
    rationale: 'Embeds the Sovereign Post-Quantum Cryptography (PQC) and formal verification test-checker for code verification.'
  },
  {
    id: 'IE-IDX-0365',
    title: 'The DIY platform trap engineering burnout',
    wave: 'Wave 3',
    target: 'services/agent-observability',
    targetUrl: 'file:///y:/creative-liberation-engine/services/agent-observability',
    rationale: 'Connects the Curated Core Platform monitoring services to track Synology CPU, database, and sync performance.'
  },

  // Wave 4
  {
    id: 'IE-IDX-0371',
    title: 'System Design One Shot Full Course',
    wave: 'Wave 4',
    target: 'packages/blueprints',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/blueprints',
    rationale: 'Implements the Generative System Design whiteboard tool to explain and design microservice nodes.'
  },
  {
    id: 'IE-IDX-0354',
    title: 'The internet gives a lot away for free (OSINT)',
    wave: 'Wave 4',
    target: 'services/spatial-surface',
    targetUrl: 'file:///y:/creative-liberation-engine/services/spatial-surface',
    rationale: 'Embeds the Omni-Scribe Geospatial Atlas to display maps, coordinate indicators, and OSINT camera positions.'
  },
  {
    id: 'IE-IDX-0361',
    title: 'The 2-7 Problem: AI Creative Quality',
    wave: 'Wave 4',
    target: 'services/video-agency',
    targetUrl: 'file:///y:/creative-liberation-engine/services/video-agency',
    rationale: 'Integrates the "Quantum Leap" Co-Creator variance slider to balance precise output with artistic randomness.'
  },
  {
    id: 'IE-IDX-0363',
    title: 'X Article by Alex Lieberman (Ingestion)',
    wave: 'Wave 4',
    target: 'services/harvesters',
    targetUrl: 'file:///y:/creative-liberation-engine/services/harvesters',
    rationale: 'Connects the Semantic Content Ingest stream to parse and display social media bookmarks in a live feed.'
  },
  {
    id: 'IE-IDX-0362',
    title: 'X Article by Thariq (Dynamic streams)',
    wave: 'Wave 4',
    target: 'services/harvesters',
    targetUrl: 'file:///y:/creative-liberation-engine/services/harvesters',
    rationale: 'Complements `0363` by formatting the parsed social metadata as dynamic cards inside the feed deck.'
  },
  {
    id: 'IE-IDX-0356',
    title: 'DaVinci Resolve 21 final release',
    wave: 'Wave 4',
    target: 'packages/davinci-resolve-mcp',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/davinci-resolve-mcp',
    rationale: 'Houses the Cognitive Canvas media track visualizer to parse audio and visual layers.'
  },
  {
    id: 'IE-IDX-0369',
    title: 'Are designers the new SWEs? Figma Make',
    wave: 'Wave 4',
    target: 'packages/design-tokens',
    targetUrl: 'file:///y:/creative-liberation-engine/packages/design-tokens',
    rationale: 'Houses the visual design canvas to sync custom styling to local codebase changes.'
  },
  {
    id: 'IE-IDX-0375',
    title: 'Vibe coding content studio ($50k revenue)',
    wave: 'Wave 4',
    target: 'services/video-agency',
    targetUrl: 'file:///y:/creative-liberation-engine/services/video-agency',
    rationale: 'Integrates the brand Vibe Matching parameters to synchronize text tone and graphics templates.'
  }
];

export function IDEPanel({ dispatch }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [files, setFiles] = useState([]);
  const [openFile, setOpenFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'system', content: 'KADE online. Connected to Creative Liberation Engine V6. NAS target: 127.0.0.1.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const chatEndRef = useRef(null);

  // Search and Wave filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWave, setSelectedWave] = useState('All');

  // Load file tree from nexus-bridge
  useEffect(() => {
    fetch(`${BRIDGE_BASE}/api/files`)
      .then(r => r.json())
      .then(data => setFiles(data.files ?? []))
      .catch(() => setFiles([]));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { role: 'user', content: chatInput };
    setChatHistory(h => [...h, userMsg]);
    setChatInput('');
    setThinking(true);

    try {
      const res = await fetch(`${GENKIT_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: chatInput,
          context: 'cle-engine-v6',
          model: 'local:code:fast'
        })
      });
      const data = await res.json();
      const reply = data.text ?? data.output ?? data.response ?? JSON.stringify(data);
      setChatHistory(h => [...h, { role: 'assistant', content: reply }]);
    } catch (e) {
      setChatHistory(h => [...h, { role: 'system', content: `Error: ${e.message}` }]);
    } finally {
      setThinking(false);
    }
  };

  const openFileFromBridge = async (path) => {
    setOpenFile(path);
    try {
      const res = await fetch(`${BRIDGE_BASE}/api/files/read?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      setFileContent(data.content ?? '');
    } catch { setFileContent('// Error loading file'); }
    setActiveTab('editor');
  };

  const saveFileToBridge = async () => {
    if (!openFile) return;
    try {
      const res = await fetch(`${BRIDGE_BASE}/api/files/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: openFile, content: fileContent })
      });
      if (res.ok) {
        // Show temporary success feedback if needed
        console.log(`Saved ${openFile}`);
      }
    } catch (e) {
      console.error('Failed to save', e);
    }
  };

  return (
    <div className="ide-panel">
      <div className="ide-tabs">
        {['chat', 'files', 'editor', 'dispatch', 'ideations'].map(t => (
          <button key={t} className={`ide-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="ide-body">
        {activeTab === 'chat' && (
          <div className="kade-chat">
            <div className="kade-messages">
              {chatHistory.map((m, i) => (
                <div key={i} className={`kade-msg role-${m.role}`}>
                  <span className="kade-role">{m.role === 'user' ? '▷' : m.role === 'system' ? '◈' : '◻'}</span>
                  <span className="kade-content">{m.content}</span>
                </div>
              ))}
              {thinking && <div className="kade-msg role-assistant"><span className="kade-role">◻</span><span className="kade-thinking">thinking_</span></div>}
              <div ref={chatEndRef} />
            </div>
            <div className="kade-input-bar">
              <input
                className="kade-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                placeholder="Ask KADE anything about this codebase..."
              />
              <button className="kade-send" onClick={sendChat} disabled={thinking}>SEND</button>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="file-browser">
            {files.length === 0 && <div className="empty-state">Bridge offline — start nexus-bridge (port 3901)</div>}
            {files.map(f => (
              <div key={f.path} className={`file-row ${f.type}`} onClick={() => f.type === 'file' && openFileFromBridge(f.path)}>
                <span className="file-icon">{f.type === 'dir' ? '▸' : '◻'}</span>
                <span className="file-name">{f.name}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'editor' && (
          <div className="ide-editor">
            <div className="editor-toolbar">
              {openFile ? <div className="editor-filepath">{openFile}</div> : <div className="editor-filepath">No file selected</div>}
              <button className="editor-save-btn" onClick={saveFileToBridge} disabled={!openFile}>SAVE</button>
            </div>
            <textarea
              className="editor-textarea"
              value={fileContent}
              onChange={e => setFileContent(e.target.value)}
              spellCheck={false}
              disabled={!openFile}
            />
          </div>
        )}

        {activeTab === 'dispatch' && (
          <div className="dispatch-view">
            <div className="dispatch-status">
              <div className={`hud-pip ${dispatch.isConnected ? 'live' : 'dead'}`} />
              <span>Dispatch: {dispatch.isConnected ? 'LIVE' : 'OFFLINE'} — Queue: {dispatch.queueDepth}</span>
            </div>
            {dispatch.tasks.slice(0, 15).map(t => (
              <div key={t.id} className={`dispatch-row st-${t.status}`}>
                <span className="task-type">{t.type}</span>
                <span className={`task-badge st-${t.status}`}>{t.status?.toUpperCase()}</span>
                {t.agentId && <span className="task-agent">{t.agentId}</span>}
              </div>
            ))}
            {dispatch.tasks.length === 0 && <div className="empty-state">No dispatch tasks yet</div>}
          </div>
        )}

        {activeTab === 'ideations' && (
          <div className="ideations-tab-container">
            <div className="ideations-controls">
              <input
                type="text"
                className="ideations-search"
                placeholder="Search ideations by ID, title, target..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="wave-select">
                {['All', 'Wave 1', 'Wave 2', 'Wave 3', 'Wave 4'].map(w => (
                  <button
                    key={w}
                    className={`wave-btn ${selectedWave === w ? 'active' : ''}`}
                    onClick={() => setSelectedWave(w)}
                  >
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="ideations-list">
              {IDEATIONS_DATA.filter(item => {
                const matchesWave = selectedWave === 'All' || item.wave === selectedWave;
                const matchesSearch = searchQuery === '' || 
                  item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.rationale.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesWave && matchesSearch;
              }).map(item => (
                <div key={item.id} className="ideation-card">
                  <div className="ideation-header">
                    <span className="ideation-id">{item.id}</span>
                    <span className="ideation-wave-badge">{item.wave}</span>
                  </div>
                  <div className="ideation-title">{item.title}</div>
                  <div className="ideation-rationale">{item.rationale}</div>
                  <div className="ideation-footer">
                    <a 
                      href={item.targetUrl} 
                      className="ideation-target"
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (window.parent && window.parent.postMessage) {
                          window.parent.postMessage({ type: 'open_file', path: item.targetUrl }, '*');
                        }
                      }}
                    >
                      <span className="ideation-target-icon">📁</span>
                      {item.target}
                    </a>
                  </div>
                </div>
              ))}
              {IDEATIONS_DATA.filter(item => {
                const matchesWave = selectedWave === 'All' || item.wave === selectedWave;
                const matchesSearch = searchQuery === '' || 
                  item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.rationale.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesWave && matchesSearch;
              }).length === 0 && (
                <div className="empty-state">No matching consolidated ideations found</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


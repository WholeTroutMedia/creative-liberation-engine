import React, { useState, useEffect } from 'react';

const OLLAMA_BASE = `http://${window.location.hostname}:11434`;
const GENKIT_BASE = `http://${window.location.hostname}:4100`;

export function CognitiveCorePanel({ dispatch }) {
  const [activeTab, setActiveTab] = useState('models');
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [systemMetrics, setSystemMetrics] = useState({ cpu: 0, ram: 0, vram: 0, vram_total: 24576 });

  useEffect(() => {
    fetchModels();
    
    // Poll the CLE AI Runtime status
    const interval = setInterval(fetchModels, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch(`http://${window.location.hostname}:5090/api/v1/runtime/status`);
      const data = await res.json();
      setModels(data.models || []);
      if (data.system_metrics) {
        setSystemMetrics({
          cpu: data.system_metrics.cpu_load,
          ram: Math.round((data.system_metrics.ram_used_mb / 64000) * 100),
          vram: Math.round((data.system_metrics.vram_used_mb / data.system_metrics.vram_total_mb) * 100),
          vram_total: data.system_metrics.vram_total_mb
        });
      }
    } catch (err) {
      console.warn("CLE AI Runtime unreachable", err);
    } finally {
      setLoadingModels(false);
    }
  };

  const toggleModel = async (model) => {
    const action = model.state === 'loaded' ? 'unload' : 'load';
    try {
      await fetch(`http://${window.location.hostname}:5090/api/v1/runtime/models/${model.model_id}/${action}`, { method: 'POST' });
      fetchModels();
    } catch (err) {
      console.error(`Failed to ${action} model`, err);
    }
  };

  return (
    <div className="cognitive-core-panel">
      <div className="ide-tabs">
        {['models', 'resources', 'ai-assist', 'settings'].map(t => (
          <button key={t} className={`ide-tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="ide-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Core Telemetry Banner */}
        <div style={{ display: 'flex', gap: '12px', padding: '12px', background: '#111', border: '1px solid #333', borderRadius: '4px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#888' }}>CPU LOAD</div>
            <div style={{ color: systemMetrics.cpu > 80 ? '#f55' : '#5f5', fontSize: '18px' }}>{systemMetrics.cpu}%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#888' }}>SYS RAM</div>
            <div style={{ color: '#5f5', fontSize: '18px' }}>{systemMetrics.ram}%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#888' }}>VRAM LOAD</div>
            <div style={{ color: systemMetrics.vram > 90 ? '#f55' : '#5af', fontSize: '18px' }}>{systemMetrics.vram}%</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '10px', color: '#888' }}>BACKEND</div>
            <div style={{ color: '#5f5', fontSize: '18px' }}>ONLINE</div>
          </div>
        </div>

        {activeTab === 'models' && (
          <div className="models-view" style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>Local Inference Models</h3>
              <button onClick={fetchModels} style={{ background: '#222', border: '1px solid #444', color: '#ddd', padding: '4px 8px', cursor: 'pointer' }}>
                {loadingModels ? 'SCANNING...' : 'REFRESH'}
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {models.map(m => (
                <div key={m.model_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px' }}>
                  <div>
                    <div style={{ color: m.state === 'loaded' ? '#5f5' : '#5af', fontWeight: 'bold' }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      {m.provider.toUpperCase()} • {m.state.toUpperCase()} {m.state === 'loaded' ? `• ${(m.vram_usage_mb / 1024).toFixed(1)}GB VRAM` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#ccc' }}>{m.size_gb.toFixed(1)} GB</div>
                    <button onClick={() => toggleModel(m)} style={{ background: m.state === 'loaded' ? '#333' : 'transparent', border: m.state === 'loaded' ? '1px solid #555' : '1px solid #5af', color: m.state === 'loaded' ? '#aaa' : '#5af', padding: '2px 8px', marginTop: '4px', fontSize: '10px', cursor: 'pointer' }}>
                      {m.state === 'loaded' ? 'UNLOAD' : 'LOAD'}
                    </button>
                  </div>
                </div>
              ))}
              {models.length === 0 && !loadingModels && <div style={{ color: '#888' }}>No models found locally.</div>}
            </div>
          </div>
        )}

        {activeTab === 'ai-assist' && (
          <div className="assist-view" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#fff' }}>Agentic Code Intelligence</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px' }}>
                <div style={{ color: '#5f5', marginBottom: '8px' }}>Code Review Engine</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>Automated static analysis and security auditing powered by local LLMs.</div>
                <button style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>Configure</button>
              </div>
              <div style={{ padding: '16px', background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px' }}>
                <div style={{ color: '#5af', marginBottom: '8px' }}>Visual Debugger</div>
                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '12px' }}>Trace execution paths and variable states visually with AI assistance.</div>
                <button style={{ background: '#333', color: '#fff', border: 'none', padding: '6px 12px', cursor: 'pointer' }}>Configure</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="resources-view" style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#fff' }}>Resource Allocation Matrix</h3>
            <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>Manage dedicated compute for individual agent Swarms.</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['KADE', 'ATHENA', 'BOLT', 'VERA'].map(agent => (
                <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px', background: '#111', border: '1px solid #222' }}>
                  <div style={{ width: '80px', color: '#ddd' }}>{agent}</div>
                  <div style={{ flex: 1, height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.random() * 60 + 10}%`, background: '#5af' }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#888', width: '40px', textAlign: 'right' }}>Priority</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-view" style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#fff' }}>System Configuration</h3>
            <div style={{ fontSize: '12px', color: '#aaa' }}>
              <p>Ollama Endpoint: <input type="text" defaultValue={OLLAMA_BASE} style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '4px', width: '200px' }} /></p>
              <p>Genkit API: <input type="text" defaultValue={GENKIT_BASE} style={{ background: '#000', border: '1px solid #333', color: '#fff', padding: '4px', width: '200px' }} /></p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

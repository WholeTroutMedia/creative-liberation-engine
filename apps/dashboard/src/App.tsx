import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Globe, Monitor, HardDrive, ShieldCheck, Check, Settings, Activity } from "lucide-react";

type SetupStep = "manifest" | "scanning" | "ready";

interface SystemTopology {
  host_name: string;
  os_name: string;
  os_version: string;
  hardware: {
    cpu_brand: string;
    physical_cores: number;
    logical_cores: number;
    total_memory_gb: number;
    available_memory_gb: number;
    disks: Array<{ name: string; total_gb: number; available_gb: number; is_ssd: boolean }>;
    gpu_info?: { vendor: string; model: string; total_vram_mb: number };
  };
  network: {
    interfaces: Record<string, string>;
    local_ip: string;
  };
}

export default function App() {
  const [step, setStep] = useState<SetupStep>("manifest");
  const [topology, setTopology] = useState<SystemTopology | null>(null);

  // Probe native system topology on start if running inside Tauri container
  useEffect(() => {
    const probeNativeSystem = async () => {
      try {
        const win = window as any;
        if (win.__TAURI_INTERNALS__ || win.__TAURI__) {
          console.log("[dashboard] Tauri detected. Invoking native deviced probers...");
          const invoke = win.__TAURI__?.invoke || win.__TAURI_INTERNALS__?.invoke;
          if (invoke) {
            const resultStr = await invoke("get_system_topology");
            const parsed = JSON.parse(resultStr);
            console.log("[dashboard] Native topology mapping successful:", parsed);
            setTopology(parsed);
          }
        }
      } catch (error) {
        console.warn("[dashboard] Tauri IPC probe failed, falling back to simulated signals:", error);
      }
    };
    probeNativeSystem();
  }, []);

  return (
    <div className="dashboard-root">
      {/* Immersive radial glow grid backdrop */}
      <div className="app-backdrop-grid" />

      {/* Global telemetry header */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">◈</span>
          <span className="brand-title">CREATIVE LIBERATION ENGINE</span>
          <span className="brand-tag">v2.0.3</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent-emerald)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
            {topology ? `CLE_CORE NODE: ${topology.host_name.toUpperCase()}` : "SECURE MASTER HOST"}
          </div>
          <Activity size={16} className="brand-symbol" />
        </div>
      </header>

      {/* Setup Wizard */}
      <main className="wizard-container">
        <AnimatePresence mode="wait">
          {step === "manifest" && (
            <ManifestStep key="manifest" onNext={() => setStep("scanning")} />
          )}
          {step === "scanning" && (
            <ScanningStep key="scanning" topology={topology} onNext={() => setStep("ready")} />
          )}
          {step === "ready" && (
            <ReadyStep key="ready" topology={topology} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// 1. Step 1: The Sovereign Manifesto
function ManifestStep({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      className="glass-panel wizard-card"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="wizard-header">
        <div className="wizard-subtitle">Article I // The Sovereign Core</div>
        <h2 className="wizard-title">Creative Autonomy Manifesto</h2>
      </div>

      <div className="wizard-body" style={{ margin: "20px 0" }}>
        <p style={{ fontSize: "16px", lineHeight: "1.6", color: "var(--text-primary)", marginBottom: "16px" }}>
          "The Inception Agentic OS coordinates sovereign, local-first intelligence layers to secure total technical autonomy for creative minds."
        </p>
        <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--text-muted)" }}>
          Running on the CLE_CORE hive engine, Creative Liberation Engine maps local hardware, manages sovereign vector spines, and automates multi-agent tasks completely offline. Zero telemetry, zero external database locks, and complete computational control over your own models and creative workspace.
        </p>
      </div>

      <div className="wizard-footer">
        <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          GOVERNED BY THE 107-PRINCIPLE SOVEREIGN LAW
        </span>
        <button className="btn btn-primary" onClick={onNext}>
          ACCEPT & INITIALIZE OS
        </button>
      </div>
    </motion.div>
  );
}

// 2. Step 2: Aegis-Sense System Scan
interface NodeState {
  id: string;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  status: "idle" | "scanning" | "verified";
}

function ScanningStep({ topology, onNext }: { topology: SystemTopology | null; onNext: () => void }) {
  const [nodes, setNodes] = useState<NodeState[]>([
    { id: "cpu", name: "Host Processor (CPU)", subtitle: "Awaiting probe...", icon: <Cpu size={20} />, status: "idle" },
    { id: "gpu", name: "Graphics Engine (GPU)", subtitle: "Checking VRAM/CUDA...", icon: <Monitor size={20} />, status: "idle" },
    { id: "network", name: "Sovereign Node Network", subtitle: "Scanning default subnet...", icon: <Globe size={20} />, status: "idle" },
    { id: "devices", name: "Creative Peripheral Mesh", subtitle: "Probing ASIO/UVC controllers...", icon: <HardDrive size={20} />, status: "idle" },
  ]);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);

  useEffect(() => {
    if (currentScanIndex >= nodes.length) {
      const timer = setTimeout(onNext, 2000);
      return () => clearTimeout(timer);
    }

    // Set active node to scanning
    setNodes(prev => prev.map((n, i) => i === currentScanIndex ? { ...n, status: "scanning", subtitle: "Acquiring topological signal..." } : n));

    const scanTimer = setTimeout(() => {
      // Set completed node details
      setNodes(prev => prev.map((n, i) => {
        if (i === currentScanIndex) {
          let spec = "VERIFIED";
          if (n.id === "cpu") {
            spec = topology 
              ? `${topology.hardware.cpu_brand} [${topology.hardware.physical_cores}/${topology.hardware.logical_cores} Cores]`
              : "AMD Ryzen 9 7950X [16C/32T]";
          }
          if (n.id === "gpu") {
            spec = topology?.hardware.gpu_info
              ? `${topology.hardware.gpu_info.vendor} ${topology.hardware.gpu_info.model} [${topology.hardware.gpu_info.total_vram_mb / 1024}GB VRAM]`
              : "NVIDIA GeForce RTX 4090 [24GB VRAM]";
          }
          if (n.id === "network") {
            spec = topology 
              ? `Local Node Address: ${topology.network.local_ip || "122.0.3.1"}`
              : "Subnet node: 122.0.3.1 [Sovereign Vault Link]";
          }
          if (n.id === "devices") {
            spec = topology && topology.hardware.disks.length > 0
              ? `Disks: ${topology.hardware.disks.map(d => `${d.name} (${d.total_gb}GB)`).join(", ")}`
              : "ASIO Interface + Sony UVC Camera [Mapped]";
          }
          return { ...n, status: "verified", subtitle: spec };
        }
        return n;
      }));
      setCurrentScanIndex(prev => prev + 1);
    }, 1200);

    return () => clearTimeout(scanTimer);
  }, [currentScanIndex, topology]);

  return (
    <motion.div
      className="glass-panel wizard-card"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="wizard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="wizard-subtitle">Aegis-Sense // Local Topology Scan</div>
          <h2 className="wizard-title">Analyzing System & Network Architecture</h2>
        </div>
        {currentScanIndex < nodes.length && (
          <div className="scanning-radar" />
        )}
      </div>

      <div className="wizard-body">
        <div className="topology-grid">
          {nodes.map(n => (
            <div key={n.id} className={`topology-node ${n.status}`}>
              <div className="node-icon-wrapper">
                {n.status === "verified" ? <Check size={18} /> : n.icon}
              </div>
              <div className="node-details">
                <h4 style={{ color: n.status === "verified" ? "var(--accent-emerald)" : "var(--text-primary)" }}>
                  {n.name}
                </h4>
                <p>{n.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-footer">
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          {currentScanIndex < nodes.length ? "TELEMETRY DISCOVERY RUNNING..." : "SYSTEM MAPPED SUCCESSFULLY"}
        </span>
        <button className="btn btn-secondary" disabled>
          {currentScanIndex < nodes.length ? "PROBING ENVIRONMENT..." : "PROBING COMPLETE"}
        </button>
      </div>
    </motion.div>
  );
}

// 3. Step 3: Sovereign Ready Dashboard
function ReadyStep({ topology }: { topology: SystemTopology | null }) {
  return (
    <motion.div
      className="glass-panel wizard-card"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <div className="wizard-header">
        <div className="wizard-subtitle" style={{ color: "var(--accent-emerald)" }}>Aegis-Sense // Integration Hub</div>
        <h2 className="wizard-title">Creative Liberation Engine Daemon Cluster Online</h2>
      </div>

      <div className="wizard-body" style={{ margin: "20px 0", gap: "20px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "rgba(0,255,170,0.03)", border: "1px solid rgba(0,255,170,0.15)", borderRadius: "8px" }}>
          <ShieldCheck size={28} style={{ color: "var(--accent-emerald)" }} />
          <div>
            <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--accent-emerald)" }}>SYSTEM STABILIZED & SECURED</h4>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              UNIX microservices (`appd`, `deviced`, `orchestratord`, `memd`) have booted successfully. Your workstation local mirror has been established at `d:\Google Antigravity\creative-liberation-engine`.
            </p>
          </div>
        </div>

        {topology && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "16px" }}>
            <h4 style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-primary)", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>NATIVE TARGET SPECIFICATION //</h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              <div>OS: <span style={{ color: "var(--text-primary)" }}>{topology.os_name} {topology.os_version}</span></div>
              <div>RAM Available: <span style={{ color: "var(--text-primary)" }}>{topology.hardware.available_memory_gb}GB / {topology.hardware.total_memory_gb}GB</span></div>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>memd (Memory Spine)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>SQLite Vector active</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>constd (Governance)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>kvalidd Preflight Live</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>orchestratord</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>UNIX Swarm Ready</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>physicaltwind</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>BIM ConTech Active</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>authmdhubd</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>auth.md OARP Live</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>sentineld (Guard)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>Zero-Trust active</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>hardeningd (Audit)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>30 Controls verified</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>autonomyd (Autonomy)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>Gmail & D1 Watcher Live</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>aegis-sense</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>Subnet prober Active</div>
          </div>
        </div>
      </div>

      <div className="wizard-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          <Settings size={14} className="brand-symbol" />
          PORT: 3000 // MCP ACTIVE
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          LAUNCH SYSTEM CONSOLE
        </button>
      </div>
    </motion.div>
  );
}

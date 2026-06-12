"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const react_1 = __importStar(require("react"));
const framer_motion_1 = require("framer-motion");
const lucide_react_1 = require("lucide-react");
function App() {
    const [step, setStep] = (0, react_1.useState)("manifest");
    return (<div className="dashboard-root">
      {/* Immersive radial glow grid backdrop */}
      <div className="app-backdrop-grid"/>

      {/* Global telemetry header */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">◈</span>
          <span className="brand-title">CREATIVE LIBERATION OS</span>
          <span className="brand-tag">v2.0.3</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--accent-emerald)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent-emerald)" }}/>
            SECURE LOCAL HOST
          </div>
          <lucide_react_1.Activity size={16} className="brand-symbol"/>
        </div>
      </header>

      {/* Setup Wizard */}
      <main className="wizard-container">
        <framer_motion_1.AnimatePresence mode="wait">
          {step === "manifest" && (<ManifestStep key="manifest" onNext={() => setStep("scanning")}/>)}
          {step === "scanning" && (<ScanningStep key="scanning" onNext={() => setStep("ready")}/>)}
          {step === "ready" && (<ReadyStep key="ready"/>)}
        </framer_motion_1.AnimatePresence>
      </main>
    </div>);
}
// 1. Step 1: The Sovereign Manifesto
function ManifestStep({ onNext }) {
    return (<framer_motion_1.motion.div className="glass-panel wizard-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      <div className="wizard-header">
        <div className="wizard-subtitle">Article 0 // Foundational Contract</div>
        <h2 className="wizard-title">Sacred Mission of Human Creativity</h2>
      </div>

      <div className="wizard-body" style={{ margin: "20px 0" }}>
        <p style={{ fontSize: "16px", lineHeight: "1.6", color: "var(--text-primary)", marginBottom: "16px" }}>
          "The Creative Liberation Engine exists to liberate human creative and intellectual potential from systems of extraction and dependency."
        </p>
        <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--text-muted)" }}>
          A handful of centralized monopolies control the cloud, training models on your raw creative labor and renting your own capability back to you. We reject this. Creative Liberation Engine runs entirely on your own local GPU, manages memory in your vector spine, and ensures that proprietary content never leaves your boundary.
        </p>
      </div>

      <div className="wizard-footer">
        <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          GOVERNED BY A 20-ARTICLE CONSTITUTION
        </span>
        <button className="btn btn-primary" onClick={onNext}>
          ACCEPT & LAND ON SYSTEM
        </button>
      </div>
    </framer_motion_1.motion.div>);
}
function ScanningStep({ onNext }) {
    const [nodes, setNodes] = (0, react_1.useState)([
        { id: "cpu", name: "Host Processor (CPU)", subtitle: "Awaiting probe...", icon: <lucide_react_1.Cpu size={20}/>, status: "idle" },
        { id: "gpu", name: "Graphics Engine (GPU)", subtitle: "Checking VRAM/CUDA...", icon: <lucide_react_1.Monitor size={20}/>, status: "idle" },
        { id: "network", name: "Sovereign Node Network", subtitle: "Scanning default subnet...", icon: <lucide_react_1.Globe size={20}/>, status: "idle" },
        { id: "devices", name: "Creative Peripheral Mesh", subtitle: "Probing ASIO/UVC controllers...", icon: <lucide_react_1.HardDrive size={20}/>, status: "idle" },
    ]);
    const [currentScanIndex, setCurrentScanIndex] = (0, react_1.useState)(0);
    (0, react_1.useEffect)(() => {
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
                    if (n.id === "cpu")
                        spec = "AMD Ryzen 9 [32 Logical Cores]";
                    if (n.id === "gpu")
                        spec = "NVIDIA RTX 4090 [24GB VRAM]";
                    if (n.id === "network")
                        spec = "122.0.3.1 [Synology NAS Vault Connected]";
                    if (n.id === "devices")
                        spec = "ASIO Interface + Sony UVC Camera";
                    return { ...n, status: "verified", subtitle: spec };
                }
                return n;
            }));
            setCurrentScanIndex(prev => prev + 1);
        }, 1800);
        return () => clearTimeout(scanTimer);
    }, [currentScanIndex]);
    return (<framer_motion_1.motion.div className="glass-panel wizard-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      <div className="wizard-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div className="wizard-subtitle">Aegis-Sense // Local Topology Scan</div>
          <h2 className="wizard-title">Analyzing System & Network Architecture</h2>
        </div>
        {currentScanIndex < nodes.length && (<div className="scanning-radar"/>)}
      </div>

      <div className="wizard-body">
        <div className="topology-grid">
          {nodes.map(n => (<div key={n.id} className={`topology-node ${n.status}`}>
              <div className="node-icon-wrapper">
                {n.status === "verified" ? <lucide_react_1.Check size={18}/> : n.icon}
              </div>
              <div className="node-details">
                <h4 style={{ color: n.status === "verified" ? "var(--accent-emerald)" : "var(--text-primary)" }}>
                  {n.name}
                </h4>
                <p>{n.subtitle}</p>
              </div>
            </div>))}
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
    </framer_motion_1.motion.div>);
}
// 3. Step 3: Sovereign Ready Dashboard
function ReadyStep() {
    return (<framer_motion_1.motion.div className="glass-panel wizard-card" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, ease: "easeOut" }}>
      <div className="wizard-header">
        <div className="wizard-subtitle" style={{ color: "var(--accent-emerald)" }}>Aegis-Sense // Integration Hub</div>
        <h2 className="wizard-title">Sovereign OS Daemon Cluster Online</h2>
      </div>

      <div className="wizard-body" style={{ margin: "20px 0", gap: "20px", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px", background: "rgba(0,255,170,0.03)", border: "1px solid rgba(0,255,170,0.15)", borderRadius: "8px" }}>
          <lucide_react_1.ShieldCheck size={28} style={{ color: "var(--accent-emerald)" }}/>
          <div>
            <h4 style={{ fontSize: "15px", fontWeight: "600", color: "var(--accent-emerald)" }}>SYSTEM STABILIZED & SECURED</h4>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "2px" }}>
              UNIX microservices (`appd`, `deviced`, `orchestratord`, `memd`) have booted successfully. Your workstation local mirror has been established at `d:\Google Antigravity\creative-liberation-engine`.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>memd (Memory API)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>SQLite Spine Active</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>constd (Governance)</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>kvalidd Preflight Live</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "6px", padding: "12px" }}>
            <span style={{ color: "var(--primary-light)" }}>orchestratord</span>
            <div style={{ color: "var(--text-muted)", marginTop: "4px" }}>UNIX Workers Ready</div>
          </div>
        </div>
      </div>

      <div className="wizard-footer">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
          <lucide_react_1.Settings size={14} className="brand-symbol"/>
          PORT: 3000 // MCP ACTIVE
        </div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          LAUNCH SYSTEM CONSOLE
        </button>
      </div>
    </framer_motion_1.motion.div>);
}
//# sourceMappingURL=App.js.map
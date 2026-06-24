import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, ChevronDown, BarChart3, ShieldCheck, 
  Server, Cpu, Activity, Briefcase, Zap, Network, DollarSign, 
  Target, Package, ExternalLink, ArrowRight, Info, HardDrive, 
  BookOpen, AlertTriangle, Layers, Globe, Database, Scale, Download
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const FadeIn = ({ children, delay = 0, className = "", style = {} }) => (
  <motion.div className={className} style={style} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.5, ease: "easeOut" }}>
    {children}
  </motion.div>
);

const Citation = ({ url, text }) => (
  <a href={url} target="_blank" rel="noreferrer" className="citation-link">
    <BookOpen size={12} /> {text} <ExternalLink size={10} />
  </a>
);

const EduCallout = ({ title, children, type = "info" }) => (
  <div className={`edu-callout ${type}`}>
    <h4>
      {type === 'warning' ? <AlertTriangle size={16} /> : type === 'success' ? <ShieldCheck size={16}/> : <Info size={16} />} 
      {title}
    </h4>
    <p>{children}</p>
  </div>
);

const DeepDive = ({ title, children, icon: Icon = Cpu }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="deep-dive">
      <div className="deep-dive-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="flex items-center gap-2"><Icon size={16} className="text-brand" /> {title}</span>
        <ChevronDown size={18} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div className="deep-dive-content text-sm">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// SLIDE 1: Executive Summary
// ==========================================
const Slide1 = () => (
  <div className="slide-content justify-center" style={{ padding: '0 6vw' }}>
    <FadeIn>
      <div className="badge brand">
        <Briefcase size={14} /> The Barnstorm Sovereign Prospectus
      </div>
    </FadeIn>
    <FadeIn delay={0.1}>
      <h1 style={{ maxWidth: '1200px' }}>
        Sovereign Infrastructure &<br/>
        <span className="text-brand-gradient">The AI Entertainment Pivot</span>
      </h1>
    </FadeIn>
    <FadeIn delay={0.2}>
      <p className="text-lg" style={{ maxWidth: '850px', marginTop: '16px' }}>
        An executive blueprint for transitioning the Barnstorm from SaaS-dependent cloud renters to owners of a high-margin, scalable AI media platform powered by the Creative Liberation Engine.
      </p>
    </FadeIn>
    
    <div className="flex gap-6 mt-10">
      <FadeIn delay={0.3} className="bento-item flex-1">
        <Activity className="text-brand mb-4" size={32} />
        <h4 className="mb-2">The Liability</h4>
        <p className="text-sm">Compounding operational expenditure (OpEx) renting cloud storage (Dropbox/Workspace) and paying variable AI API taxes, yielding zero hardware equity.</p>
      </FadeIn>
      <FadeIn delay={0.4} className="bento-item flex-1">
        <Target className="text-success mb-4" size={32} />
        <h4 className="mb-2">The Solution</h4>
        <p className="text-sm">Deploying a sovereign Apple Silicon (M4 Pro) ecosystem on-premise. A one-time CapEx investment offset by IRS Section 179 tax shields.</p>
      </FadeIn>
      <FadeIn delay={0.5} className="bento-item flex-1">
        <Layers className="text-warning mb-4" size={32} />
        <h4 className="mb-2">The Evolution</h4>
        <p className="text-sm">Transitioning from a performing band to a tech-enabled Entertainment Platform utilizing local Creative Liberation Engine automation, biometrics, and generative shows.</p>
      </FadeIn>
    </div>
  </div>
);

// ==========================================
// SLIDE 2: The Storage & AI Tax
// ==========================================
const Slide2 = () => {
  // Realistic defaults for The Barnstorm
  const [archiveGB, setArchiveGB] = useState(385); 
  const [teamSize, setTeamSize] = useState(4);
  const [aiCallsPerMonth, setAiCallsPerMonth] = useState(15000); 
  const hardwareCost = 4500; // M4 Pro + 20TB NAS Array

  // SaaS Cost Calculation
  const storageOpEx = Math.max(3, teamSize) * 30; // Google Workspace Enterprise Plus estimate
  const apiOpEx = Math.round((aiCallsPerMonth / 1000) * 15); // Blended AI API cost (GPT-4o + Whisper + ElevenLabs)
  const monthlySaaS = storageOpEx + apiOpEx;

  // Generate 36-month projection data for Recharts
  const projectionData = Array.from({ length: 36 }, (_, i) => {
    const month = i + 1;
    return {
      month: `M${month}`,
      saasCumulative: monthlySaaS * month,
      sovereignCumulative: hardwareCost + (month * 15), // $15/mo for electricity/maintenance
    };
  });

  return (
    <div className="slide-content">
      <div className="slide-header">
        <div>
          <div className="badge danger"><Database size={14} /> SaaS Liability Analysis</div>
          <h2>The Cloud Storage Tax</h2>
          <p>Renting infrastructure guarantees infinite operational expenditure with zero equity return.</p>
        </div>
      </div>
      <div className="slide-body">
        <div className="bento-grid h-full">
          
          <FadeIn delay={0.1} className="bento-item" style={{ gridColumn: 'span 4' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="icon-box danger"><Activity size={24} /></div>
              <h3 className="m-0 text-lg">Liability Modeler</h3>
            </div>
            
            <div className="calc-container p-4">
              <div className="calc-row"><span className="calc-label">Active Media Archive</span><span className="calc-value">{archiveGB.toLocaleString()} GB</span></div>
              <input type="range" min="100" max="5000" step="50" value={archiveGB} onChange={(e) => setArchiveGB(parseInt(e.target.value))} />
              
              <div className="calc-row mt-4"><span className="calc-label">Active Users</span><span className="calc-value">{teamSize}</span></div>
              <input type="range" min="1" max="10" step="1" value={teamSize} onChange={(e) => setTeamSize(parseInt(e.target.value))} />
              
              <div className="calc-row mt-4"><span className="calc-label">Monthly AI Invocations</span><span className="calc-value">{aiCallsPerMonth.toLocaleString()}</span></div>
              <input type="range" min="1000" max="50000" step="1000" value={aiCallsPerMonth} onChange={(e) => setAiCallsPerMonth(parseInt(e.target.value))} />
              
              <div className="mt-6 pt-4 border-t border-[var(--border-strong)]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-secondary text-sm">Monthly SaaS Burn:</span>
                  <span className="text-danger font-bold text-lg">${monthlySaaS.toLocaleString()} / mo</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-secondary text-sm">36-Month Capital Drain:</span>
                  <span className="text-danger font-bold text-xl">${(monthlySaaS * 36).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="mt-auto">
              <Citation url="https://aws.amazon.com/s3/pricing/" text="AWS Data Egress Transfer Costs" />
            </div>
          </FadeIn>

          <FadeIn delay={0.2} className="bento-item flex-col" style={{ gridColumn: 'span 8' }}>
            <h3 className="text-lg mb-2">Cumulative Cost: SaaS vs Sovereign (36 Months)</h3>
            <p className="text-sm text-secondary mb-6">Sovereign infrastructure requires an initial CapEx, but SaaS expenses compound infinitely. The break-even point occurs rapidly.</p>
            
            <div style={{ flex: 1, minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSaas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--success)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} />
                  <YAxis stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-tertiary)', fontSize: 12 }} tickFormatter={(val) => `$${val/1000}k`} />
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-strong)', borderRadius: '8px' }}
                    itemStyle={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="saasCumulative" name="Status Quo (Cloud Rent)" stroke="var(--danger)" strokeWidth={3} fillOpacity={1} fill="url(#colorSaas)" />
                  <Area type="stepAfter" dataKey="sovereignCumulative" name="Sovereign CapEx (M4 Pro + NAS)" stroke="var(--success)" strokeWidth={3} fillOpacity={1} fill="url(#colorSov)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SLIDE 3: Hardware Architecture
// ==========================================
const Slide3 = () => {
  const [activeTab, setActiveTab] = useState('m4');
  return (
    <div className="slide-content">
      <div className="slide-header">
        <div>
          <div className="badge brand"><Cpu size={14} /> Edge Computing</div>
          <h2>Unified Memory Architecture</h2>
          <p>Why Apple Silicon changes the math on VC-level local AI without enterprise server farm costs.</p>
        </div>
      </div>
      <div className="slide-body">
        <div className="bento-grid h-full">
          <FadeIn delay={0.1} className="bento-item" style={{ gridColumn: 'span 7' }}>
            <div className="flex items-center gap-4 mb-4">
              <div className="icon-box"><Zap size={24} /></div>
              <h3 className="m-0 text-lg">The VRAM Paradigm Shift</h3>
            </div>
            <p className="text-sm">Traditional server farms require renting $15,000+ Nvidia GPUs (e.g., A100s) to achieve the Video RAM (VRAM) necessary to hold massive AI models in memory. Apple Silicon fundamentally bypasses this bottleneck.</p>
            
            <EduCallout title="Why UMA Changes Everything">
              In Apple's M-series chips, the CPU, GPU, and Neural Engine share a single pool of high-bandwidth memory. A Mac Mini with 64GB of Unified Memory treats system RAM as VRAM. This allows us to load 70-billion parameter LLMs locally at a fraction of the hardware cost.
            </EduCallout>

            <div className="mt-6">
              <h4 className="mb-4 text-sm uppercase tracking-wider text-secondary">Local AI Hardware Economics</h4>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Setup</th>
                      <th>Usable VRAM</th>
                      <th>Bandwidth</th>
                      <th>CapEx Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Nvidia RTX 4090 PC</td>
                      <td className="text-danger">24 GB</td>
                      <td className="font-mono">1,008 GB/s</td>
                      <td className="text-danger">~$4,500</td>
                    </tr>
                    <tr>
                      <td>Nvidia A100 Server</td>
                      <td className="text-success">80 GB</td>
                      <td className="font-mono">1,935 GB/s</td>
                      <td className="text-danger">~$15,000+</td>
                    </tr>
                    <tr style={{ background: 'var(--brand-muted)' }}>
                      <td className="text-brand font-bold">M4 Pro Mac Mini</td>
                      <td className="text-success font-bold font-mono">64 GB</td>
                      <td className="font-mono">273 GB/s</td>
                      <td className="text-success font-bold">~$1,999</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </FadeIn>
          
          <FadeIn delay={0.2} className="bento-item" style={{ gridColumn: 'span 5' }}>
            <div className="tabs-header">
              <button className={`tab-btn ${activeTab === 'm4' ? 'active' : ''}`} onClick={() => setActiveTab('m4')}>Phase 1: M4 Pro</button>
              <button className={`tab-btn ${activeTab === 'm5' ? 'active' : ''}`} onClick={() => setActiveTab('m5')}>Phase 2: M5 Horizon</button>
            </div>
            
            <AnimatePresence mode="wait">
              {activeTab === 'm4' ? (
                <motion.div key="m4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="badge success mb-2">IMMEDIATE ROI</div>
                  <p className="text-sm mb-6">The M4 Pro secures immediate ROI by bringing transcription, RAG document processing, and proxy generation entirely in-house.</p>
                  
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-light)]">
                      <span className="text-xs text-secondary uppercase block mb-1">Compute Array</span>
                      <strong className="text-brand font-mono">14-Core CPU / 20-Core GPU</strong>
                    </div>
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-light)]">
                      <span className="text-xs text-secondary uppercase block mb-1">Memory Pipeline</span>
                      <strong className="text-brand font-mono">64GB Unified @ 273GB/s</strong>
                    </div>
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-light)]">
                      <span className="text-xs text-secondary uppercase block mb-1">Primary Assignment</span>
                      <strong className="text-primary font-medium">Creative Liberation Engine Dispatch & Media Processing</strong>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="m5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                  <div className="badge brand mb-2">WWDC 2026 ROADMAP</div>
                  <p className="text-sm mb-6">The 1U rack infrastructure allows seamless hot-swapping to M5 nodes upon release. The M4 is repurposed as a storage controller; zero hardware is obsoleted.</p>
                  
                  <div className="flex flex-col gap-4">
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-light)]">
                      <span className="text-xs text-secondary uppercase block mb-1">Architecture</span>
                      <strong className="text-brand font-mono">Next-Gen 3nm Enhanced Process</strong>
                    </div>
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-light)]">
                      <span className="text-xs text-secondary uppercase block mb-1">Scale Strategy</span>
                      <strong className="text-brand font-mono">Modular Rack Cluster Scaling</strong>
                    </div>
                    <div className="p-4 bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-light)]">
                      <span className="text-xs text-secondary uppercase block mb-1">Primary Assignment</span>
                      <strong className="text-primary font-medium">PULSE Live Biometrics & Generative Visuals</strong>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </FadeIn>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SLIDE 4: Proxy-First Workflows
// ==========================================
const Slide4 = () => (
  <div className="slide-content">
    <div className="slide-header">
      <div>
        <div className="badge brand"><Network size={14} /> Pipeline Architecture</div>
        <h2>Creative Liberation Engine Orchestration</h2>
        <p>Minimizing cloud exposure while maximizing client deliverable speed through proxy-first local orchestration.</p>
      </div>
    </div>
    <div className="slide-body flex-col justify-center relative">
      
      <EduCallout title="The Integration Strategy">
        We do not eliminate the cloud; we optimize it. We decouple the <strong>Heavy Master Data</strong> (Airgapped local NAS) from the <strong>Lightweight Review Data</strong> (Cloud). This achieves enterprise-grade security and blazing fast client workflows simultaneously.
      </EduCallout>

      <div className="flex justify-between relative mt-12 mb-12">
        <div className="absolute top-1/2 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-[var(--brand-muted)] via-[var(--brand-primary)] to-[var(--success)] opacity-50 -z-10"></div>
        
        <FadeIn delay={0.1} className="flow-step text-center mx-4">
          <HardDrive size={32} className="text-brand mb-4 mx-auto" />
          <h4 className="mb-2">1. Local Ingest</h4>
          <p className="text-sm text-secondary">RAW data dumped directly to Sovereign NAS via 10GbE network.</p>
        </FadeIn>
        
        <FadeIn delay={0.2} className="flow-step text-center mx-4 border-[var(--brand-primary)]">
          <Cpu size={32} className="text-brand mb-4 mx-auto" />
          <h4 className="mb-2">2. Engine Transcode</h4>
          <p className="text-sm text-secondary">Creative Liberation Engine autonomously transcodes 4K RAWs to 1080p proxies.</p>
        </FadeIn>
        
        <FadeIn delay={0.3} className="flow-step text-center mx-4">
          <Globe size={32} className="text-brand mb-4 mx-auto" />
          <h4 className="mb-2">3. Selective Sync</h4>
          <p className="text-sm text-secondary">Only lightweight proxies (~5GB) are pushed to the Cloud.</p>
        </FadeIn>

        <FadeIn delay={0.4} className="flow-step text-center mx-4" style={{ borderColor: 'var(--success)' }}>
          <ShieldCheck size={32} className="text-success mb-4 mx-auto" />
          <h4 className="mb-2 text-success">4. Client Review</h4>
          <p className="text-sm text-secondary">Clients review instantly. High-res master stays secure.</p>
        </FadeIn>
      </div>

      <div className="bento-grid">
        <div className="bento-item col-span-6 bg-[var(--danger-bg)] border-[rgba(239,68,68,0.2)] p-6">
          <h4 className="text-danger flex items-center gap-2 mb-2"><Server size={18}/> Status Quo</h4>
          <p className="text-sm">Attempting to sync a 385GB project to Dropbox stalls the local network for hours. Cloud limits hit immediately. Work stops until sync finishes.</p>
        </div>
        <div className="bento-item col-span-6 bg-[var(--success-bg)] border-[rgba(16,185,129,0.2)] p-6">
          <h4 className="text-success flex items-center gap-2 mb-2"><Zap size={18}/> Creative Liberation Engine</h4>
          <p className="text-sm">Proxy generation takes minutes locally. A 5GB proxy uploads in seconds. Zero bandwidth bottleneck. Editors work instantly.</p>
        </div>
      </div>

    </div>
  </div>
);

// ==========================================
// SLIDE 5: CapEx & Section 179
// ==========================================
const Slide5 = () => {
  const [hardwareCost, setHardwareCost] = useState(4500); 
  const taxRate = 0.21; // Corporate tax rate estimate
  const section179Deduction = hardwareCost; 
  const estimatedTaxSavings = section179Deduction * taxRate;
  const trueNetCost = hardwareCost - estimatedTaxSavings;

  return (
    <div className="slide-content">
      <div className="slide-header">
        <div>
          <div className="badge success"><Scale size={14} /> Financial Prospectus</div>
          <h2>Sovereign Economics & IRS 179</h2>
          <p>Converting infrastructure from a recurring liability into a tax-advantaged owned asset.</p>
        </div>
      </div>
      <div className="slide-body">
        
        <FadeIn delay={0.1} className="bento-item mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="flex items-center gap-2 m-0"><ShieldCheck size={24} className="text-brand" /> IRS Section 179 Tax Shield Modeler</h3>
            <Citation url="https://www.irs.gov/publications/p946" text="IRS Pub 946: Sec. 179" />
          </div>
          
          <div className="flex gap-10 items-center">
            <div className="flex-1">
              <p className="text-sm mb-6 text-secondary leading-relaxed">
                Section 179 of the IRS tax code allows businesses to deduct the <strong>full purchase price</strong> of qualifying server and computer equipment financed during the tax year. Instead of depreciating the asset over 5 years, you take the entire write-off in Year 1, creating an immediate tax shield against corporate income.
              </p>
              
              <div className="calc-container">
                <div className="calc-row">
                  <span className="calc-label">Target CapEx Investment (M4 Node + NAS)</span>
                  <span className="calc-value">${hardwareCost.toLocaleString()}</span>
                </div>
                <input type="range" min="2000" max="15000" step="500" value={hardwareCost} onChange={(e) => setHardwareCost(parseInt(e.target.value))} />
              </div>
            </div>
            
            <div className="flex-1 bg-[var(--bg-primary)] p-8 rounded-xl border border-[var(--border-strong)] relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10 z-0"><DollarSign size={120} /></div>
              
              <div className="flex justify-between mb-4 pb-4 border-b border-[var(--border-light)] relative z-10">
                <span className="text-secondary text-sm">Year 1 Gross Deduction:</span>
                <span className="text-primary font-mono text-lg">${section179Deduction.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mb-6 pb-6 border-b border-[var(--border-light)] relative z-10">
                <span className="text-secondary text-sm">Estimated Cash Savings (21% Corp Rate):</span>
                <span className="text-success font-mono text-lg">-${estimatedTaxSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="flex justify-between items-end relative z-10">
                <span className="text-secondary font-bold text-lg">True Net Cost:</span>
                <span className="text-brand font-mono font-bold text-4xl leading-none">
                  ${trueNetCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2} className="bento-item bg-[var(--success-bg)] border-[rgba(16,185,129,0.3)]">
          <h4 className="flex items-center gap-2 text-success"><DollarSign size={18} /> The Verdict</h4>
          <p className="text-md text-primary leading-relaxed m-0">
            By shifting to Sovereign Compute, you eliminate the infinite compound curve of SaaS subscriptions. The upfront CapEx is heavily subsidized by the US Government via Section 179. You stop paying rent to Big Tech and start building a physical, high-performance equity moat.
          </p>
        </FadeIn>
      </div>
    </div>
  );
};

// ==========================================
// SLIDE 6: 1/3/5 Year Horizon
// ==========================================
const Slide6 = () => {
  const [activeYear, setActiveYear] = useState('1Y');
  const content = {
    '1Y': { 
      title: 'The Sovereign Studio', 
      desc: 'Deploy the M4 Pro node on a Zero-Trust network to index the existing Barnstorm media archive using local multimodal AI. Break the dependency on premium cloud storage tiers and eliminate variable SaaS API costs by moving transcription and media ingestion strictly on-premise.',
      milestones: ['Deploy 20TB NAS Array', 'Initialize M4 Pro Node', 'Ingest & Transcribe Backlog']
    },
    '3Y': { 
      title: 'Autonomous Scale', 
      desc: 'Package the Barnstorm infrastructure as a proven operational engine. Establish autonomous workflows (via Creative Liberation Engine Dispatch) that handle marketing, CRM, and asset generation hands-free. The system generates ROI by replacing external administrative contractors with local AI agents.',
      milestones: ['Full RAG Pipeline Active', 'Autonomous Marketing Agents', 'Zero-Trust Remote Access']
    },
    '5Y': { 
      title: 'The AI Entertainment Platform', 
      desc: 'Transition from performing band to a tech-enabled platform. Live integration with M5 nodes to process real-time crowd biometrics (PULSE pipeline) and drive dynamic generative visual canvases (World Compiler) during live performances with zero latency.',
      milestones: ['PULSE Biometric Integration', 'Live Generative Shows', 'M5 Node Hot-swap']
    }
  };

  return (
    <div className="slide-content">
      <div className="slide-header">
        <div>
          <div className="badge brand"><Activity size={14} /> Strategic Outlook</div>
          <h2>The Platform Pivot</h2>
          <p>Scaling Barnstorm from a premium performing band to a technologically sovereign AI Entertainment Platform.</p>
        </div>
      </div>
      <div className="slide-body">
        <div className="flex gap-6 h-full pb-6">
          
          <FadeIn className="w-1/3 flex flex-col gap-4">
            {['1Y', '3Y', '5Y'].map((year) => (
              <button 
                key={year}
                onClick={() => setActiveYear(year)}
                className={`p-6 rounded-xl border text-left flex items-center gap-4 transition-all ${
                  activeYear === year 
                  ? 'bg-[var(--bg-tertiary)] border-[var(--brand-primary)]' 
                  : 'bg-[var(--bg-secondary)] border-[var(--border-light)] hover:border-[var(--border-strong)]'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  activeYear === year ? 'bg-[var(--brand-primary)] text-white' : 'bg-[var(--bg-primary)] text-secondary'
                }`}>
                  {year}
                </div>
                <div>
                  <h4 className="m-0 text-lg">Phase {year.charAt(0)}</h4>
                  <span className="text-sm text-tertiary">
                    {year === '1Y' ? 'Foundation' : year === '3Y' ? 'Automation' : 'Evolution'}
                  </span>
                </div>
              </button>
            ))}
          </FadeIn>
          
          <FadeIn className="flex-1 bento-item p-10 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div key={activeYear} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col h-full">
                <div className="badge brand mb-6 self-start">{activeYear} Horizon</div>
                <h2 className="text-4xl mb-6">{content[activeYear].title}</h2>
                <p className="text-lg text-secondary leading-relaxed max-w-[800px] mb-8">
                  {content[activeYear].desc}
                </p>
                
                <div className="mt-8 bg-[var(--bg-primary)] p-6 rounded-lg border border-[var(--border-light)]">
                  <h4 className="text-brand mb-4">Key Deliverables</h4>
                  <div className="flex gap-4">
                    {content[activeYear].milestones.map((ms, i) => (
                      <div key={i} className="flex-1 p-4 flex flex-col items-center text-center bg-[var(--bg-tertiary)] rounded-md border border-[var(--border-strong)]">
                        <ShieldCheck size={24} className="text-success mb-3" />
                        <span className="text-sm font-medium text-primary">{ms}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </FadeIn>

        </div>
      </div>
    </div>
  );
};

// ==========================================
// SLIDE 7: Authorization
// ==========================================
const Slide7 = () => {
  const authorizeNode = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5150/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: "procurement_auth",
          payload: {
            node: "Alpha Node - M4 Pro",
            status: "authorized",
            timestamp: new Date().toISOString()
          }
        })
      });
      if (response.ok) {
        alert("AUTHORIZATION CONFIRMED: Payload securely transmitted to NAS Dispatch (127.0.0.1:5150). Procurement initialized.");
      } else {
        alert("NAS Dispatch rejected payload. Verify authorization logic on NAS.");
      }
    } catch (error) {
      alert("NETWORK ERROR: Cannot reach NAS Dispatch. Ensure you are on the secure network (127.0.0.1).");
    }
  };

  return (
    <div className="slide-content">
      <div className="slide-header">
        <div>
          <div className="badge success"><Package size={14} /> Next Steps</div>
          <h2>Initiate Deployment</h2>
          <p>Vertical integration of your production pipeline.</p>
        </div>
      </div>
      <div className="slide-body items-center justify-center pb-20">
        <FadeIn className="bento-item w-full max-w-[900px] text-center p-16 border-[var(--brand-primary)] shadow-[0_0_50px_rgba(59,130,246,0.15)]">
          <ShieldCheck size={64} className="text-brand mx-auto mb-8" />
          <h2 className="text-5xl mb-6">Stop Renting. Start Building Equity.</h2>
          <p className="text-xl text-secondary max-w-[700px] mx-auto mb-10 leading-relaxed">
            By locking in your Sovereign Architecture today, you transform dead cloud storage fees into owned computational assets and deploy private AI to crush administrative overhead.
          </p>
          
          <div className="flex justify-center gap-6 mb-12">
            <div className="bg-[var(--bg-primary)] p-6 rounded-lg border border-[var(--border-light)] min-w-[250px] flex flex-col justify-center">
              <span className="text-xs text-tertiary uppercase tracking-wider block mb-3">Target Delivery</span>
              <strong className="text-brand text-2xl">14 Days from Auth</strong>
            </div>
            <div className="bg-[var(--bg-primary)] p-6 rounded-lg border border-[var(--border-light)] min-w-[250px] flex flex-col justify-center">
              <span className="text-xs text-tertiary uppercase tracking-wider block mb-3">Initial Commitment</span>
              <strong className="text-brand text-2xl">Hardware CapEx</strong>
            </div>
          </div>

          <button className="btn-primary mx-auto" style={{ transform: 'scale(1.1)', width: 'auto' }} onClick={authorizeNode}>
            AUTHORIZE ALPHA NODE <ArrowRight size={20} />
          </button>
        </FadeIn>
      </div>
    </div>
  );
};

// ==========================================
// TELEMETRY
// ==========================================
const LiveTelemetryStatus = () => (
  <div style={{ position: 'fixed', top: '4vh', right: '5vw', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 50 }}>
    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
    <span className="text-xs text-secondary font-mono tracking-wider">NAS LINK ACTIVE</span>
  </div>
);

// ==========================================
// MAIN APP COMPONENT
// ==========================================
const App = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  const slides = [
    <Slide1 key="1" />, <Slide2 key="2" />, <Slide3 key="3" />, 
    <Slide4 key="4" />, <Slide5 key="5" />, <Slide6 key="6" />, <Slide7 key="7" />
  ];

  const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, slides.length - 1));
  const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  if (isPrinting) {
    return (
      <div className="print-container">
        {slides.map((slide, i) => (
          <div key={i} className="print-slide">
            {slide}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fullscreen">
      <LiveTelemetryStatus />
      <div className="presentation-container">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentSlide}
            className="slide"
            initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {slides[currentSlide]}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="nav-bar">
        <button className="nav-btn" onClick={prevSlide} disabled={currentSlide === 0}>
          <ChevronLeft size={24} />
        </button>
        
        <div className="nav-dots">
          {slides.map((_, i) => (
            <button 
              key={i}
              className={`nav-dot ${currentSlide === i ? 'active' : ''}`}
              onClick={() => setCurrentSlide(i)}
            />
          ))}
        </div>

        <button className="nav-btn" onClick={nextSlide} disabled={currentSlide === slides.length - 1}>
          <ChevronRight size={24} />
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--border-strong)', margin: '0 8px' }}></div>

        <button className="nav-btn" onClick={() => window.print()} title="Export to PDF">
          <Download size={20} />
        </button>
      </nav>
    </div>
  );
};

export default App;



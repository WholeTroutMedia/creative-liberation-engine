import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, ArrowRight, CheckCircle2, Settings, Code2,
  Layers, Palette, Copy, Terminal, Rocket, ChevronRight,
  Clock, Trash2, Edit3, Download, Zap, Globe, ShoppingBag,
  Stethoscope, Building2, Sparkles,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
type Step = 'input' | 'profiler_loading' | 'questions' | 'assembly_loading' | 'output';

interface Option { id: string; title: string; desc: string; }
interface Question { id: string; q: string; options: Option[]; }

interface AtlierPackage {
  name: string;
  mood: string;
  colors: string[];
  typography: { header: string; body: string; };
  motion: string;
  layout: string;
  features: string[];
}

interface Session {
  id: string;
  prompt: string;
  industry: string;
  contract: AtlierPackage;
  ts: string;
}

// ── Industry Registry (ATELIER pattern-index) ─────────────────────────────
const INDUSTRIES: Record<string, { label: string; icon: typeof Globe; questions: Question[]; packages: AtlierPackage[] }> = {
  saas: {
    label: 'SaaS / Product',
    icon: Globe,
    questions: [
      { id: 'q1', q: 'Primary interaction model?', options: [
        { id: 'dashboard', title: 'Data Dashboard', desc: 'Charts, tables, KPI feeds.' },
        { id: 'workflow', title: 'Workflow / Kanban', desc: 'Task boards, linear processes.' },
        { id: 'editor', title: 'Document Editor', desc: 'Rich text, collaborative editing.' },
      ]},
      { id: 'q2', q: 'Target user profile?', options: [
        { id: 'enterprise', title: 'Enterprise B2B', desc: 'Dense info, trust signals, roles.' },
        { id: 'prosumer', title: 'Prosumer / Creator', desc: 'Dark mode, aesthetic-first.' },
        { id: 'smb', title: 'SMB Self-serve', desc: 'Onboarding flows, simple CTA.' },
      ]},
      { id: 'q3', q: 'Deployment priority?', options: [
        { id: 'desktop', title: 'Desktop First', desc: 'Multi-pane, wide viewport.' },
        { id: 'mobile', title: 'Mobile First', desc: 'Bottom sheets, thumb-safe targets.' },
      ]},
    ],
    packages: [
      { name: 'Celestial Dark', mood: 'Sleek · Premium · Dark', colors: ['#0d0f12','#16191e','#5e6ad2','#3dd68c','#f0f2f5'], typography: { header: 'Inter', body: 'JetBrains Mono' }, motion: 'Fluid spring transitions, 300ms ease-out', layout: 'Sidebar + content split, card grid', features: ['Glassmorphic cards','Indigo accent system','Skeleton loaders','Animated tooltips','Command palette (⌘K)'] },
      { name: 'Nordic Pro', mood: 'Clean · Trustworthy · Light', colors: ['#f8fafc','#e2e8f0','#3b82f6','#10b981','#0f172a'], typography: { header: 'Outfit', body: 'Inter' }, motion: 'Subtle fade, 200ms', layout: 'Top nav + full-bleed grid', features: ['High-contrast data tables','Role-based badge system','Status pill components','Toast notifications','Breadcrumb nav'] },
    ],
  },
  ecommerce: {
    label: 'E-Commerce / Retail',
    icon: ShoppingBag,
    questions: [
      { id: 'q1', q: 'Catalog type?', options: [
        { id: 'physical', title: 'Physical Goods', desc: 'Products with variants, shipping.' },
        { id: 'digital', title: 'Digital / SaaS', desc: 'Subscriptions, licenses, downloads.' },
        { id: 'marketplace', title: 'Marketplace', desc: 'Multi-vendor, reviews, discovery.' },
      ]},
      { id: 'q2', q: 'Brand energy?', options: [
        { id: 'luxury', title: 'Luxury / Editorial', desc: 'Serif fonts, white space, cinematic.' },
        { id: 'bold', title: 'Bold / Mass Market', desc: 'High contrast, urgency CTA, sale banners.' },
        { id: 'minimal', title: 'Minimal / DTC', desc: 'Clean, lifestyle photography, soft palette.' },
      ]},
      { id: 'q3', q: 'Conversion focus?', options: [
        { id: 'browse', title: 'Discovery / Browse', desc: 'Filtering, recommendations, editorial.' },
        { id: 'checkout', title: 'Express Checkout', desc: 'Minimal steps, Apple/Google Pay.' },
      ]},
    ],
    packages: [
      { name: 'Noir Luxe', mood: 'Editorial · Luxury · Cinematic', colors: ['#0a0a0a','#1a1a1a','#c8a97e','#e8e8e8','#ffffff'], typography: { header: 'Playfair Display', body: 'Lato' }, motion: 'Slow reveal, 600ms ease-in-out parallax', layout: 'Full-bleed hero, editorial grid', features: ['Hero video headers','Hover zoom product cards','Sticky add-to-cart bar','Size guide modal','Wishlist micro-animation'] },
      { name: 'Bright Commerce', mood: 'Bold · Energetic · Conversion-first', colors: ['#ffffff','#f0f0f0','#ff4500','#22c55e','#111111'], typography: { header: 'Poppins', body: 'DM Sans' }, motion: 'Snap transitions, urgency pulses', layout: 'Product-grid above fold, sticky header', features: ['Sale countdown timers','Flash badge system','One-click reorder','Social proof ticker','Cart slide-over'] },
    ],
  },
  health: {
    label: 'Health / Wellness',
    icon: Stethoscope,
    questions: [
      { id: 'q1', q: 'Audience?', options: [
        { id: 'patient', title: 'Patient Portal', desc: 'Records, scheduling, prescriptions.' },
        { id: 'clinician', title: 'Clinician Tooling', desc: 'EHR, charting, clinical workflows.' },
        { id: 'consumer', title: 'Consumer Wellness', desc: 'Fitness, mental health, habit tracking.' },
      ]},
      { id: 'q2', q: 'Trust signal priority?', options: [
        { id: 'medical', title: 'Medical Grade', desc: 'HIPAA badges, clinical tone, dense data.' },
        { id: 'warm', title: 'Warm & Supportive', desc: 'Calming palette, empathetic copy.' },
      ]},
      { id: 'q3', q: 'Primary device?', options: [
        { id: 'mobile', title: 'Mobile App', desc: 'Native feel, bottom nav, haptics.' },
        { id: 'desktop', title: 'Clinical Desktop', desc: 'Multi-panel, keyboard-first.' },
      ]},
    ],
    packages: [
      { name: 'Calm Clinical', mood: 'Trustworthy · Warm · Accessible', colors: ['#f0f9ff','#e0f2fe','#0284c7','#16a34a','#1e293b'], typography: { header: 'Nunito', body: 'Open Sans' }, motion: 'Gentle fade, 250ms', layout: 'Card stack with section anchors', features: ['WCAG AA baseline','Progress ring components','Appointment timeline','Medication reminder cards','Emergency contact CTA'] },
    ],
  },
  civic: {
    label: 'Civic Tech',
    icon: Building2,
    questions: [
      { id: 'q1', q: 'Primary audience?', options: [
        { id: 'seniors', title: 'Seniors (60+)', desc: 'WCAG AAA, large targets, high contrast.' },
        { id: 'activists', title: 'Civic Activists', desc: 'Share-first, deep links, urgency.' },
        { id: 'officials', title: 'Local Officials', desc: 'Dense dashboards, report generation.' },
      ]},
      { id: 'q2', q: 'Primary data ingestion?', options: [
        { id: 'email', title: 'Email / PDF Parsing', desc: 'Civic jargon → plain English.' },
        { id: 'realtime', title: 'Real-time Feeds', desc: 'Live alerts, meeting streams.' },
        { id: 'geospatial', title: 'GIS / Zoning Maps', desc: 'Parcel data, permit overlays.' },
      ]},
      { id: 'q3', q: 'Alerting urgency?', options: [
        { id: 'critical', title: 'Push (Critical)', desc: 'Bypasses silent — emergencies.' },
        { id: 'digest', title: 'Daily Digest', desc: 'Morning summary of local news.' },
      ]},
    ],
    packages: [
      { name: 'Civic Trust', mood: 'Accessible · Clear · Empowering', colors: ['#f8f9fa','#e9ecef','#0056b3','#dc3545','#212529'], typography: { header: 'Outfit', body: 'Atkinson Hyperlegible' }, motion: 'Minimal, respect prefers-reduced-motion', layout: 'Single column, card stack, bottom nav', features: ['WCAG AAA minimum','Push notification rail','Town hall countdown','Plain-language rewriter','Zoning map overlay'] },
      { name: 'Open Gov Dark', mood: 'Technical · Transparent · Hacker-civic', colors: ['#111318','#1a1f2e','#3b82f6','#f59e0b','#f1f5f9'], typography: { header: 'IBM Plex Sans', body: 'IBM Plex Mono' }, motion: 'Terminal flicker, data-feel transitions', layout: 'Dashboard grid with collapsible panels', features: ['Real-time vote tracker','Public spend treemap','Meeting transcript viewer','FOIA request builder','Boundary dispute mapper'] },
    ],
  },
  creative: {
    label: 'Creative / Agency',
    icon: Sparkles,
    questions: [
      { id: 'q1', q: 'Agency type?', options: [
        { id: 'portfolio', title: 'Portfolio / Folio', desc: 'Work showcase, case studies.' },
        { id: 'studio', title: 'Studio / Production', desc: 'Client login, project tracker.' },
        { id: 'marketplace', title: 'Creative Marketplace', desc: 'Assets, templates, licensing.' },
      ]},
      { id: 'q2', q: 'Aesthetic direction?', options: [
        { id: 'brutalist', title: 'Neo-Brutalist', desc: 'Bold borders, raw grid, high contrast.' },
        { id: 'liquid', title: 'Liquid / Organic', desc: 'Blob shapes, gradient mesh, fluid.' },
        { id: 'minimal', title: 'Swiss Minimal', desc: 'Grid-strict, typographic, white space.' },
      ]},
      { id: 'q3', q: 'Key impression?', options: [
        { id: 'wow', title: 'WOW / Immersive', desc: 'Full-screen, scroll-jacked, canvas.' },
        { id: 'trusted', title: 'Trusted / Convertible', desc: 'Clear CTA, credential-first.' },
      ]},
    ],
    packages: [
      { name: 'Signal Noise', mood: 'Bold · Expressive · Brutalist', colors: ['#f5f5f0','#e8e8e0','#ff2d55','#0a0a0a','#1a1a1a'], typography: { header: 'Space Grotesk', body: 'DM Mono' }, motion: 'Stagger reveals, magnetic cursor', layout: 'Asymmetric masonry, full viewport sections', features: ['Magnetic hover buttons','Horizontal scroll gallery','Canvas particle bg','Custom cursor system','Split-text hero animation'] },
      { name: 'Glass Studio', mood: 'Luminous · Futuristic · Premium', colors: ['#0a0a0f','#12121a','#a855f7','#06b6d4','#e2e8f0'], typography: { header: 'Clash Display', body: 'Cabinet Grotesk' }, motion: 'Glassmorphic reveals, 400ms spring', layout: 'Full-bleed grid, sticky scroll sections', features: ['Glass card system','Gradient mesh backgrounds','Scroll-triggered counters','3D tilt cards','Noise texture overlay'] },
    ],
  },
};

// ── Detect industry from prompt ────────────────────────────────────────────
function detectIndustry(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/civic|town|government|govern|municipal|zoning|vote|election|alert|council|board/.test(p)) return 'civic';
  if (/shop|store|cart|product|buy|sell|checkout|commerce|retail|inventory/.test(p)) return 'ecommerce';
  if (/health|medical|patient|clinic|doctor|hospital|wellness|therapy|mental/.test(p)) return 'health';
  if (/portfolio|agency|studio|creative|design firm|folio|artwork|gallery/.test(p)) return 'creative';
  return 'saas';
}

// ── Session storage (in-memory for demo) ──────────────────────────────────
let sessionStore: Session[] = [];

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>('input');
  const [prompt, setPrompt] = useState('');
  const [industryKey, setIndustryKey] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedPackage, setSelectedPackage] = useState<AtlierPackage | null>(null);
  const [editableContract, setEditableContract] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const industry = INDUSTRIES[industryKey];

  const startProfiler = useCallback(() => {
    if (prompt.trim().length < 10) return;
    setStep('profiler_loading');
    setTimeout(() => {
      setIndustryKey(detectIndustry(prompt));
      setAnswers({});
      setStep('questions');
    }, 1400);
  }, [prompt]);

  const selectAnswer = (qId: string, optId: string) =>
    setAnswers(prev => ({ ...prev, [qId]: optId }));

  const allAnswered = industry && Object.keys(answers).length >= industry.questions.length;

  const submitQuestions = () => {
    setStep('assembly_loading');
    setTimeout(() => {
      // Pick best package by answer signals
      const pkgs = industry.packages;
      const isDark = answers['q2'] === 'prosumer' || answers['q2'] === 'luxury' || answers['q1'] === 'portfolio';
      const pkg = isDark ? (pkgs[0] ?? pkgs[0]) : (pkgs[1] ?? pkgs[0]);
      const finalPkg: AtlierPackage = {
        ...pkg,
        features: [
          ...pkg.features,
          answers['q3'] === 'desktop' ? 'Multi-pane desktop layout' : 'Mobile-first touch navigation',
          answers['q1'] === 'enterprise' ? 'RBAC / permission layer' : answers['q1'] === 'seniors' ? 'WCAG AAA enforced' : 'Optimized conversion funnel',
        ],
      };
      setSelectedPackage(finalPkg);
      const md = buildContract(finalPkg);
      setEditableContract(md);
      setStep('output');
    }, 1800);
  };

  const buildContract = (pkg: AtlierPackage) => `# DESIGN_CONTRACT.md
## Generated: ${new Date().toLocaleString()}

## 1. Brief
**Industry:** ${industry?.label}
**Package:** ${pkg.name}
**Mood:** ${pkg.mood}
**Prompt:** "${prompt}"

## 2. Design System Tokens

### Typography
| Role | Family |
|------|--------|
| Headers | \`${pkg.typography.header}, sans-serif\` |
| Body | \`${pkg.typography.body}\` |

### Color Palette
| Token | Hex |
|-------|-----|
| Background | \`${pkg.colors[0]}\` |
| Surface | \`${pkg.colors[1]}\` |
| Primary Accent | \`${pkg.colors[2]}\` |
| Alert / CTA | \`${pkg.colors[3]}\` |
| Text Primary | \`${pkg.colors[4]}\` |

### Motion
${pkg.motion}

### Layout
${pkg.layout}

## 3. Structural Features
${pkg.features.map(f => `- ${f}`).join('\n')}

## 4. SHIP Handoff
Ready for autonomous SHIP agent execution.
No further spec needed. All ambiguity resolved above.

---
*Autonomously generated by Zero-to-Spec Engine HUD · Creative Liberation Engine v5*`;

  const copyContract = () => {
    navigator.clipboard.writeText(editableContract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadContract = () => {
    const blob = new Blob([editableContract], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'DESIGN_CONTRACT.md'; a.click();
    URL.revokeObjectURL(url);
  };

  const saveSession = () => {
    if (!selectedPackage) return;
    const s: Session = { id: Date.now().toString(), prompt, industry: industry.label, contract: selectedPackage, ts: new Date().toLocaleString() };
    sessionStore = [s, ...sessionStore];
    setSessions([...sessionStore]);
  };

  const resetWizard = () => {
    setStep('input'); setPrompt(''); setAnswers({}); setSelectedPackage(null); setEditableContract('');
  };

  const loadSession = (s: Session) => {
    setPrompt(s.prompt);
    setIndustryKey(Object.keys(INDUSTRIES).find(k => INDUSTRIES[k].label === s.industry) || 'saas');
    setSelectedPackage(s.contract);
    setEditableContract(buildContract(s.contract));
    setStep('output');
    setShowHistory(false);
  };

  const industryEntries = Object.entries(INDUSTRIES);

  return (
    <>
      <div className="bg-shapes"><div className="shape-1" /><div className="shape-2" /></div>

      <div className="app-container">
        {/* ── Header ── */}
        <header className="wizard-header">
          <div className="brand">
            <div className="brand-icon"><BrainCircuit size={18} /></div>
            Zero-to-Spec Engine
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="step-indicator">
              {(['input', 'profiler', 'output'] as const).map((s, i) => {
                const active = (s === 'input' && step === 'input') || (s === 'profiler' && (step === 'profiler_loading' || step === 'questions' || step === 'assembly_loading')) || (s === 'output' && step === 'output');
                const done = (s === 'input' && step !== 'input') || (s === 'profiler' && step === 'output');
                return (
                  <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {i > 0 && <span style={{ width: 20, height: 1, background: 'var(--border)', display: 'block' }} />}
                    <span className={`step-dot ${active ? 'active' : ''} ${done ? 'completed' : ''}`} />
                  </span>
                );
              })}
            </div>
            <button className="auth-button" onClick={() => { saveSession(); setShowHistory(!showHistory); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Clock size={14} /> History {sessions.length > 0 && `(${sessions.length})`}
            </button>
            <button className="auth-button" onClick={resetWizard}>New</button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: showHistory && sessions.length > 0 ? '280px 1fr' : '1fr', gap: '1.5rem', flex: 1, alignItems: 'start' }}>
          {/* ── History Sidebar ── */}
          {showHistory && sessions.length > 0 && (
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} /> Sessions
              </div>
              {sessions.map(s => (
                <div key={s.id} style={{ padding: '0.75rem', borderRadius: 8, border: '1px solid var(--border)', marginBottom: '0.5rem', cursor: 'pointer', background: 'rgba(0,0,0,0.15)' }} onClick={() => loadSession(s)}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{s.contract.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{s.industry}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted ?? --text-secondary)', marginTop: '0.25rem' }}>{s.ts}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.4rem', fontStyle: 'italic' }}>"{s.prompt.slice(0, 50)}…"</div>
                </div>
              ))}
            </motion.div>
          )}

          {/* ── Wizard ── */}
          <div style={{ flex: 1 }}>
            <AnimatePresence mode="wait">

              {/* Step 1 — Input */}
              {step === 'input' && (
                <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }} className="glass-card">
                  <h1 className="step-title">Describe the Vision</h1>
                  <p className="step-subtitle">What application are we building?</p>

                  {/* Industry selector */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: '1.5rem' }}>
                    {industryEntries.map(([key, val]) => {
                      const Icon = val.icon;
                      const active = industryKey === key;
                      return (
                        <button key={key} onClick={() => setIndustryKey(key)} style={{ background: active ? 'var(--accent-light)' : 'rgba(0,0,0,0.15)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 10, padding: '0.6rem 0.5rem', cursor: 'pointer', color: active ? 'var(--accent)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', transition: 'all 0.15s' }}>
                          <Icon size={15} /> {val.label.split(' ')[0]}
                        </button>
                      );
                    })}
                  </div>

                  <textarea className="textarea-field" placeholder="e.g. A civic tech app for a small town that ingests confusing PDFs and sends push alerts to seniors..." value={prompt} onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === 'Enter' && e.metaKey && startProfiler()} autoFocus />

                  <div className="action-bar">
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {industryKey ? <span className="industry-badge" style={{ margin: 0 }}><Layers size={12} /> {INDUSTRIES[industryKey].label}</span> : 'Industry auto-detected from prompt'}
                    </span>
                    <button className="btn-primary" onClick={startProfiler} disabled={prompt.trim().length < 10}>
                      Run Vertical Profiler <ArrowRight size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Profiler loading */}
              {step === 'profiler_loading' && (
                <motion.div key="pload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="profiler-analyzing">
                  <div className="spinner" />
                  <h2 style={{ fontSize: '1.5rem' }}>Detecting Industry & Constraints</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Scanning ATELIER pattern index…</p>
                </motion.div>
              )}

              {/* Questions */}
              {step === 'questions' && industry && (
                <motion.div key="q" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="glass-card">
                  <div className="industry-badge">
                    <Layers size={14} /> {industry.label}
                  </div>
                  <h1 className="step-title" style={{ marginBottom: '2rem' }}>Confirm Constraints</h1>

                  {industry.questions.map(q => (
                    <div key={q.id} className="question-block">
                      <div className="question-text">{q.q}</div>
                      <div className="options-grid">
                        {q.options.map(opt => (
                          <div key={opt.id} className={`option-card ${answers[q.id] === opt.id ? 'selected' : ''}`} onClick={() => selectAnswer(q.id, opt.id)}>
                            <div className="option-radio" />
                            <div className="option-content"><h4>{opt.title}</h4><p>{opt.desc}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="action-bar" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-primary" onClick={submitQuestions} disabled={!allAnswered}>
                      Assemble Package <Settings size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Assembly loading */}
              {step === 'assembly_loading' && (
                <motion.div key="aload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="profiler-analyzing">
                  <div className="spinner" style={{ borderTopColor: 'var(--success)' }} />
                  <h2 style={{ fontSize: '1.5rem' }}>Assembling ATELIER Package</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Locking typography, tokens, structural logic…</p>
                </motion.div>
              )}

              {/* Output */}
              {step === 'output' && selectedPackage && (
                <motion.div key="output" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card" style={{ borderColor: 'rgba(61,214,140,0.35)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--success)' }}>
                      <CheckCircle2 size={22} />
                      <h1 className="step-title" style={{ margin: 0, color: '#fff' }}>
                        {selectedPackage.name}
                      </h1>
                    </div>
                    <span className="industry-badge" style={{ margin: 0 }}>{industry.label}</span>
                  </div>

                  <div className="assembly-grid">
                    {/* Left: Editable contract */}
                    <div>
                      <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Terminal size={16} /> Contract <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 400 }}>— editable</span>
                      </h3>
                      <div className="code-block" style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', gap: 6 }}>
                          <button className="copy-btn" onClick={copyContract} title="Copy">
                            {copied ? <CheckCircle2 size={14} color="var(--success)" /> : <Copy size={14} />}
                          </button>
                          <button className="copy-btn" onClick={downloadContract} title="Download .md">
                            <Download size={14} />
                          </button>
                          <button className="copy-btn" title="Edit">
                            <Edit3 size={14} />
                          </button>
                        </div>
                        <textarea
                          value={editableContract}
                          onChange={e => setEditableContract(e.target.value)}
                          style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', minHeight: 340, resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#a9b2c3', lineHeight: 1.5, paddingRight: '4rem' }}
                          spellCheck={false}
                        />
                      </div>
                    </div>

                    {/* Right: Mood board */}
                    <div>
                      <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Palette size={16} /> Mood Board
                      </h3>

                      {/* Package name + mood */}
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 2 }}>{selectedPackage.name}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedPackage.mood}</div>
                      </div>

                      {/* Palette */}
                      <div className="palette-preview">
                        {selectedPackage.colors.map(c => (
                          <div key={c} className="color-swatch" style={{ backgroundColor: c, color: ['#f8fafc','#f8f9fa','#e9ecef','#ffffff','#e2e8f0','#e8e8e0','#f5f5f0','#f0f9ff','#e0f2fe','#f0f2f5','#f8fafc'].includes(c) ? '#000' : '#fff' }}>{c}</div>
                        ))}
                      </div>

                      {/* Typography */}
                      <div className="typography-preview" style={{ fontFamily: selectedPackage.typography.header }}>
                        <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1 }}>Aa</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, fontFamily: selectedPackage.typography.body }}>{selectedPackage.typography.body}</div>
                      </div>

                      {/* Motion + Layout */}
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}><Zap size={12} style={{ display: 'inline', marginRight: 4 }} />Motion</div>
                        {selectedPackage.motion}
                      </div>

                      {/* Features */}
                      <div className="logic-features">
                        {selectedPackage.features.map((f, i) => (
                          <div key={i} className="feature-item">
                            <CheckCircle2 size={13} style={{ color: 'var(--success)', flexShrink: 0 }} /> {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Alternate packages */}
                  {industry.packages.length > 1 && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', fontWeight: 600 }}>ATELIER ALTERNATIVES</div>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {industry.packages.map(pkg => (
                          <button key={pkg.name} onClick={() => { setSelectedPackage(pkg); setEditableContract(buildContract(pkg)); }} style={{ background: selectedPackage.name === pkg.name ? 'var(--accent-light)' : 'rgba(0,0,0,0.15)', border: `1px solid ${selectedPackage.name === pkg.name ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', color: selectedPackage.name === pkg.name ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {pkg.colors.slice(0, 3).map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.1)' }} />)}
                            </div>
                            {pkg.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="action-bar">
                    <button className="btn-secondary" onClick={() => { saveSession(); resetWizard(); }}>
                      <Trash2 size={14} /> New Session
                    </button>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button className="btn-secondary" onClick={() => { saveSession(); setShowHistory(true); }}>
                        <Clock size={14} /> Save to History
                      </button>
                      <button className="btn-primary" onClick={() => { saveSession(); copyContract(); }}>
                        <Rocket size={16} /> Hand Off to SHIP
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}

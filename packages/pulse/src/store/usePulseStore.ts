import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoodAxes {
  warmCold: number;      // 0=warm, 100=cold
  denseAiry: number;     // 0=dense, 100=airy
  loudRestrained: number;// 0=loud, 100=restrained
  playfulPrecise: number;// 0=playful, 100=precise
}

// ─── Edge Node Types (Mission Control) ────────────────────────────────────────

export interface EdgeNode {
  id: string;
  label: string;            // e.g. "Sony A7IV — Baseline"
  venue: string;            // e.g. "Chase Center"
  x: number;                // 0-1 normalized position on venue map
  y: number;
  status: 'live' | 'idle' | 'offline' | 'error';
  streamHealth: number;     // 0-100
  batteryPct: number | null;
  lteSignalDbm: number | null;
  queueDepth: number;       // clips waiting to upload
  lastHeartbeat: number;    // epoch ms
  sessionId: string | null;
  currentMoment: string | null; // last AI tag
}

export type ColorScheme = 'dark' | 'light' | 'auto';

export interface ColorSystem {
  primary: string;
  surface: string;
  accent: string;
}

export type PatternId = 'metric-card' | 'nav-bar' | 'input-field' | 'modal' | 'button' | 'data-table' | 'sidebar' | 'card-grid';

export interface HistorySnapshot {
  id: string;
  timestamp: number;
  intent: string;
  moodAxes: MoodAxes;
  colorSystem: ColorSystem;
  scheme: ColorScheme;
}

export interface OracleReasoning {
  summary: string;
  tokenSuggestions: Partial<ColorSystem>;
  moodSuggestions: Partial<MoodAxes>;
}

export interface PulseState {
  // INTENT
  intentText: string;
  intentTags: string[];
  oracleReasoning: OracleReasoning | null;
  isOracleLoading: boolean;

  // MOOD
  moodAxes: MoodAxes;

  // COLOR
  colorSystem: ColorSystem;
  colorScheme: ColorScheme;

  // TYPE
  displayFont: string;
  bodyFont: string;

  // PATTERNS
  activePattern: PatternId;

  // PANEL OPEN STATE
  openSections: Record<string, boolean>;

  // PENPOT
  isPushing: boolean;
  pushStatus: 'idle' | 'success' | 'error';

  // HISTORY
  showHistory: boolean;
  history: HistorySnapshot[];

  // VERA
  veraScore: number;
  veraGrade: string;
  veraIssues: Array<{ id: string; type: 'pass' | 'warn' | 'fail'; message: string; fixable: boolean; file?: string }>;

  // MISSION CONTROL
  missionControlMode: boolean;
  edgeNodes: EdgeNode[];
  activeVenue: string;

  // ACTIONS
  setIntentText: (text: string) => void;
  applyIntent: () => void;
  setMoodAxis: (axis: keyof MoodAxes, value: number) => void;
  setColorSystem: (patch: Partial<ColorSystem>) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  setDisplayFont: (font: string) => void;
  setBodyFont: (font: string) => void;
  setActivePattern: (id: PatternId) => void;
  toggleSection: (id: string) => void;
  pushToPenpot: () => Promise<void>;
  clearPushStatus: () => void;
  setShowHistory: (show: boolean) => void;
  restoreSnapshot: (snapshot: HistorySnapshot) => void;
  setVeraResults: (score: number, grade: string, issues: PulseState['veraIssues']) => void;
  applyAutoFix: (issueId: string) => void;
  // Mission Control actions
  setMissionControlMode: (active: boolean) => void;
  setEdgeNodes: (nodes: EdgeNode[]) => void;
  updateEdgeNode: (id: string, patch: Partial<EdgeNode>) => void;
  addEdgeNode: (node: EdgeNode) => void;
  removeEdgeNode: (id: string) => void;
  setActiveVenue: (venue: string) => void;
}

// ─── Initial State ─────────────────────────────────────────────────────────────

const DEFAULT_MOOD: MoodAxes = {
  warmCold: 65,
  denseAiry: 40,
  loudRestrained: 72,
  playfulPrecise: 80,
};

const DEFAULT_COLOR: ColorSystem = {
  primary: '#C89040',
  surface: '#111520',
  accent: '#1E3A6E',
};

const DEFAULT_OPEN: Record<string, boolean> = {
  intent: true,
  mood: true,
  color: true,
  type: false,
  patterns: false,
};

// ─── Seed Edge Nodes (local dev / demo) ───────────────────────────────────────

const SEED_EDGE_NODES: EdgeNode[] = [
  {
    id: 'node-baseline',
    label: 'Sony A7IV — Baseline',
    venue: 'Local Test',
    x: 0.25, y: 0.75,
    status: 'live',
    streamHealth: 94,
    batteryPct: 87,
    lteSignalDbm: -72,
    queueDepth: 0,
    lastHeartbeat: Date.now(),
    sessionId: null,
    currentMoment: null,
  },
  {
    id: 'node-rinkside',
    label: 'iPhone 15 Pro — Rinkside',
    venue: 'Local Test',
    x: 0.72, y: 0.38,
    status: 'idle',
    streamHealth: 78,
    batteryPct: 62,
    lteSignalDbm: -84,
    queueDepth: 2,
    lastHeartbeat: Date.now() - 15000,
    sessionId: null,
    currentMoment: 'faceoff detected',
  },
];

// ─── Private: ORACLE call (outside store to avoid type pollution) ─────────────

async function callOracle(intent: string, set: (partial: Partial<PulseState>) => void, get: () => PulseState): Promise<void> {
  set({ isOracleLoading: true });
  try {
    const res = await fetch('http://localhost:4100/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        model: 'ollama/llama3.1:8b',
        prompt: `Analyze this UI design intent: "${intent}". Return valid JSON with three fields: "reasoning" (string summary of choices), "colors" (object with "primary", "surface", "accent" hex codes), and "mood" (object with warmCold and denseAiry from 0-100). Keep it minimal.` 
      }),
      signal: AbortSignal.timeout(12000), // Give LLM time
    });
    
    if (res.ok) {
      const data = await res.json();
      let output: any = {};
      try {
        // Genkit might return Markdown wrapped JSON inside data.text
        const jsonMatch = data.text?.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : data.text;
        output = JSON.parse(jsonString ?? '{}');
      } catch {
        output = { reasoning: data.text ?? 'ORACLE processed intent.' };
      }

      const reasoning: OracleReasoning = {
        summary: output.reasoning ?? 'ORACLE processed intent.',
        tokenSuggestions: output.colors ?? {},
        moodSuggestions: output.mood ?? {},
      };
      
      set({ oracleReasoning: reasoning });
      if (output.colors) set({ colorSystem: { ...get().colorSystem, ...output.colors } });
      if (output.mood) set({ moodAxes: { ...get().moodAxes, ...output.mood } });
      
      // Update variables if colors change
      if (output.colors) {
        const root = document.documentElement;
        if (output.colors.primary) root.style.setProperty('--dynamic-primary', output.colors.primary);
        if (output.colors.surface) root.style.setProperty('--dynamic-surface', output.colors.surface);
        if (output.colors.accent) root.style.setProperty('--dynamic-accent', output.colors.accent);
      }
    }
  } catch (e) {
    console.error('ORACLE error:', e);
    // Engine offline — silent fail, manual mode active
  } finally {
    set({ isOracleLoading: false });
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePulseStore = create<PulseState>((set, get) => ({
  intentText: '',
  intentTags: [],

  oracleReasoning: null,
  isOracleLoading: false,

  moodAxes: DEFAULT_MOOD,

  colorSystem: DEFAULT_COLOR,
  colorScheme: 'dark',

  displayFont: 'Space Grotesk',
  bodyFont: 'Inter',

  activePattern: 'metric-card',

  openSections: DEFAULT_OPEN,

  isPushing: false,
  pushStatus: 'idle',

  showHistory: false,
  history: [],

  veraScore: 0,
  veraGrade: '—',
  veraIssues: [],

  // Mission Control
  missionControlMode: false,
  edgeNodes: SEED_EDGE_NODES,
  activeVenue: 'Local Test',

  // ─── Actions ───────────────────────────────────────────────────────────────

  setIntentText: (text) => set({ intentText: text }),

  applyIntent: () => {
    const { intentText, colorSystem, moodAxes, colorScheme } = get();
    const trimmed = intentText.trim();
    if (!trimmed) return;

    const tags = trimmed.split(/[,·]+/).map(t => t.trim()).filter(Boolean);
    set({ intentTags: tags });

    const snapshot: HistorySnapshot = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      intent: trimmed,
      moodAxes: { ...moodAxes },
      colorSystem: { ...colorSystem },
      scheme: colorScheme,
    };

    set(state => ({ history: [snapshot, ...state.history].slice(0, 20) }));

    void callOracle(trimmed, set, get);
  },

  setMoodAxis: (axis, value) => set(s => ({ moodAxes: { ...s.moodAxes, [axis]: value } })),

  setColorSystem: (patch) => {
    set(s => ({ colorSystem: { ...s.colorSystem, ...patch } }));
    const { colorSystem } = get();
    const root = document.documentElement;
    root.style.setProperty('--dynamic-primary', colorSystem.primary);
    root.style.setProperty('--dynamic-surface', colorSystem.surface);
    root.style.setProperty('--dynamic-accent', colorSystem.accent);
  },

  setColorScheme: (scheme) => set({ colorScheme: scheme }),
  setDisplayFont: (font) => set({ displayFont: font }),
  setBodyFont: (font) => set({ bodyFont: font }),
  setActivePattern: (id) => set({ activePattern: id }),

  toggleSection: (id) => set(s => ({
    openSections: { ...s.openSections, [id]: !s.openSections[id] }
  })),

  pushToPenpot: async () => {
    set({ isPushing: true, pushStatus: 'idle' });
    try {
      const { colorSystem } = get();
      const res = await fetch('http://127.0.0.1:9001/api/rpc/command/get-profile', {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        console.log('[PULSE] Penpot reachable, tokens ready to push:', colorSystem);
        set({ pushStatus: 'success' });
      } else {
        set({ pushStatus: 'error' });
      }
    } catch {
      set({ pushStatus: 'error' });
    } finally {
      set({ isPushing: false });
    }
  },

  clearPushStatus: () => set({ pushStatus: 'idle' }),
  setShowHistory: (show) => set({ showHistory: show }),

  restoreSnapshot: (snapshot) => set({
    intentText: snapshot.intent,
    intentTags: snapshot.intent.split(/[,·]+/).map(t => t.trim()).filter(Boolean),
    moodAxes: { ...snapshot.moodAxes },
    colorSystem: { ...snapshot.colorSystem },
    colorScheme: snapshot.scheme,
    showHistory: false,
  }),

  setVeraResults: (score, grade, issues) => set({ veraScore: score, veraGrade: grade, veraIssues: issues }),

  applyAutoFix: (issueId) => {
    set(s => ({
      veraIssues: s.veraIssues.map(i => i.id === issueId ? { ...i, type: 'pass' as const, fixable: false } : i),
      veraScore: Math.min(100, s.veraScore + 4),
    }));
  },

  // ─── Mission Control Actions ────────────────────────────────────────────────

  setMissionControlMode: (active) => set({ missionControlMode: active }),
  setEdgeNodes: (nodes) => set({ edgeNodes: nodes }),
  updateEdgeNode: (id, patch) => set(s => ({
    edgeNodes: s.edgeNodes.map(n => n.id === id ? { ...n, ...patch } : n),
  })),
  addEdgeNode: (node) => set(s => ({ edgeNodes: [...s.edgeNodes, node] })),
  removeEdgeNode: (id) => set(s => ({ edgeNodes: s.edgeNodes.filter(n => n.id !== id) })),
  setActiveVenue: (venue) => set({ activeVenue: venue }),
}));


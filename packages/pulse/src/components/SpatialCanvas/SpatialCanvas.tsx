import { useMemo, useEffect, useRef } from 'react';
import { usePulseStore } from '../../store/usePulseStore';

// ─── Token Node Types ─────────────────────────────────────────────────────────

interface TokenNode {
  id: string;
  label: string;
  category: 'color' | 'type' | 'spacing';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface TokenEdge {
  source: string;
  target: string;
}

// ─── Seed data (static until real tokens are loaded) ─────────────────────────

const SEED_NODES: Omit<TokenNode, 'vx' | 'vy'>[] = [
  // Color cluster
  { id: 'c1', label: 'accent.primary',   category: 'color',   x: 0.30, y: 0.25 },
  { id: 'c2', label: 'surface.base',     category: 'color',   x: 0.22, y: 0.35 },
  { id: 'c3', label: 'surface.raised',   category: 'color',   x: 0.38, y: 0.32 },
  { id: 'c4', label: 'text.primary',     category: 'color',   x: 0.26, y: 0.45 },
  { id: 'c5', label: 'border.default',   category: 'color',   x: 0.20, y: 0.20 },
  // Type cluster
  { id: 't1', label: 'font.display',     category: 'type',    x: 0.55, y: 0.30 },
  { id: 't2', label: 'font.body',        category: 'type',    x: 0.65, y: 0.22 },
  { id: 't3', label: 'scale.lg',         category: 'type',    x: 0.60, y: 0.40 },
  { id: 't4', label: 'scale.sm',         category: 'type',    x: 0.72, y: 0.35 },
  // Spacing cluster
  { id: 's1', label: 'space.4',          category: 'spacing', x: 0.45, y: 0.65 },
  { id: 's2', label: 'space.8',          category: 'spacing', x: 0.55, y: 0.70 },
  { id: 's3', label: 'space.16',         category: 'spacing', x: 0.35, y: 0.72 },
  { id: 's4', label: 'radius.md',        category: 'spacing', x: 0.50, y: 0.58 },
];

const EDGES: TokenEdge[] = [
  { source: 'c1', target: 'c3' },
  { source: 'c2', target: 'c3' },
  { source: 'c2', target: 'c4' },
  { source: 'c3', target: 'c5' },
  { source: 't1', target: 't3' },
  { source: 't2', target: 't4' },
  { source: 's1', target: 's4' },
  { source: 's2', target: 's4' },
  { source: 'c1', target: 't1' },
  { source: 's4', target: 'c2' },
];

// ─── Node Shapes ──────────────────────────────────────────────────────────────

function hexagonPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

function TokenNodeShape({ node, isHovered }: { node: TokenNode; isHovered: boolean }) {
  const r = isHovered ? 28 : 22;
  const { x, y, category } = node;

  switch (category) {
    case 'color': {
      return (
        <g>
          <defs>
            <filter id={`glow-c-${node.id}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <polygon
            points={hexagonPoints(x, y, r * 1.5)}
            fill="var(--dynamic-primary)"
            fillOpacity={0.18}
            stroke="var(--dynamic-primary)"
            strokeOpacity={0.75}
            strokeWidth="2"
            filter={`url(#glow-c-${node.id})`}
            className="token-node"
          />
        </g>
      );
    }
    case 'type': {
      return (
        <g>
          <circle
            cx={x}
            cy={y}
            r={r * 1.3}
            fill="var(--dynamic-accent)"
            fillOpacity={0.15}
            stroke="var(--dynamic-accent)"
            strokeOpacity={0.6}
            strokeWidth="2"
            className="token-node"
          />
        </g>
      );
    }
    case 'spacing': {
      return (
        <g>
          <rect
            x={x - r * 0.9}
            y={y - r * 0.9}
            width={r * 1.8}
            height={r * 1.8}
            rx={6}
            fill="var(--dynamic-surface)"
            fillOpacity={0.6}
            stroke="var(--steel)"
            strokeOpacity={0.4}
            strokeWidth="2"
            className="token-node"
          />
        </g>
      );
    }
    default:
      return null;
  }
}

// ─── Component Preview (floating) ────────────────────────────────────────────

function ComponentPreview() {
  const colorSystem = usePulseStore(s => s.colorSystem);
  const activePattern = usePulseStore(s => s.activePattern);

  const bars = [40, 65, 50, 80, 60, 75, 55].map((h, i) => (
    <div key={i} className="sparkline-bar" style={{ height: `${h}%`, background: colorSystem.primary }} />
  ));

  return (
    <div className="component-preview">
      <div className="preview-title font-mono">{activePattern} · current tokens</div>
      <div className="preview-metric font-display">4,821</div>
      <div className="preview-label text-steel">Active Sessions</div>
      <div className="preview-sparkline">{bars}</div>
      <span className="preview-cta" style={{ background: colorSystem.primary, color: '#07090F' }}>
        View All
      </span>
      <div className="preview-rendering-label font-mono">Rendering with current token values</div>
    </div>
  );
}

// ─── Main Canvas ──────────────────────────────────────────────────────────────

export function SpatialCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const moodAxes = usePulseStore(s => s.moodAxes);
  const nodesRef = useRef<TokenNode[]>(
    SEED_NODES.map(n => ({ ...n, vx: 0, vy: 0 }))
  );

  // Adjust node positions based on mood axes (map to 0-1000 coordinate space)
  const nodes = useMemo(() => {
    const coldFactor = moodAxes.warmCold / 100;
    const airyFactor = moodAxes.denseAiry / 100;

    return nodesRef.current.map(n => {
      let { x, y } = n;
      if (n.category === 'color') x = n.x + coldFactor * 0.08 - 0.04;
      if (n.category === 'spacing') y = n.y + airyFactor * 0.06 - 0.03;
      
      return { 
        ...n, 
        x: Math.max(0.05, Math.min(0.90, x)) * 1000, 
        y: Math.max(0.05, Math.min(0.90, y)) * 1000 
      };
    });
  }, [moodAxes.warmCold, moodAxes.denseAiry]);

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  return (
    <div className="panel-center" style={{ background: 'var(--void)' }}>
      <svg ref={svgRef} className="canvas-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        {/* Edges */}
        {EDGES.map((e, i) => {
          const s = nodeMap[e.source];
          const t = nodeMap[e.target];
          if (!s || !t) return null;
          return (
            <line
              key={i}
              x1={s.x} y1={s.y}
              x2={t.x} y2={t.y}
              stroke="rgba(138,148,168,0.25)"
              strokeWidth="2"
              className="token-edge"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <g key={node.id} className="token-node">
            <TokenNodeShape node={node} isHovered={false} />
            <text
              x={node.x}
              y={node.y + 25}
              textAnchor="middle"
              fontSize="16"
              fill="var(--white)"
              fontFamily="'JetBrains Mono', monospace"
            >
              {node.label}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="canvas-legend">
        <div className="legend-item">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polygon points={hexagonPoints(5,5,4.5)} fill="none" stroke="rgba(200,144,64,0.75)" strokeWidth="1.2" />
          </svg>
          Color
        </div>
        <div className="legend-item">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4" fill="none" stroke="rgba(220,228,245,0.65)" strokeWidth="1.2" />
          </svg>
          Type
        </div>
        <div className="legend-item">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="rgba(30,90,160,0.7)" strokeWidth="1.2" />
          </svg>
          Spacing
        </div>
      </div>

      {/* Floating component preview */}
      <ComponentPreview />
    </div>
  );
}

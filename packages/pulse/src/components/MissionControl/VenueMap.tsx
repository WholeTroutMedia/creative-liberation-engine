/**
 * VenueMap — SVG venue overlay for Mission Control
 * Renders a faint structural grid beneath edge node indicators.
 * Presets: hockey-rink, basketball-court, baseball-diamond
 */

import React from 'react';

export type VenuePreset = 'hockey-rink' | 'basketball-court' | 'baseball-diamond' | 'generic';

interface VenueMapProps {
  preset: VenuePreset;
  width: number;
  height: number;
}

const STROKE = 'rgba(0, 229, 255, 0.08)';
const STROKE_MID = 'rgba(0, 229, 255, 0.14)';

function HockeyRink({ w, h }: { w: number; h: number }) {
  const cr = h * 0.18; // corner radius
  return (
    <g>
      {/* Outer rink */}
      <rect x={w * 0.05} y={h * 0.08} width={w * 0.90} height={h * 0.84}
        rx={cr} ry={cr} fill="none" stroke={STROKE_MID} strokeWidth={2} />
      {/* Center line */}
      <line x1={w * 0.5} y1={h * 0.08} x2={w * 0.5} y2={h * 0.92} stroke={STROKE_MID} strokeWidth={2} strokeDasharray="6,4" />
      {/* Center circle */}
      <circle cx={w * 0.5} cy={h * 0.5} r={h * 0.12} fill="none" stroke={STROKE} strokeWidth={1.5} />
      <circle cx={w * 0.5} cy={h * 0.5} r={3} fill={STROKE_MID} />
      {/* Blue lines */}
      <line x1={w * 0.32} y1={h * 0.08} x2={w * 0.32} y2={h * 0.92} stroke={STROKE} strokeWidth={1.5} />
      <line x1={w * 0.68} y1={h * 0.08} x2={w * 0.68} y2={h * 0.92} stroke={STROKE} strokeWidth={1.5} />
      {/* Goal creases */}
      <rect x={w * 0.05} y={h * 0.42} width={w * 0.06} height={h * 0.16} rx={4} fill="none" stroke={STROKE} strokeWidth={1} />
      <rect x={w * 0.89} y={h * 0.42} width={w * 0.06} height={h * 0.16} rx={4} fill="none" stroke={STROKE} strokeWidth={1} />
      {/* Face-off circles */}
      {[0.2, 0.8].map(cx => [0.3, 0.7].map(cy => (
        <circle key={`${cx}-${cy}`} cx={w * cx} cy={h * cy} r={h * 0.07} fill="none" stroke={STROKE} strokeWidth={1} />
      )))}
    </g>
  );
}

function BasketballCourt({ w, h }: { w: number; h: number }) {
  return (
    <g>
      {/* Outer court */}
      <rect x={w * 0.05} y={h * 0.08} width={w * 0.90} height={h * 0.84}
        fill="none" stroke={STROKE_MID} strokeWidth={2} />
      {/* Half-court line */}
      <line x1={w * 0.5} y1={h * 0.08} x2={w * 0.5} y2={h * 0.92} stroke={STROKE_MID} strokeWidth={2} />
      {/* Center circle */}
      <circle cx={w * 0.5} cy={h * 0.5} r={h * 0.09} fill="none" stroke={STROKE} strokeWidth={1.5} />
      {/* Three-point arcs */}
      <path d={`M ${w * 0.12},${h * 0.22} A ${h * 0.35} ${h * 0.35} 0 0 1 ${w * 0.12},${h * 0.78}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      <path d={`M ${w * 0.88},${h * 0.22} A ${h * 0.35} ${h * 0.35} 0 0 0 ${w * 0.88},${h * 0.78}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      {/* Paint areas */}
      <rect x={w * 0.05} y={h * 0.36} width={w * 0.15} height={h * 0.28} fill="none" stroke={STROKE} strokeWidth={1} />
      <rect x={w * 0.80} y={h * 0.36} width={w * 0.15} height={h * 0.28} fill="none" stroke={STROKE} strokeWidth={1} />
      {/* Baskets */}
      <circle cx={w * 0.075} cy={h * 0.5} r={h * 0.025} fill="none" stroke={STROKE_MID} strokeWidth={1.5} />
      <circle cx={w * 0.925} cy={h * 0.5} r={h * 0.025} fill="none" stroke={STROKE_MID} strokeWidth={1.5} />
    </g>
  );
}

function BaseballDiamond({ w, h }: { w: number; h: number }) {
  const cx = w * 0.5;
  const cy = h * 0.6;
  const r = h * 0.28;
  // Diamond: home, 1st, 2nd, 3rd
  const home = `${cx},${cy + r * 0.7}`;
  const first = `${cx + r},${cy}`;
  const second = `${cx},${cy - r}`;
  const third = `${cx - r},${cy}`;

  return (
    <g>
      {/* Outfield arc */}
      <path d={`M ${cx - r * 1.6},${cy + r * 0.7} A ${r * 2} ${r * 2} 0 0 1 ${cx + r * 1.6},${cy + r * 0.7}`}
        fill="none" stroke={STROKE} strokeWidth={1.5} />
      {/* Infield diamond */}
      <polygon points={`${home} ${first} ${second} ${third}`}
        fill="none" stroke={STROKE_MID} strokeWidth={2} />
      {/* Basepaths */}
      {[home, first, second, third, home].map((pt, i, arr) => {
        if (i === arr.length - 1) return null;
        const [x1, y1] = pt.split(',');
        const [x2, y2] = arr[i + 1].split(',');
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={STROKE_MID} strokeWidth={1.5} />;
      })}
      {/* Bases */}
      {[home, first, second, third].map((pt, i) => {
        const [x, y] = pt.split(',');
        return <rect key={i} x={Number(x) - 6} y={Number(y) - 6} width={12} height={12}
          fill="none" stroke={STROKE_MID} strokeWidth={1.5} transform={`rotate(45,${x},${y})`} />;
      })}
      {/* Pitcher's mound */}
      <circle cx={cx} cy={cy - r * 0.45} r={8} fill="none" stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

function GenericGrid({ w, h }: { w: number; h: number }) {
  const cols = 8;
  const rows = 6;
  return (
    <g>
      {Array.from({ length: cols - 1 }, (_, i) => (
        <line key={`v${i}`}
          x1={w * ((i + 1) / cols)} y1={h * 0.05}
          x2={w * ((i + 1) / cols)} y2={h * 0.95}
          stroke={STROKE} strokeWidth={1} />
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <line key={`h${i}`}
          x1={w * 0.05} y1={h * ((i + 1) / rows)}
          x2={w * 0.95} y2={h * ((i + 1) / rows)}
          stroke={STROKE} strokeWidth={1} />
      ))}
      <rect x={w * 0.05} y={h * 0.05} width={w * 0.90} height={h * 0.90}
        fill="none" stroke={STROKE_MID} strokeWidth={2} />
    </g>
  );
}

export function VenueMap({ preset, width, height }: VenueMapProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      {preset === 'hockey-rink' && <HockeyRink w={width} h={height} />}
      {preset === 'basketball-court' && <BasketballCourt w={width} h={height} />}
      {preset === 'baseball-diamond' && <BaseballDiamond w={width} h={height} />}
      {preset === 'generic' && <GenericGrid w={width} h={height} />}
    </svg>
  );
}

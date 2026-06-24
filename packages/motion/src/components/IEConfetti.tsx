/**
 * IEConfetti — Standalone confetti burst/rain emitter
 * Canvas-based physics simulation. Zero deps.
 */

import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';

export type ConfettiShape = 'rect' | 'circle' | 'star' | 'ribbon';
export type ConfettiMode = 'burst' | 'rain' | 'cannon';

export interface IEConfettiProps {
  active?: boolean;
  mode?: ConfettiMode;
  count?: number;
  colors?: string[];
  shapes?: ConfettiShape[];
  gravity?: number;
  spread?: number;
  originX?: number;
  originY?: number;
  duration?: number;
  onComplete?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; shape: ConfettiShape; rotation: number;
  rotationSpeed: number; w: number; h: number; opacity: number; decay: number;
}

const DEFAULT_COLORS = ['#a78bfa', '#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#e879f9'];

function randomBetween(a: number, b: number): number { return a + Math.random() * (b - a); }

function createParticle(mode: ConfettiMode, spread: number, ox: number, oy: number, colors: string[], shapes: ConfettiShape[]): Particle {
  const angle = mode === 'rain'
    ? randomBetween(80, 100)
    : mode === 'cannon'
    ? randomBetween(-60, -30)
    : randomBetween(0, 360);

  const speed = mode === 'rain' ? randomBetween(2, 5) : randomBetween(4, 12);
  const rad = (angle * Math.PI) / 180;

  return {
    x: ox,
    y: oy,
    vx: Math.cos(rad) * speed * randomBetween(0.5, 1),
    vy: Math.sin(rad) * speed * randomBetween(0.5, 1),
    color: colors[Math.floor(Math.random() * colors.length)],
    shape: shapes[Math.floor(Math.random() * shapes.length)],
    rotation: randomBetween(0, 360),
    rotationSpeed: randomBetween(-6, 6),
    w: randomBetween(6, 14),
    h: randomBetween(4, 8),
    opacity: 1,
    decay: randomBetween(0.01, 0.025),
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.globalAlpha = p.opacity;
  ctx.fillStyle = p.color;

  if (p.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? p.w / 2 : p.w / 4;
      i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  } else if (p.shape === 'ribbon') {
    ctx.beginPath();
    ctx.moveTo(-p.w / 2, 0);
    ctx.quadraticCurveTo(0, -p.h, p.w / 2, 0);
    ctx.quadraticCurveTo(0, p.h, -p.w / 2, 0);
    ctx.fill();
  } else {
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }

  ctx.restore();
}

export function IEConfetti({
  active = false,
  mode = 'burst',
  count = 80,
  colors = DEFAULT_COLORS,
  shapes = ['rect', 'circle', 'star'],
  gravity = 0.15,
  spread = 180,
  originX = 0.5,
  originY = 0.4,
  duration = 3000,
  onComplete,
  className,
  style,
}: IEConfettiProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number>(0);

  const launch = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.offsetWidth || window.innerWidth;
    const h = canvas.offsetHeight || window.innerHeight;
    canvas.width = w;
    canvas.height = h;

    particlesRef.current = Array.from({ length: count }, () =>
      createParticle(mode, spread, originX * w, originY * h, colors, shapes),
    );
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = particlesRef.current.filter((p) => p.opacity > 0);

      for (const p of particlesRef.current) {
        p.vy += gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.decay;
        drawParticle(ctx, p);
      }

      if (particlesRef.current.length > 0 && now - startTimeRef.current < duration) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onComplete?.();
      }
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [count, mode, spread, originX, originY, colors, shapes, gravity, duration, onComplete]);

  useEffect(() => {
    if (active) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      launch();
    }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [active, launch]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
        ...style,
      }}
    />
  );
}

export default IEConfetti;

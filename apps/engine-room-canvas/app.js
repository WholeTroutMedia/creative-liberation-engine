// Engine Room â€” FlipbookRenderer (Part 1 of 2)
// Canvas-native isometric city with cinematic overlays
// Reads: DEPARTMENTS, DATA_STREAMS, SYSTEM_STATS from data.js

'use strict';

/* â”€â”€ GLOBALS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const TILE_W = 88;   // isometric tile width
const TILE_H = 44;   // isometric tile height
const FLOOR_H = 20;  // height per floor unit

/* â”€â”€ STARFIELD CLASS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class Starfield {
  constructor(count = 180) {
    this.stars = [];
    this.shooters = [];
    this.shooterTimer = 0;
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.015 + 0.005
      });
    }
  }
  update(dt) {
    for (const s of this.stars) s.twinkle += s.speed;
    this.shooterTimer -= dt;
    if (this.shooterTimer <= 0) {
      this.shooterTimer = 4000 + Math.random() * 6000;
      this.shooters.push({ x: Math.random(), y: Math.random() * 0.4, vx: 0.0012, vy: 0.0006, life: 1 });
    }
    this.shooters = this.shooters.filter(s => {
      s.x += s.vx; s.y += s.vy; s.life -= dt / 1200;
      return s.life > 0;
    });
  }
  draw(ctx, W, H) {
    for (const s of this.stars) {
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.twinkle));
      const x = s.x * W, y = s.y * H;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,220,255,${alpha})`;
      ctx.fill();
    }
    for (const s of this.shooters) {
      const x = s.x * W, y = s.y * H;
      const grd = ctx.createLinearGradient(x - 40, y - 20, x, y);
      grd.addColorStop(0, `rgba(0,200,255,0)`);
      grd.addColorStop(1, `rgba(0,200,255,${s.life * 0.8})`);
      ctx.beginPath();
      ctx.moveTo(x - 40, y - 20);
      ctx.lineTo(x, y);
      ctx.strokeStyle = grd;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

/* â”€â”€ ISO HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function isoProject(gx, gy, gz, cx, cy) {
  const sx = (gx - gy) * (TILE_W / 2);
  const sy = (gx + gy) * (TILE_H / 2) - gz * FLOOR_H;
  return { x: cx + sx, y: cy + sy };
}

function buildingScreenCenter(dept, cx, cy) {
  const gx = dept.gx + dept.w / 2;
  const gy = dept.gy + dept.d / 2;
  const gz = dept.h / 2;
  return isoProject(gx, gy, gz, cx, cy);
}

/* â”€â”€ COLOR HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
function shade(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

/* â”€â”€ RENDERER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
class FlipbookRenderer {
  constructor() {
    this.canvas = document.getElementById('main-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.starfield = new Starfield(200);
    this.view = 'client';      // client | technical | creative
    this.hoverId = null;
    this.selectedId = null;
    this.buildProgress = {};
    this.dataPackets = [];
    this.windowFlickers = {};
    this.creativeParticles = [];
    this.lastTime = 0;
    this.tick = 0;

    // Camera
    this.camX = 0; this.camY = 0;
    this.targetCamX = 0; this.targetCamY = 0;
    this.zoom = 1; this.targetZoom = 1;

    // Cinematic scan line phase
    this.scanLine = 0;

    this._initBuild();
    this._initPackets();
    this._initWindows();
    this._initCreativeParticles();
    this._bindEvents();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    requestAnimationFrame(t => this.animate(t));
  }

  _resize() {
    const W = this.canvas.clientWidth, H = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);
    this.W = W; this.H = H;
    this.cx = W * 0.5; this.cy = H * 0.36;
  }

  _initBuild() {
    for (const d of DEPARTMENTS) this.buildProgress[d.id] = 0;
  }

  _initPackets() {
    for (const [from, to] of DATA_STREAMS) {
      this.dataPackets.push({ from, to, t: Math.random(), speed: 0.003 + Math.random() * 0.004, color: DEPARTMENTS.find(d => d.id === from)?.color || '#00c8ff' });
    }
  }

  _initWindows() {
    for (const d of DEPARTMENTS) {
      this.windowFlickers[d.id] = Array.from({ length: 8 }, () => Math.random());
    }
  }

  _initCreativeParticles() {
    for (let i = 0; i < 400; i++) {
      this.creativeParticles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0003,
        r: Math.random() * 1.8 + 0.4,
        life: Math.random()
      });
    }
  }

  _bindEvents() {
    const c = this.canvas;
    c.addEventListener('mousemove', e => this._onMove(e));
    c.addEventListener('click', e => this._onClick(e));
    c.addEventListener('mouseleave', () => { this.hoverId = null; });

    document.getElementById('card-close').addEventListener('click', () => this._closeCard());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this._closeCard(); });

    document.getElementById('view-switcher').addEventListener('click', e => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      this.view = btn.dataset.view;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  }

  /* â”€â”€ HIT TEST â”€â”€ */
  _deptAt(mx, my) {
    const cx = this.cx + this.camX;
    const cy = this.cy + this.camY;
    for (const d of [...DEPARTMENTS].reverse()) {
      const base = isoProject(d.gx, d.gy + d.d, 0, cx, cy);
      const top  = isoProject(d.gx, d.gy + d.d, d.h, cx, cy);
      const prog = this.buildProgress[d.id];
      const hBuild = d.h * prog;
      // Bounding rect approximation
      const left  = isoProject(d.gx, d.gy, 0, cx, cy).x;
      const right = isoProject(d.gx + d.w, d.gy + d.d, 0, cx, cy).x;
      const bTop  = isoProject(d.gx + d.w, d.gy, hBuild, cx, cy).y;
      const bBot  = base.y + 4;
      if (mx >= left && mx <= right && my >= bTop && my <= bBot) return d;
    }
    return null;
  }

  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = this._deptAt(mx, my);
    this.hoverId = hit ? hit.id : null;
    this.canvas.style.cursor = hit ? 'pointer' : 'crosshair';
  }

  _onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const hit = this._deptAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      this.selectedId = hit.id;
      this._showCard(hit);
    }
  }

  _showCard(dept) {
    const card = document.getElementById('dept-card');
    document.getElementById('card-icon').textContent = dept.icon;
    document.getElementById('card-icon').style.background = dept.color + '22';
    document.getElementById('card-name').textContent = dept.name;
    document.getElementById('card-tag').textContent = dept.tags.join(' Â· ');

    const header = document.getElementById('card-header');
    header.style.borderBottom = `2px solid ${dept.color}44`;

    document.getElementById('card-desc').textContent = dept.description;

    const agentsEl = document.getElementById('card-agents');
    agentsEl.innerHTML = dept.agents.map(a =>
      `<span class="agent-chip" style="color:${dept.color};border-color:${dept.color}44">${a}</span>`
    ).join('');

    const statsEl = document.getElementById('card-stats');
    const entries = Object.entries(dept.stats).slice(0, 3);
    statsEl.innerHTML = entries.map(([k, v]) =>
      `<div class="stat-item"><div class="stat-val" style="color:${dept.color}">${v}</div><div class="stat-key">${k.replace(/_/g,' ')}</div></div>`
    ).join('');

    const fill = document.getElementById('card-progress-fill');
    fill.style.background = dept.color;
    fill.style.width = '0%';
    setTimeout(() => { fill.style.width = `${(this.buildProgress[dept.id] || 1) * 100}%`; }, 50);

    card.classList.add('visible');
  }

  _closeCard() {
    document.getElementById('dept-card').classList.remove('visible');
    this.selectedId = null;
  }

  /* â”€â”€ MAIN LOOP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  animate(now) {
    const dt = Math.min(now - this.lastTime, 50);
    this.lastTime = now;
    this.tick += dt;

    // Build progress
    for (const d of DEPARTMENTS) {
      if (this.buildProgress[d.id] < 1) {
        const delay = DEPARTMENTS.indexOf(d) * 180;
        if (this.tick > delay) this.buildProgress[d.id] = Math.min(1, this.buildProgress[d.id] + 0.012);
      }
    }

    // Packet movement
    for (const p of this.dataPackets) {
      p.t += p.speed;
      if (p.t > 1) p.t -= 1;
    }

    // Window flickers
    for (const d of DEPARTMENTS) {
      this.windowFlickers[d.id] = this.windowFlickers[d.id].map(f => {
        return Math.random() < 0.02 ? Math.random() : f;
      });
    }

    // Creative particles
    for (const p of this.creativeParticles) {
      p.x += p.vx; p.y += p.vy; p.life += 0.001;
      if (p.x < 0) p.x = 1; if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1; if (p.y > 1) p.y = 0;
    }

    // Camera lerp
    this.camX += (this.targetCamX - this.camX) * 0.06;
    this.camY += (this.targetCamY - this.camY) * 0.06;

    this.starfield.update(dt);
    this._draw();
    requestAnimationFrame(t => this.animate(t));
  }

  /* â”€â”€ DRAW FRAME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  _draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    // Background gradient
    const bg = ctx.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.5, W * 0.8);
    bg.addColorStop(0, '#0a1a3a');
    bg.addColorStop(1, '#020810');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    this.starfield.draw(ctx, W, H);

    if (this.view === 'creative') { this._drawCreative(); return; }
    if (this.view === 'technical') this._drawTechScanLines();

    this._drawGrid();
    this._drawDataStreams();

    // Draw buildings back-to-front
    const sorted = [...DEPARTMENTS].sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy));
    for (const d of sorted) this._drawBuilding(d);
    this._drawLabels();
  }

  _drawGrid() {
    const { ctx, W, H } = this;
    const cx = this.cx + this.camX, cy = this.cy + this.camY;
    ctx.globalAlpha = this.view === 'technical' ? 0.25 : 0.06;
    ctx.strokeStyle = this.view === 'technical' ? '#8b5cf6' : '#334466';
    ctx.lineWidth = 0.5;
    for (let i = -8; i <= 8; i++) {
      const a = isoProject(i, -8, 0, cx, cy), b = isoProject(i, 8, 0, cx, cy);
      const c = isoProject(-8, i, 0, cx, cy), d = isoProject(8, i, 0, cx, cy);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  _drawTechScanLines() {
    const { ctx, W, H } = this;
    this.scanLine = (this.scanLine + 1.5) % H;
    const grd = ctx.createLinearGradient(0, this.scanLine - 2, 0, this.scanLine + 2);
    grd.addColorStop(0, 'rgba(139,92,246,0)');
    grd.addColorStop(0.5, 'rgba(139,92,246,0.06)');
    grd.addColorStop(1, 'rgba(139,92,246,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, this.scanLine - 2, W, 4);
  }

  /* â”€â”€ DATA STREAM LINES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  _drawDataStreams() {
    const { ctx } = this;
    const cx = this.cx + this.camX, cy = this.cy + this.camY;

    for (const p of this.dataPackets) {
      const fromDept = DEPARTMENTS.find(d => d.id === p.from);
      const toDept   = DEPARTMENTS.find(d => d.id === p.to);
      if (!fromDept || !toDept) continue;

      const a = buildingScreenCenter(fromDept, cx, cy);
      const b = buildingScreenCenter(toDept, cx, cy);

      // Connection line
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      const { r, g, b: bl } = hexToRgb(p.color);
      ctx.strokeStyle = `rgba(${r},${g},${bl},0.08)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Travelling packet
      const px = a.x + (b.x - a.x) * p.t;
      const py = a.y + (b.y - a.y) * p.t;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  /* -- DRAW BUILDING ----------------------------------- */
  _drawBuilding(dept) {
    const { ctx } = this;
    const cx = this.cx + this.camX, cy = this.cy + this.camY;
    const prog = this.buildProgress[dept.id];
    if (prog <= 0) return;
    const hBuild = dept.h * prog;
    const isHover = this.hoverId === dept.id;
    const isSelected = this.selectedId === dept.id;
    const col = dept.color;
    const isTech = this.view === 'technical';

    // 8 corner points of the box
    const x0 = dept.gx, y0 = dept.gy;
    const x1 = dept.gx + dept.w, y1 = dept.gy + dept.d;
    const bl_b = isoProject(x0, y1, 0,       cx, cy); // front-left base
    const br_b = isoProject(x1, y1, 0,       cx, cy); // front-right base
    const fl_b = isoProject(x0, y0, 0,       cx, cy); // back-left base
    const fr_b = isoProject(x1, y0, 0,       cx, cy); // back-right base
    const bl_t = isoProject(x0, y1, hBuild,  cx, cy);
    const br_t = isoProject(x1, y1, hBuild,  cx, cy);
    const fl_t = isoProject(x0, y0, hBuild,  cx, cy);
    const fr_t = isoProject(x1, y0, hBuild,  cx, cy);

    if (isTech) {
      // Wireframe mode
      ctx.strokeStyle = col;
      ctx.lineWidth = isHover ? 1.8 : 1;
      ctx.globalAlpha = isHover ? 1 : 0.7;
      const edges = [
        [bl_b, br_b], [br_b, fr_b], [fr_b, fl_b], [fl_b, bl_b],
        [bl_t, br_t], [br_t, fr_t], [fr_t, fl_t], [fl_t, bl_t],
        [bl_b, bl_t], [br_b, br_t], [fr_b, fr_t], [fl_b, fl_t]
      ];
      for (const [a, b] of edges) {
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // Hex address label
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = col;
      ctx.font = '9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      const addr = '0x' + dept.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0).toString(16).toUpperCase().padStart(4, '0');
      ctx.fillText(addr, (bl_t.x + fr_t.x) / 2, fl_t.y - 4);
      ctx.globalAlpha = 1;
      return;
    }

    ctx.globalAlpha = isHover ? 1 : 0.92;

    // LEFT face
    ctx.beginPath();
    ctx.moveTo(bl_b.x, bl_b.y);
    ctx.lineTo(bl_t.x, bl_t.y);
    ctx.lineTo(fl_t.x, fl_t.y);
    ctx.lineTo(fl_b.x, fl_b.y);
    ctx.closePath();
    ctx.fillStyle = shade(col, 0.55);
    ctx.fill();
    if (isHover || isSelected) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // RIGHT face
    ctx.beginPath();
    ctx.moveTo(br_b.x, br_b.y);
    ctx.lineTo(br_t.x, br_t.y);
    ctx.lineTo(fr_t.x, fr_t.y);
    ctx.lineTo(fr_b.x, fr_b.y);
    ctx.closePath();
    ctx.fillStyle = shade(col, 0.7);
    ctx.fill();
    if (isHover || isSelected) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // TOP face
    ctx.beginPath();
    ctx.moveTo(bl_t.x, bl_t.y);
    ctx.lineTo(br_t.x, br_t.y);
    ctx.lineTo(fr_t.x, fr_t.y);
    ctx.lineTo(fl_t.x, fl_t.y);
    ctx.closePath();
    ctx.fillStyle = isHover ? col : shade(col, 1.1);
    ctx.fill();
    if (isHover || isSelected) {
      ctx.shadowColor = col; ctx.shadowBlur = 18;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Glow halo on hover
    if (isHover) {
      const { r, g, b } = hexToRgb(col);
      const grd = ctx.createRadialGradient(
        (bl_t.x + fr_t.x) / 2, fl_t.y, 0,
        (bl_t.x + fr_t.x) / 2, fl_t.y, 60
      );
      grd.addColorStop(0, `rgba(${r},${g},${b},0.18)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grd;
      ctx.fillRect((bl_t.x + fr_t.x) / 2 - 60, fl_t.y - 60, 120, 120);
    }

    // Window glows on right face
    const flickers = this.windowFlickers[dept.id];
    if (flickers && prog > 0.5) {
      const { r, g, b } = hexToRgb(col);
      const cols = 2, rows = Math.min(Math.floor(hBuild * 1.2), 4);
      for (let row = 0; row < rows; row++) {
        for (let col2 = 0; col2 < cols; col2++) {
          const fx = col2 / (cols + 1);
          const fy = (row + 1) / (rows + 1);
          const wx = br_b.x + (fr_b.x - br_b.x) * fx + (br_t.x - br_b.x) * (1 - fy) - 2;
          const wy = br_b.y + (fr_b.y - br_b.y) * fx + (br_t.y - br_b.y) * (1 - fy) - 2;
          const fl = flickers[row * cols + col2] || 0.5;
          ctx.beginPath();
          ctx.rect(wx, wy, 3, 3);
          ctx.fillStyle = `rgba(${r},${g},${b},${0.3 + fl * 0.5})`;
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;
  }

  /* -- LABELS ------------------------------------------ */
  _drawLabels() {
    const { ctx } = this;
    const cx = this.cx + this.camX, cy = this.cy + this.camY;

    for (const d of DEPARTMENTS) {
      const prog = this.buildProgress[d.id];
      if (prog < 0.8) continue;
      const isHover = this.hoverId === d.id;

      const topCenter = isoProject(d.gx + d.w / 2, d.gy + d.d / 2, d.h * prog, cx, cy);
      const yLabel = topCenter.y - 14 - d.h * 3;

      ctx.font = `${isHover ? 600 : 500} ${isHover ? 12 : 11}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      const text = d.name;
      const tw = ctx.measureText(text).width;

      // Pill background
      ctx.fillStyle = isHover ? 'rgba(6,13,31,0.95)' : 'rgba(6,13,31,0.7)';
      ctx.beginPath();
      ctx.roundRect(topCenter.x - tw / 2 - 8, yLabel - 13, tw + 16, 18, 5);
      ctx.fill();

      if (isHover) {
        ctx.strokeStyle = d.color + '88';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = isHover ? d.color : '#b0ccee';
      ctx.globalAlpha = Math.min(1, (prog - 0.8) * 5);
      ctx.fillText(text, topCenter.x, yLabel);
      ctx.globalAlpha = 1;
    }
  }

  /* -- CREATIVE VIEW ----------------------------------- */
  _drawCreative() {
    const { ctx, W, H } = this;
    const cx = this.cx + this.camX, cy = this.cy + this.camY;

    // Nebula haze
    const neb = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, W * 0.6);
    neb.addColorStop(0, 'rgba(60,20,120,0.12)');
    neb.addColorStop(0.4, 'rgba(0,80,160,0.06)');
    neb.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);

    // Constellation lines
    ctx.lineWidth = 0.5;
    for (const [fromId, toId] of DATA_STREAMS) {
      const fd = DEPARTMENTS.find(d => d.id === fromId);
      const td = DEPARTMENTS.find(d => d.id === toId);
      if (!fd || !td) continue;
      const a = buildingScreenCenter(fd, cx, cy);
      const b = buildingScreenCenter(td, cx, cy);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = 'rgba(100,160,255,0.12)';
      ctx.stroke();
    }

    // Ambient particles
    for (const p of this.creativeParticles) {
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,160,255,${0.1 + 0.1 * Math.sin(p.life * 6)})`;
      ctx.fill();
    }

    // Dept nodes
    for (const d of DEPARTMENTS) {
      const prog = this.buildProgress[d.id];
      if (prog < 0.2) continue;
      const sc = buildingScreenCenter(d, cx, cy);
      const isHover = this.hoverId === d.id;
      const { r, g, b } = hexToRgb(d.color);
      const radius = isHover ? 18 : 12;

      // Glow ring
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, radius + 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${isHover ? 0.15 : 0.05})`;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = d.color;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = isHover ? 20 : 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Icon
      ctx.font = `${Math.round(radius * 0.9)}px serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(d.icon, sc.x, sc.y + radius * 0.35);

      // Label
      ctx.font = `500 11px "Space Grotesk", sans-serif`;
      ctx.fillStyle = isHover ? d.color : 'rgba(180,210,255,0.75)';
      ctx.fillText(d.name, sc.x, sc.y + radius + 16);
    }
  }
}

/* -- TICKER -------------------------------------------- */
function initTicker() {
  const msgs = [
    { text: 'ALFRED: The city is alive — 40 agents, 91 skills, all operational.', cls: 'alfred' },
    { text: 'DISPATCH: 4,200 tasks/sec · Queue depth: 12 · Uptime: 99.97%', cls: '' },
    { text: 'FORGE: 3 LoRA training jobs active · GPU utilization: 73%', cls: '' },
    { text: 'CORTEX: Harvesting 34 active data feeds · 12,400 articles indexed', cls: '' },
    { text: 'AVERI: 847 decisions made this epoch · Constitutional compliance: 97.8%', cls: 'alfred' },
    { text: 'MEMORY SPINE: 128K vectors indexed · Recall accuracy: 94.2%', cls: '' },
    { text: 'BROADCAST: 48,200 messages sent · Delivery rate: 98.1%', cls: '' },
    { text: 'ALFRED: All departments nominal. The Engine breathes.', cls: 'alfred' },
  ];
  const track = document.getElementById('ticker-track');
  const all = [...msgs, ...msgs]; // doubled for seamless loop
  track.innerHTML = all.map(m =>
    `<span class="ticker-item ${m.cls}">${m.text}</span>`
  ).join('');
}

/* -- BOOT ---------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  initTicker();

  const splash = document.getElementById('entry-splash');
  const hud = document.getElementById('hud-shell');
  let renderer = null;

  function enterEngine() {
    splash.classList.add('hidden');
    hud.classList.add('visible');
    if (!renderer) renderer = new FlipbookRenderer();
  }

  document.getElementById('enter-btn').addEventListener('click', enterEngine);

  // Auto-enter after 3s if no click
  setTimeout(() => {
    if (!hud.classList.contains('visible')) enterEngine();
  }, 3000);
});

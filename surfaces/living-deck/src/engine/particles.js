/**
 * ParticleEngine — WebGL2 Canvas Particle System
 * Renders 50K–200K particles driven by biometric arousal state.
 * Uses instanced rendering for performance.
 */

const VERTEX_SHADER = `#version 300 es
  precision highp float;

  in vec3 a_position;
  in float a_size;
  in float a_life;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_arousal;

  out float v_life;
  out float v_dist;

  void main() {
    vec2 screenPos = a_position.xy / u_resolution * 2.0 - 1.0;
    screenPos.y *= -1.0;

    gl_Position = vec4(screenPos, a_position.z * 0.5, 1.0);

    // Point size: base 2–6px, scales up with arousal and particle's own size
    float baseSize = a_size * (1.5 + u_arousal * 3.0);
    // Depth attenuation: further particles are smaller
    baseSize *= (0.4 + (1.0 - a_position.z) * 0.6);
    gl_PointSize = baseSize;

    v_life = a_life;
    v_dist = length(a_position.xy - u_resolution * 0.5) / length(u_resolution * 0.5);
  }
`;

const FRAGMENT_SHADER = `#version 300 es
  precision highp float;

  in float v_life;
  in float v_dist;

  uniform float u_arousal;
  uniform float u_heartPhase;
  uniform vec3 u_colorCalm;
  uniform vec3 u_colorExcited;
  uniform vec3 u_colorAccent;

  out vec4 fragColor;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float d = length(uv);
    if (d > 1.0) discard;

    // Soft radial glow falloff
    float alpha = pow(1.0 - d, 2.0) * v_life;

    // Color interpolation based on arousal
    vec3 baseColor = mix(u_colorCalm, u_colorExcited, u_arousal);

    // Accent flash on heartbeat — brighter near center
    float beatFlash = smoothstep(0.0, 0.12, u_heartPhase) * smoothstep(0.25, 0.12, u_heartPhase);
    baseColor = mix(baseColor, u_colorAccent, beatFlash * 0.6 * (1.0 - v_dist * 0.7));

    // Brightness boost
    alpha *= 0.8 + u_arousal * 0.5;

    // Additive output (premultiply)
    fragColor = vec4(baseColor * alpha, alpha);
  }
`;

export class ParticleEngine {
  constructor(canvas, particleCount = 80000) {
    this.canvas = canvas;
    this.count = particleCount;
    this.gl = null;
    this.program = null;
    this.particles = null;
    this.velocities = null;
    this.time = 0;
    this.arousal = 0;
    this.heartPhase = 0;
    this.cameraFocus = { x: 0.5, y: 0.5 };
    this._animId = null;
  }

  async init() {
    const gl = this.canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      console.warn('[ParticleEngine] WebGL2 not available, falling back to CSS mode');
      return false;
    }

    this.gl = gl;
    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Compile shaders
    this.program = this._createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
    gl.useProgram(this.program);

    // Initialize particle data
    this._initParticles();

    // Enable blending for additive glow
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // Additive
    gl.disable(gl.DEPTH_TEST);

    return true;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    if (this.gl) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  _initParticles() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // position (x, y, z) + size + life = 5 floats per particle
    this.particles = new Float32Array(this.count * 5);
    this.velocities = new Float32Array(this.count * 2);

    for (let i = 0; i < this.count; i++) {
      const idx = i * 5;
      this.particles[idx + 0] = Math.random() * w;     // x
      this.particles[idx + 1] = Math.random() * h;     // y
      this.particles[idx + 2] = Math.random();          // z (depth)
      this.particles[idx + 3] = 2.0 + Math.random() * 5.0; // size (larger for visibility)
      this.particles[idx + 4] = 0.3 + Math.random() * 0.7; // life/opacity

      const vi = i * 2;
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.3;
      this.velocities[vi + 0] = Math.cos(angle) * speed;
      this.velocities[vi + 1] = Math.sin(angle) * speed;
    }

    // Create GL buffers
    const gl = this.gl;
    this.posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.particles, gl.DYNAMIC_DRAW);
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('VS:', gl.getShaderInfoLog(vs));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('FS:', gl.getShaderInfoLog(fs));
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Link:', gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  update(dt, arousal, heartPhase) {
    this.arousal = arousal;
    this.heartPhase = heartPhase;
    this.time += dt;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const speedMul = 0.5 + arousal * 2.5;
    const turbulence = arousal * 0.8;
    const cx = w * this.cameraFocus.x;
    const cy = h * this.cameraFocus.y;

    for (let i = 0; i < this.count; i++) {
      const idx = i * 5;
      const vi = i * 2;

      // Orbital drift toward camera focus
      const dx = cx - this.particles[idx + 0];
      const dy = cy - this.particles[idx + 1];
      const dist = Math.sqrt(dx * dx + dy * dy) + 1;
      const pullStrength = 0.00005 + arousal * 0.0002;

      this.velocities[vi + 0] += (dx / dist) * pullStrength;
      this.velocities[vi + 1] += (dy / dist) * pullStrength;

      // Turbulence
      if (turbulence > 0.01) {
        this.velocities[vi + 0] += (Math.random() - 0.5) * turbulence * 0.1;
        this.velocities[vi + 1] += (Math.random() - 0.5) * turbulence * 0.1;
      }

      // Heartbeat pulse push
      if (heartPhase < 0.2) {
        const pushStrength = (0.2 - heartPhase) * 2.0 * (1.0 + arousal);
        this.velocities[vi + 0] += (this.particles[idx + 0] - cx) / dist * pushStrength * 0.05;
        this.velocities[vi + 1] += (this.particles[idx + 1] - cy) / dist * pushStrength * 0.05;
      }

      // Damping
      this.velocities[vi + 0] *= 0.995;
      this.velocities[vi + 1] *= 0.995;

      // Integrate
      this.particles[idx + 0] += this.velocities[vi + 0] * speedMul;
      this.particles[idx + 1] += this.velocities[vi + 1] * speedMul;

      // Wrap around
      if (this.particles[idx + 0] < -20) this.particles[idx + 0] = w + 20;
      if (this.particles[idx + 0] > w + 20) this.particles[idx + 0] = -20;
      if (this.particles[idx + 1] < -20) this.particles[idx + 1] = h + 20;
      if (this.particles[idx + 1] > h + 20) this.particles[idx + 1] = -20;

      // Life pulse with heartbeat
      this.particles[idx + 4] = 0.2 + 0.5 * (1.0 + Math.sin(this.time * 0.5 + i * 0.01)) * 0.5;
    }
  }

  render() {
    const gl = this.gl;
    if (!gl) return;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    // Update particle buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.particles);

    // Set attributes
    const posLoc = gl.getAttribLocation(this.program, 'a_position');
    const sizeLoc = gl.getAttribLocation(this.program, 'a_size');
    const lifeLoc = gl.getAttribLocation(this.program, 'a_life');

    const stride = 5 * 4; // 5 floats, 4 bytes each
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);

    if (sizeLoc >= 0) {
      gl.enableVertexAttribArray(sizeLoc);
      gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, 12);
    }
    if (lifeLoc >= 0) {
      gl.enableVertexAttribArray(lifeLoc);
      gl.vertexAttribPointer(lifeLoc, 1, gl.FLOAT, false, stride, 16);
    }

    // Set uniforms
    const resLoc = gl.getUniformLocation(this.program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(this.program, 'u_time');
    const arousalLoc = gl.getUniformLocation(this.program, 'u_arousal');
    const heartLoc = gl.getUniformLocation(this.program, 'u_heartPhase');
    const calmLoc = gl.getUniformLocation(this.program, 'u_colorCalm');
    const excitedLoc = gl.getUniformLocation(this.program, 'u_colorExcited');
    const accentLoc = gl.getUniformLocation(this.program, 'u_colorAccent');

    gl.uniform2f(resLoc, this.canvas.width, this.canvas.height);
    gl.uniform1f(timeLoc, this.time);
    gl.uniform1f(arousalLoc, this.arousal);
    gl.uniform1f(heartLoc, this.heartPhase);
    gl.uniform3f(calmLoc, 0.53, 0.35, 0.87);     // indigo
    gl.uniform3f(excitedLoc, 0.92, 0.45, 0.30);   // amber
    gl.uniform3f(accentLoc, 0.40, 0.85, 0.95);    // cyan

    // Enable point rendering
    gl.drawArrays(gl.POINTS, 0, this.count);
  }

  start() {
    let lastTime = performance.now();
    const loop = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      this.update(dt, this.arousal, this.heartPhase);
      this.render();
      this._animId = requestAnimationFrame(loop);
    };
    this._animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._animId) cancelAnimationFrame(this._animId);
  }

  setArousal(v) { this.arousal = Math.max(0, Math.min(1, v)); }
  setHeartPhase(v) { this.heartPhase = v; }
  setCameraFocus(x, y) { this.cameraFocus = { x, y }; }
}

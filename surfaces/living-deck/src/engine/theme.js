/**
 * ThemeEngine — Real-time CSS Custom Property interpolation
 * Drives the entire visual palette based on normalized arousal (0.0–1.0)
 */

// HSL color specs for calm and excited states
const PALETTE = {
  calm: {
    particlePrimary:   [260, 80, 65],
    particleSecondary: [220, 70, 55],
    particleAccent:    [190, 90, 60],
    pulseColor:        [190, 90, 60],
    textAccent:        [190, 90, 60],
    pulseGlow:         [190, 80, 70, 0.15],
  },
  excited: {
    particlePrimary:   [15, 90, 60],
    particleSecondary: [330, 85, 55],
    particleAccent:    [45, 95, 65],
    pulseColor:        [15, 90, 60],
    textAccent:        [45, 95, 65],
    pulseGlow:         [15, 80, 60, 0.20],
  },
};

function lerpHSL(a, b, t) {
  // Handle hue wrapping
  let dh = b[0] - a[0];
  if (Math.abs(dh) > 180) {
    if (dh > 0) dh -= 360;
    else dh += 360;
  }
  const h = ((a[0] + dh * t) % 360 + 360) % 360;
  const s = a[1] + (b[1] - a[1]) * t;
  const l = a[2] + (b[2] - a[2]) * t;
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

function lerpHSLA(a, b, t) {
  let dh = b[0] - a[0];
  if (Math.abs(dh) > 180) {
    if (dh > 0) dh -= 360;
    else dh += 360;
  }
  const h = ((a[0] + dh * t) % 360 + 360) % 360;
  const s = a[1] + (b[1] - a[1]) * t;
  const l = a[2] + (b[2] - a[2]) * t;
  const alpha = (a[3] || 0.15) + ((b[3] || 0.20) - (a[3] || 0.15)) * t;
  return `hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${alpha.toFixed(2)})`;
}

export class ThemeEngine {
  constructor() {
    this.root = document.documentElement;
    this.currentArousal = 0;
    this.targetArousal = 0;
    this.smoothingFactor = 0.05; // Smooth transitions
  }

  /**
   * Update the theme based on arousal (0.0 = calm, 1.0 = excited)
   * Call this on every animation frame for smooth transitions
   */
  update(targetArousal) {
    this.targetArousal = Math.max(0, Math.min(1, targetArousal));

    // Exponential smoothing
    this.currentArousal += (this.targetArousal - this.currentArousal) * this.smoothingFactor;
    const t = this.currentArousal;

    const { calm, excited } = PALETTE;

    // Update CSS custom properties
    this.root.style.setProperty('--arousal', t.toFixed(3));
    this.root.style.setProperty('--particle-primary', lerpHSL(calm.particlePrimary, excited.particlePrimary, t));
    this.root.style.setProperty('--particle-secondary', lerpHSL(calm.particleSecondary, excited.particleSecondary, t));
    this.root.style.setProperty('--particle-accent', lerpHSL(calm.particleAccent, excited.particleAccent, t));
    this.root.style.setProperty('--pulse-color', lerpHSL(calm.pulseColor, excited.pulseColor, t));
    this.root.style.setProperty('--text-accent', lerpHSL(calm.textAccent, excited.textAccent, t));
    this.root.style.setProperty('--pulse-glow', lerpHSLA(calm.pulseGlow, excited.pulseGlow, t));

    // Glass opacity increases slightly with arousal
    const glassBg = `rgba(255, 255, 255, ${(0.05 + t * 0.04).toFixed(3)})`;
    const glassBorder = `rgba(255, 255, 255, ${(0.10 + t * 0.08).toFixed(3)})`;
    this.root.style.setProperty('--glass-bg', glassBg);
    this.root.style.setProperty('--glass-border', glassBorder);
  }

  getArousal() {
    return this.currentArousal;
  }
}

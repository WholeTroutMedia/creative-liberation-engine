export const DESIGNS = {
  monolith: {
    id: 'monolith',
    label: 'Obsidian Monolith',
    description: 'Deep #050505 space-black canvas, thin hairline borders with only 6% opacity, high-contrast gold brass (#C9A84C) and white text, zero glow premium minimalism.',
    image: '/design_direction_1.png'
  },
  holographic: {
    id: 'holographic',
    label: 'Holographic Obsidian',
    description: 'Deep midnight indigo canvas, micro-illuminated cold titanium blue borders, frosted bento cards, high backdrop-blur, and neon glows.',
    image: '/design_direction_2.png'
  },
  editorial: {
    id: 'editorial',
    label: 'Cinematic Editorial',
    description: 'Pure dark obsidian canvas, Outfit & Instrument Serif elegant typography, generous whitespace, gold and cream-white editorial stencils.',
    image: '/design_direction_3.png'
  },
  brutalism: {
    id: 'brutalism',
    label: 'Industrial Brutalism',
    description: 'Raw slate gray (#1A1D21) grid cells separated by solid orange (#F59E0B) borders, full JetBrains Mono monospaced text, sharp corners, and tactical crosshairs.',
    image: '/design_direction_4.png'
  },
  terminal: {
    id: 'terminal',
    label: 'Sovereign Terminal',
    description: 'High-tech console theme with matrix green (#4ade80) glows, syslog telemetry data streams, active schemas, and command console blocks.',
    image: '/design_direction_5.png'
  }
};

export function getActiveDesign() {
  const stored = localStorage.getItem('cle-design');
  if (stored && DESIGNS[stored]) return DESIGNS[stored];
  return DESIGNS.monolith; // Default design
}

export function setActiveDesign(id) {
  if (!DESIGNS[id]) return;
  localStorage.setItem('cle-design', id);
  applyDesignTheme(DESIGNS[id]);
}

export function applyDesignTheme(design) {
  const root = document.documentElement;
  root.setAttribute('data-design', design.id);
  
  // Set design background reference
  root.style.setProperty('--design-ref-image', `url(${design.image})`);
}

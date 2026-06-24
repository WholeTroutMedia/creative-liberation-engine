export const PERSONAS = {
  investor: {
    id: 'investor',
    label: 'Investor',
    description: 'VCs, Decision Makers & Executives',
    accent: '#10b981',
    fontWeight: '300',
    tagline: 'The Financial & Platform Growth Case',
  },
  engineer: {
    id: 'engineer',
    label: 'Engineer',
    description: 'Developers, Architects & DevOps',
    accent: '#0ea5e9',
    fontWeight: '400',
    tagline: 'The Self-Hosted Technical Architecture',
  },
  creative: {
    id: 'creative',
    label: 'Creative',
    description: 'Artists, Producers & Directors',
    accent: '#c9a84c',
    fontWeight: '500',
    tagline: 'The Artist Liberation Framework',
  },
  strategist: {
    id: 'strategist',
    label: 'Strategist',
    description: 'Marketers, Growth & Partnerships',
    accent: '#f59e0b',
    fontWeight: '500',
    tagline: 'The Immersive Entertainment Thesis',
  },
  security: {
    id: 'security',
    label: 'Security',
    description: 'Government, Compliance & SecOps',
    accent: '#f43f5e', // Guardian Rose/Red
    fontWeight: '500',
    tagline: 'The Sovereign Compliance & Residency Framework',
  },
};

export function getActivePersona() {
  const hash = window.location.hash.replace('#', '');
  if (PERSONAS[hash]) return PERSONAS[hash];
  const stored = localStorage.getItem('cle-persona');
  if (stored && PERSONAS[stored]) return PERSONAS[stored];
  return null; // Return null if no active persona (meaning: show hero selection slide)
}

export function setActivePersona(id) {
  if (!PERSONAS[id]) return;
  localStorage.setItem('cle-persona', id);
  window.location.hash = id;
  applyPersonaTheme(PERSONAS[id]);
}

export function applyPersonaTheme(persona) {
  const root = document.documentElement;
  root.setAttribute('data-persona', persona.id);
  
  // Set global custom styles
  root.style.setProperty('--accent', persona.accent);
  root.style.setProperty('--persona-font-weight', persona.fontWeight);
}

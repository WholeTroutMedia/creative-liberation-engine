import { parseHelixReport, BentoBuilder } from './data-parser.js';

const report = parseHelixReport();

export const slideDataPart1 = [
  // SLIDE 1: HELIX 5 EXECUTION REPORT OVERVIEW
  BentoBuilder.createTile({
    span: 'span-12 row-1',
    className: 'bento-hero',
    interactive: false,
    subtitle: 'Execution Report: Phase 1 & 2',
    content: `
      <h1 style="font-size: 2.5rem; margin-top: 0.5rem;">Helix 5: Sovereign Agentic Environment</h1>
      <p style="color: var(--text-2); font-size: 1.1rem; max-width: 800px;">
        Telemetry mathematically synthesized from Helix-5-Report.md
      </p>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-4 row-3',
    className: 'bg-gradient-blue',
    subtitle: 'MCP Integration',
    title: 'TACO Context Compression',
    content: `
      <ul style="margin-top: 1rem; color: var(--text-2);">
        ${report.mcpTaco.map(item => `<li style="margin-bottom: 0.5rem;">${item}</li>`).join('')}
      </ul>
      <div class="bento-meta" style="margin-top: auto;">
        <span>Saves token budgets for long-horizon planning.</span>
      </div>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-4 row-3',
    className: 'bg-gradient-purple',
    subtitle: 'MCP Integration',
    title: 'OpenGame Meta-Skills Architect',
    content: `
      <ul style="margin-top: 1rem; color: var(--text-2);">
        ${report.mcpOpenGame.map(item => `<li style="margin-bottom: 0.5rem;">${item}</li>`).join('')}
      </ul>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-4 row-3',
    subtitle: 'System Topology',
    title: 'Registry Mapping',
    content: `
      <ul class="stream-list" style="margin-top: 1rem;">
        ${Object.entries(report.topology).map(([key, value]) => `
          <li class="stream-item">
            <div class="stream-icon"><i class="ph-fill ph-funnel"></i></div>
            <div class="stream-content">
              <div class="stream-author">${key}</div>
              <div class="stream-text">${value}</div>
            </div>
          </li>
        `).join('')}
      </ul>
    `
  }),

  // SLIDE 2: LIVE VALIDATION & NEXT MODES
  BentoBuilder.createTile({
    span: 'span-7 row-3',
    subtitle: 'Validation',
    title: 'Live Execution on NAS',
    content: `
      <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop" class="bento-media" alt="Server Operations" style="opacity: 0.4;" />
      <p style="font-size: 1.1rem; line-height: 1.6;">
        Validation tests executed against Helix 5:
      </p>
      <div style="background: var(--surface-2); padding: 1rem; border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 0.9rem; margin-top: 1rem; border: 1px solid var(--glass-border);">
        ${report.tests.map(test => `<span style="color: var(--accent);">></span> Verified: ${test}<br>`).join('')}
      </div>
      <div class="bento-meta" style="margin-top: auto;">
        <span style="font-weight: 600; color: #4ade80;">STATUS: ALIVE & INTEGRATED</span>
        <i class="ph-fill ph-check-circle" style="color: #4ade80; font-size: 1.5rem;"></i>
      </div>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-5 row-3',
    className: 'bg-gradient-green',
    subtitle: 'Phases 3 & 4',
    title: 'Next Modes',
    content: `
      <p>Immediate execution queue for the Creative Liberation Engine swarm.</p>
      <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.8rem; color: var(--accent); margin-bottom: 0.2rem; font-family: var(--font-mono);">IE-IDX-0074</div>
          <div style="font-weight: 500;">Full Sovereign Website Automation Engine</div>
          <div style="font-size: 0.85rem; color: var(--text-2); margin-top: 0.3rem;">Claude Code Workflow Integration.</div>
        </div>
        <div style="background: rgba(0,0,0,0.2); padding: 1rem; border-radius: var(--radius-md);">
          <div style="font-size: 0.8rem; color: var(--accent); margin-bottom: 0.2rem; font-family: var(--font-mono);">IE-IDX-0072</div>
          <div style="font-weight: 500;">Personal Agentic Hypervisor</div>
          <div style="font-size: 0.85rem; color: var(--text-2); margin-top: 0.3rem;">Advanced swarm orchestration and workload management.</div>
        </div>
      </div>
    `
  })
];

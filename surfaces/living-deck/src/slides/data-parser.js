import nvidiaJson from '../data/nvidia-curriculum.json';
import helixReportRaw from '../data/Helix-5-Report.md?raw';

/**
 * Mathematically parses the Helix 5 Report Markdown into structured telemetry objects.
 */
export function parseHelixReport() {
  const lines = helixReportRaw.split('\n');
  const parsed = {
    mcpTaco: [],
    mcpOpenGame: [],
    tests: [],
    topology: {}
  };

  let currentContext = null;

  lines.forEach(line => {
    if (line.includes('TACO Context compression tool built')) currentContext = 'taco';
    if (line.includes('OpenGame MCP tool initialized')) currentContext = 'opengame';
    if (line.includes('Validation test suite `live-test-helix5.mjs` executed')) currentContext = 'tests';
    if (line.includes('Architecture Registry Sync')) currentContext = 'topology';

    if (line.startsWith('- ')) {
      const bullet = line.substring(2).trim();
      if (currentContext === 'taco') parsed.mcpTaco.push(bullet);
      if (currentContext === 'opengame') parsed.mcpOpenGame.push(bullet);
      if (currentContext === 'tests') parsed.tests.push(bullet);
      if (currentContext === 'topology') {
        const parts = bullet.split(':');
        if (parts.length === 2) {
            parsed.topology[parts[0].trim()] = parts[1].trim();
        }
      }
    }
  });

  return parsed;
}

/**
 * Returns the parsed Udemy RAG data for automated mapping.
 */
export function getNvidiaCurriculum() {
  return nvidiaJson;
}

/**
 * A mathematical template builder for Bento items.
 * Renders data dynamically.
 */
export class BentoBuilder {
  static createTile({ span = 'col-4 row-2', className = '', title, subtitle, content, interactive = true }) {
    const expandBtn = interactive ? `<button class="btn-close-expand"><i class="ph ph-x"></i></button>` : '';
    const interactiveClass = interactive ? 'interactive' : '';
    return `
      <div class="bento-item ${span} ${className} ${interactiveClass}">
        ${expandBtn}
        ${subtitle ? `<div class="bento-header-label">${subtitle}</div>` : ''}
        ${title ? `<h3>${title}</h3>` : ''}
        ${content}
      </div>
    `;
  }
}

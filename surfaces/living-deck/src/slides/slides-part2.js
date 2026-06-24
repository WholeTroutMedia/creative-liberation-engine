import { getNvidiaCurriculum, BentoBuilder } from './data-parser.js';

const udemy = getNvidiaCurriculum();
const sec1to3 = udemy.curriculum.filter(c => c.section >= 1 && c.section <= 3);
const sec4to5 = udemy.curriculum.filter(c => c.section >= 4 && c.section <= 5);
const sec6to7 = udemy.curriculum.filter(c => c.section >= 6 && c.section <= 7);

export const slideDataPart2 = [
  // SLIDE 3: RAG KNOWLEDGE INTEGRATION (UDEMY NCP-AAI)
  BentoBuilder.createTile({
    span: 'span-12 row-1',
    className: 'bg-gradient-purple',
    interactive: false,
    content: `
      <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; flex-direction: row; align-items: center; gap: 1.5rem;">
          <i class="ph-fill ph-book-open-text" style="font-size: 3rem; color: var(--accent);"></i>
          <div>
            <span class="tag" style="margin-bottom: 0.5rem;">Knowledge Harvest</span>
            <h2 style="margin-bottom: 0;">${udemy.title}</h2>
          </div>
        </div>
        <div class="bento-meta" style="flex-direction: column; align-items: flex-end; justify-content: center; height: 100%;">
          <span style="font-family: var(--font-mono); color: var(--accent);">Status: ${udemy.ragStatus}</span>
          <span style="font-size: 0.8rem; color: var(--text-2);">Ingested: ${udemy.harvestedAt}</span>
        </div>
      </div>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-4 row-3',
    subtitle: 'Foundation',
    title: 'Sections 1 - 3',
    content: `
      <ul style="list-style: none; padding: 0; color: var(--text-2); font-size: 0.9rem; line-height: 1.8; margin-top: 1rem;">
        ${sec1to3.map(sec => `<li><strong style="color: var(--text-1);">Sec ${sec.section}:</strong> ${sec.title}</li>`).join('')}
      </ul>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-4 row-3',
    className: 'bg-gradient-blue',
    subtitle: 'Operations',
    title: 'Sections 4 - 5',
    content: `
      <ul style="list-style: none; padding: 0; color: var(--text-2); font-size: 0.9rem; line-height: 1.8; margin-top: 1rem;">
        ${sec4to5.map(sec => `<li><strong style="color: var(--text-1);">Sec ${sec.section}:</strong> ${sec.title}</li>`).join('')}
      </ul>
      <div class="bento-meta" style="margin-top: auto;">
        <span>Guardrails & Safety</span>
        <i class="ph-fill ph-shield-check" style="color: var(--accent);"></i>
      </div>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-4 row-3',
    subtitle: 'Application',
    title: 'Sections 6 - 7',
    content: `
      <ul style="list-style: none; padding: 0; color: var(--text-2); font-size: 0.9rem; line-height: 1.8; margin-top: 1rem;">
        ${sec6to7.map(sec => `<li><strong style="color: var(--text-1);">Sec ${sec.section}:</strong> ${sec.title}</li>`).join('')}
      </ul>
    `
  }),

  // SLIDE 4: IMMERSIVE MEDIA & INTELLIGENCE STREAM
  BentoBuilder.createTile({
    span: 'span-7 row-3',
    className: 'bento-embed',
    interactive: true,
    content: `
      <iframe src="https://www.youtube.com/embed/zjkBMFhNj_g?rel=0&modestbranding=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-5 row-2',
    content: `
      <span class="tag" style="margin-bottom: 1rem;"><i class="ph ph-twitter-logo"></i> Intelligence Stream</span>
      
      <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: var(--radius-md); border-left: 2px solid var(--accent); margin-bottom: 1rem;">
        <h4 style="margin-bottom: 0.2rem; font-size: 1rem;">NVIDIA Developer</h4>
        <p style="margin-bottom: 0; font-size: 0.9rem; color: var(--text-2);">"Agentic AI transforms simple chatbots into autonomous systems capable of executing complex multi-step tasks across enterprise workflows."</p>
      </div>

      <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: var(--radius-md); border-left: 2px solid #a855f7;">
        <h4 style="margin-bottom: 0.2rem; font-size: 1rem;">CORTEX Integration</h4>
        <p style="margin-bottom: 0; font-size: 0.9rem; color: var(--text-2);">"NAS deployment complete. Autonomous harvesting of Udacity and Coursera AI curricula proceeding smoothly."</p>
      </div>
    `
  }) +

  BentoBuilder.createTile({
    span: 'span-5 row-1',
    className: '',
    content: `
      <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; height: 100%; background: var(--text-1); color: var(--bg-color); padding: 1.5rem; border-radius: var(--radius-lg); margin: -1.5rem;">
        <h2 style="margin-bottom: 0; color: var(--bg-color); font-size: 1.2rem;">Resume Swarm Operations</h2>
        <button class="bento-action" style="background: var(--bg-color); color: var(--text-1); border: none; font-size: 1rem; padding: var(--space-2) var(--space-3);">
          Dispatch <i class="ph ph-rocket-launch"></i>
        </button>
      </div>
    `
  })
];

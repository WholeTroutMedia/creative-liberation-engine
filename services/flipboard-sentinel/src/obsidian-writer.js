/**
 * Flipboard Sentinel — Obsidian Writer
 * Generates rich Obsidian-compatible markdown notes with YAML frontmatter,
 * callout blocks, and commentable sections.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.js';
import { routeManifestToThemes, linkJobToThemeFile } from './workstream-router.js';
/**
 * Write an ideation job to the Obsidian vault as a rich markdown note.
 */
export function writeObsidianNote(manifest, crossRefs = []) {
    const dir = CONFIG.obsidianSentinelDir;
    fs.mkdirSync(dir, { recursive: true });
    // Dynamic Bi-Directional Workstream Routing Integration
    if (manifest.status === 'IDEATED') {
        try {
            const { primaryTheme, score } = routeManifestToThemes(manifest);
            if (primaryTheme) {
                console.log(`[SENTINEL] 📡 Workstream Route: ${manifest.jobId} ➔ ${primaryTheme.id} (confidence: ${score})`);
                linkJobToThemeFile(manifest, primaryTheme);
            }
        }
        catch (err) {
            console.error(`[SENTINEL] ❌ Failed to route job to strategic theme: ${err.message}`);
        }
    }
    const filePath = path.join(dir, `${manifest.filename}.md`);
    const content = buildNoteContent(manifest, crossRefs);
    fs.writeFileSync(filePath, content);
    console.log(`[SENTINEL] 📝 Obsidian note written: ${manifest.filename}.md`);
}
/**
 * Build the full markdown content for an Obsidian note.
 */
function buildNoteContent(manifest, crossRefs) {
    const { jobId, slug, status, sourceArticle, categories, inceptionRelevance, athenaOutput } = manifest;
    const athena = athenaOutput;
    const lines = [];
    // Run work-stream routing for note integration
    let themeId = '';
    let themeName = '';
    let themePath = '';
    let routeScore = 0;
    try {
        const { primaryTheme, score } = routeManifestToThemes(manifest);
        if (primaryTheme) {
            themeId = primaryTheme.id;
            themeName = primaryTheme.name;
            themePath = primaryTheme.path;
            routeScore = score;
        }
    }
    catch { /* Fail silently */ }
    // ── YAML Frontmatter ──
    lines.push('---');
    lines.push(`job_id: "${jobId}"`);
    lines.push(`slug: "${slug}"`);
    lines.push(`status: "${status}"`);
    lines.push(`inception_relevance: ${inceptionRelevance}`);
    if (themeId) {
        lines.push(`theme_id: "${themeId}"`);
        lines.push(`work_stream: "${escapeYaml(themeName)}"`);
    }
    lines.push(`categories: [${categories.map(c => `"${c}"`).join(', ')}]`);
    lines.push(`source_title: "${escapeYaml(sourceArticle.title)}"`);
    lines.push(`source_url: "${sourceArticle.url}"`);
    lines.push(`source_author: "${escapeYaml(sourceArticle.author)}"`);
    lines.push(`source_date: "${sourceArticle.pubDate}"`);
    if (manifest.relatedJobs.length > 0) {
        lines.push(`related_jobs: [${manifest.relatedJobs.map(j => `"${j}"`).join(', ')}]`);
    }
    lines.push(`created_at: "${manifest.createdAt}"`);
    if (manifest.ideatedAt)
        lines.push(`ideated_at: "${manifest.ideatedAt}"`);
    lines.push(`tags: [sentinel, ideation, ${categories.join(', ')}]`);
    lines.push('---');
    lines.push('');
    // ── Title ──
    lines.push(`# ${jobId}: ${sourceArticle.title}`);
    lines.push('');
    // ── Status Badge ──
    const statusEmoji = { PENDING: '⏳', IDEATED: '💡', PLANNED: '📋', SHIPPED: '🚀', VALIDATED: '✅', ARCHIVED: '🗄️', DISCARDED: '🗑️' };
    lines.push(`> **Status:** ${statusEmoji[status] || '❓'} ${status} | **Relevance:** ${inceptionRelevance}/100`);
    if (themeId) {
        const themeBasename = themePath ? path.basename(themePath, '.md') : '';
        lines.push(`> **Strategic Theme:** 📡 [${themeName}](file:///app/docs/epics/${themeBasename}.md) (ID: \`${themeId}\` | Confidence: \`${Math.round(routeScore * 100)}%\`)`);
    }
    lines.push('');
    // ── Source Article ──
    lines.push('## 📰 Source Article');
    lines.push('');
    lines.push(`- **Title:** [${sourceArticle.title}](${sourceArticle.url})`);
    lines.push(`- **Author:** ${sourceArticle.author}`);
    lines.push(`- **Published:** ${new Date(sourceArticle.pubDate).toLocaleDateString()}`);
    lines.push(`- **Categories:** ${categories.map(c => `\`${c}\``).join(' ')}`);
    lines.push('');
    if (!athena) {
        lines.push('> [!warning] Awaiting ATHENA Ideation');
        lines.push('> This job is pending ATHENA strategic analysis.');
        lines.push('');
    }
    else {
        // ── ATHENA Directive ──
        lines.push('## 🧠 ATHENA Directive');
        lines.push('');
        lines.push('> [!tip] Primary Directive');
        lines.push(`> ${athena.directive}`);
        lines.push('');
        // ── Rationale ──
        lines.push('### Rationale');
        lines.push('');
        lines.push(athena.rationale);
        lines.push('');
        // ── Strategic Options ──
        if (athena.options.length > 0) {
            lines.push('## ⚡ Strategic Options');
            lines.push('');
            for (const opt of athena.options) {
                const recEmoji = opt.recommendation === 'preferred' ? '✅' :
                    opt.recommendation === 'viable' ? '🟡' : '🔴';
                lines.push(`### ${recEmoji} ${opt.title}`);
                lines.push('');
                lines.push(opt.description);
                lines.push('');
                lines.push(`> **Tradeoffs:** ${opt.tradeoffs}`);
                lines.push(`> **Recommendation:** \`${opt.recommendation.toUpperCase()}\``);
                lines.push('');
            }
        }
        // ── Suggested Agents ──
        if (athena.suggestedAgents.length > 0) {
            lines.push('## 🤖 Suggested Agents');
            lines.push('');
            for (const agent of athena.suggestedAgents) {
                lines.push(`- **${agent}**`);
            }
            lines.push('');
        }
        // ── Constitutional Flags ──
        if (athena.constitutionalFlags.length > 0) {
            lines.push('## ⚖️ Constitutional Flags');
            lines.push('');
            lines.push('> [!important] Constitutional Articles Triggered');
            for (const flag of athena.constitutionalFlags) {
                lines.push(`> - ${flag}`);
            }
            lines.push('');
        }
        // ── Next Mode ──
        lines.push(`**Recommended Next Mode:** \`${athena.nextMode}\``);
        lines.push('');
    }
    // ── Cross References ──
    if (crossRefs.length > 0) {
        lines.push('## 🔗 Related Ideations');
        lines.push('');
        lines.push('> [!note] Merge Candidates Detected');
        lines.push('> These existing ideation jobs share significant topic overlap.');
        lines.push('');
        for (const ref of crossRefs) {
            lines.push(`- [[${ref.relatedJobId}_${ref.relatedSlug}]] — Similarity: ${Math.round(ref.similarityScore * 100)}%`);
            if (ref.sharedCategories.length > 0) {
                lines.push(`  - Shared categories: ${ref.sharedCategories.map(c => `\`${c}\``).join(', ')}`);
            }
            if (ref.sharedKeywords.length > 0) {
                lines.push(`  - Shared keywords: ${ref.sharedKeywords.slice(0, 5).join(', ')}`);
            }
        }
        lines.push('');
    }
    // ── Operator Notes (Commentable Section) ──
    lines.push('---');
    lines.push('');
    lines.push('## ✏️ Operator Notes');
    lines.push('');
    lines.push('_Write your review comments below. Sentinel will pick these up on next sync._');
    lines.push('');
    lines.push('');
    lines.push('');
    return lines.join('\n');
}
/**
 * Generate the Sentinel Dashboard — a Map of Content for all ideations.
 */
export function writeSentinelDashboard() {
    const dir = CONFIG.obsidianSentinelDir;
    fs.mkdirSync(dir, { recursive: true });
    const dashPath = path.join(dir, '_Sentinel Dashboard.md');
    const lines = [];
    lines.push('---');
    lines.push('tags: [sentinel, dashboard, moc]');
    lines.push(`updated: "${new Date().toISOString()}"`);
    lines.push('---');
    lines.push('');
    lines.push('# 📡 Sentinel Dashboard');
    lines.push('');
    lines.push('> Autonomous ideation pipeline — powered by ATHENA');
    lines.push('');
    // Dataview queries for Obsidian Dataview plugin
    lines.push('## Active Ideations');
    lines.push('');
    lines.push('```dataview');
    lines.push('TABLE status, inception_relevance as "Relevance", source_author as "Author", created_at as "Created"');
    lines.push('FROM "Sentinel"');
    lines.push('WHERE status != "ARCHIVED"');
    lines.push('SORT inception_relevance DESC');
    lines.push('```');
    lines.push('');
    lines.push('## By Category');
    lines.push('');
    lines.push('```dataview');
    lines.push('TABLE length(rows) as "Count"');
    lines.push('FROM "Sentinel"');
    lines.push('FLATTEN categories as category');
    lines.push('GROUP BY category');
    lines.push('SORT rows.length DESC');
    lines.push('```');
    lines.push('');
    lines.push('## Archived');
    lines.push('');
    lines.push('```dataview');
    lines.push('TABLE source_title as "Article", created_at as "Created"');
    lines.push('FROM "Sentinel"');
    lines.push('WHERE status = "ARCHIVED"');
    lines.push('SORT created_at DESC');
    lines.push('LIMIT 20');
    lines.push('```');
    lines.push('');
    fs.writeFileSync(dashPath, lines.join('\n'));
    console.log(`[SENTINEL] 📊 Dashboard updated`);
}
/**
 * Read operator comments from an existing Obsidian note.
 */
export function readOperatorComments(manifest) {
    const filePath = path.join(CONFIG.obsidianSentinelDir, `${manifest.filename}.md`);
    if (!fs.existsSync(filePath))
        return [];
    const content = fs.readFileSync(filePath, 'utf-8');
    const commentSection = content.split('## ✏️ Operator Notes');
    if (commentSection.length < 2)
        return [];
    const notes = commentSection[1]
        .trim()
        .split('\n')
        .filter(line => !line.startsWith('_') && line.trim().length > 0);
    return notes;
}
function escapeYaml(s) {
    return s.replace(/"/g, '\\"').replace(/\n/g, ' ');
}

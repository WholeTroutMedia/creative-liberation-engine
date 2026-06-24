/**
 * Flipboard Sentinel — Symphony Work-Stream Router
 * Automatically categorizes incoming ideation manifests into active strategic themes
 * and handles bi-directional linking inside docs/epics/ files and Obsidian vault.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG } from './config.js';
/**
 * Extract keywords from a text string, filtering out stop words.
 */
function extractKeywords(text) {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'shall', 'can', 'this', 'that',
        'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'our',
        'you', 'your', 'he', 'she', 'him', 'her', 'his', 'not', 'no', 'nor',
        'so', 'if', 'then', 'than', 'more', 'most', 'also', 'just', 'about',
        'new', 'how', 'what', 'when', 'where', 'who', 'why', 'all', 'each',
        'every', 'both', 'few', 'many', 'some', 'any', 'other', 'into', 'over',
        'such', 'after', 'before', 'between', 'through', 'during', 'above',
        'below', 'up', 'down', 'out', 'off', 'very', 'own', 'same', 'only',
        'using', 'used', 'use', 'make', 'like', 'get', 'got', 'way', 'said',
        'one', 'two', 'first', 'last', 'still', 'even', 'back', 'well',
    ]);
    const words = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stopWords.has(w));
    const wordSet = new Set();
    words.forEach(w => wordSet.add(w));
    return wordSet;
}
/**
 * Load themes from the canonical registry.
 */
function loadThemeRegistry() {
    const registryPath = path.join(CONFIG.nasRoot, 'registry', 'workstreams.canonical.json');
    try {
        if (fs.existsSync(registryPath)) {
            return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        }
    }
    catch (err) {
        console.error(`[SENTINEL] ❌ Failed to load workstreams registry: ${err.message}`);
    }
    return { themes: [] };
}
/**
 * Route a job manifest to its matching strategic themes based on keyword correlation.
 */
export function routeManifestToThemes(manifest) {
    const registry = loadThemeRegistry();
    if (registry.themes.length === 0) {
        return { primaryTheme: null, score: 0 };
    }
    // Combine manifest texts for robust classification
    const manifestText = [
        manifest.sourceArticle.title,
        manifest.sourceArticle.categories.join(' '),
        manifest.categories.join(' '),
        manifest.athenaOutput?.directive || '',
        manifest.athenaOutput?.rationale || '',
    ].join(' ');
    const manifestKeywords = extractKeywords(manifestText);
    let bestTheme = null;
    let maxScore = 0;
    for (const theme of registry.themes) {
        let matchCount = 0;
        const themeKeywords = new Set();
        theme.keywords.forEach(k => themeKeywords.add(k.toLowerCase()));
        manifestKeywords.forEach(kw => {
            if (themeKeywords.has(kw)) {
                matchCount++;
            }
        });
        // Calculate union size manually to avoid downlevelIteration spreads
        const union = new Set();
        manifestKeywords.forEach(k => union.add(k));
        themeKeywords.forEach(k => union.add(k));
        const unionSize = union.size;
        const score = unionSize === 0 ? 0 : matchCount / unionSize;
        // Apply a direct multiplier if manifest has explicit category overlap
        const hasDirectCategoryMatch = manifest.categories.some(c => themeKeywords.has(c.toLowerCase()) || theme.name.toLowerCase().includes(c.toLowerCase()));
        const finalScore = hasDirectCategoryMatch ? score * 1.5 : score;
        if (finalScore > maxScore) {
            maxScore = finalScore;
            bestTheme = theme;
        }
    }
    return { primaryTheme: bestTheme, score: Math.round(maxScore * 100) / 100 };
}
/**
 * Update the strategic theme document (docs/epics/Theme-X.md) with bi-directional link.
 * Automatically replaces existing "Untitled" links for the same Job ID if found.
 */
export function linkJobToThemeFile(manifest, theme) {
    // Resolve absolute path (e.g. from volume-mount path on production or local UNC)
    const baseDir = CONFIG.nasRoot.replace(/[\/\\]runtime$/, '');
    const themeFilePath = path.join(baseDir, theme.path.replace(/\//g, path.sep));
    if (!fs.existsSync(themeFilePath)) {
        console.warn(`[SENTINEL] ⚠️ Theme document not found at: ${themeFilePath}`);
        return;
    }
    let content = fs.readFileSync(themeFilePath, 'utf-8');
    // Construct dynamic beautiful entry
    // Format: * **IE-IDX-XXXX**: [Title](file:///y:/creative-liberation-engine/runtime/nexus-vault/Sentinel/IE-IDX-XXXX_slug.md) - Rationale summary.
    const cleanTitle = manifest.sourceArticle.title.replace(/[\[\]]/g, '');
    const obsidianLink = `file:///app/creative-liberation-engine/runtime/nexus-vault/Sentinel/${manifest.filename}.md`;
    const rationaleSummary = manifest.athenaOutput?.rationale
        ? manifest.athenaOutput.rationale.split(/[.!?]/)[0] + '.'
        : 'Strategic concept ideated.';
    const newEntry = `* **${manifest.jobId}**: [${cleanTitle}](${obsidianLink}) - ${rationaleSummary}`;
    // Regex to detect if this job ID is already linked
    const existingJobRegex = new RegExp(`\\*\\s+\\*\\*${manifest.jobId}\\*\\*:\\s*.*`, 'g');
    if (existingJobRegex.test(content)) {
        // Replace existing entry (cleans up any "Untitled" placeholders!)
        content = content.replace(existingJobRegex, newEntry);
        console.log(`[SENTINEL] 🔄 Updated existing entry for ${manifest.jobId} in ${theme.id}`);
    }
    else {
        // Append to the "## Consolidated Ideations" section
        const sectionHeader = '## Consolidated Ideations';
        if (content.includes(sectionHeader)) {
            content = content.replace(sectionHeader, `${sectionHeader}\n\n${newEntry}`);
            console.log(`[SENTINEL] 🔗 Appended link for ${manifest.jobId} to ${theme.id}`);
        }
        else {
            // Safe fallback: append to end of file
            content = `${content.trim()}\n\n## Consolidated Ideations\n\n${newEntry}\n`;
            console.log(`[SENTINEL] 🔗 Appended to end of ${theme.id} (no section header found)`);
        }
    }
    fs.writeFileSync(themeFilePath, content, 'utf-8');
}

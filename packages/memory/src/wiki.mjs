/**
 * Wiki Projector — bidirectional sync between canonical memory and Obsidian notes.
 *
 * Direction: memory → wiki (projection), wiki → memory (ingest)
 * Wiki notes are projections, not independent sources of truth.
 *
 * @capabilityId cap_wiki_projection
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { MemoryBus } from './bus.mjs';

/**
 * Generate YAML frontmatter from a memory record.
 */
function toFrontmatter(record) {
  const lines = ['---'];
  lines.push(`memoryId: "${record.memoryId}"`);
  lines.push(`title: "${record.title}"`);
  lines.push(`kind: ${record.kind}`);
  lines.push(`provider: ${record.provider}`);
  lines.push(`lifecycleState: ${record.lifecycleState}`);
  lines.push(`createdAt: ${record.createdAt}`);
  if (record.updatedAt) lines.push(`updatedAt: ${record.updatedAt}`);
  if (record.tags?.length) lines.push(`tags: [${record.tags.join(', ')}]`);
  lines.push('---');
  return lines.join('\n');
}

export class WikiProjector {
  constructor(memoryDir, wikiDir) {
    this.bus = new MemoryBus(memoryDir);
    this.wikiDir = wikiDir;
    if (!existsSync(wikiDir)) mkdirSync(wikiDir, { recursive: true });
  }

  /**
   * Project a memory record to a wiki note.
   * @param {object} record - Memory record
   * @param {string} [subdir] - Subdirectory within wiki (e.g., 'examples')
   * @returns {string} Path to created wiki note
   */
  project(record, subdir = '') {
    const dir = subdir ? join(this.wikiDir, subdir) : this.wikiDir;
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const frontmatter = toFrontmatter(record);
    const body = `\n# ${record.title}\n\n${record.summary || ''}\n`;
    const content = frontmatter + '\n' + body;

    const path = join(dir, `${record.memoryId}.md`);
    writeFileSync(path, content, 'utf-8');
    return path;
  }

  /**
   * Project all records from a collection to wiki notes.
   * @param {string} collection
   * @param {string} [subdir]
   * @returns {string[]} Paths to created notes
   */
  projectCollection(collection, subdir = '') {
    const data = this.bus.loadCollection(collection);
    return data.entries.map(record => this.project(record, subdir));
  }
}

/** Convenience: project a single record */
export function projectToWiki(memoryDir, wikiDir, record, subdir) {
  return new WikiProjector(memoryDir, wikiDir).project(record, subdir);
}

/** Convenience: sync from wiki (stub — ingest path) */
export function syncFromWiki(memoryDir, wikiDir) {
  // Future: parse frontmatter from wiki notes and update memory records
  console.warn('[wiki] syncFromWiki not yet implemented — wiki notes are projections only');
}

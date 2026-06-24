/**
 * Open Knowledge Format (OKF) Parser
 *
 * Implements Google Cloud OKF specification:
 * Vendor-neutral Markdown context format with YAML-like frontmatter
 * and structured ## headings.
 */

/**
 * Parses OKF markdown string into structured metadata and sections.
 * @param {string} content
 * @returns {{metadata: Record<string, string>, sections: Array<{title: string, content: string}>}}
 */
export function parseOKF(content) {
    if (!content) {
        return { metadata: {}, sections: [] };
    }

    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
    const match = content.match(frontmatterRegex);
    let metadata = {};
    let markdownBody = content;

    if (match) {
        const frontmatterText = match[1];
        markdownBody = content.slice(match[0].length);
        
        // Parse simple YAML key-value lines
        frontmatterText.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const colonIndex = trimmed.indexOf(':');
            if (colonIndex > 0) {
                const key = trimmed.slice(0, colonIndex).trim();
                let value = trimmed.slice(colonIndex + 1).trim();
                // Strip surrounding quotes
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                metadata[key] = value;
            }
        });
    }

    const sections = [];
    // Matches ## Section Title and everything up to the next ## Section Title or end of string
    const sectionRegex = /(?:^|\n)##\s+(.+?)\r?\n([\s\S]*?)(?=\n##\s+|$)/g;
    let secMatch;
    let hasSections = false;

    while ((secMatch = sectionRegex.exec(markdownBody)) !== null) {
        hasSections = true;
        sections.push({
            title: secMatch[1].trim(),
            content: secMatch[2].trim()
        });
    }

    if (!hasSections && markdownBody.trim()) {
        sections.push({
            title: 'Content',
            content: markdownBody.trim()
        });
    }

    return { metadata, sections };
}

/**
 * Serializes metadata and sections into an OKF markdown string.
 * @param {Record<string, string>} metadata
 * @param {Array<{title: string, content: string}>} sections
 * @returns {string}
 */
export function stringifyOKF(metadata, sections) {
    let output = '---\n';
    for (const [key, value] of Object.entries(metadata || {})) {
        output += `${key}: "${value}"\n`;
    }
    output += '---\n\n';

    for (const sec of sections || []) {
        output += `## ${sec.title}\n\n${sec.content}\n\n`;
    }

    return output.trim() + '\n';
}

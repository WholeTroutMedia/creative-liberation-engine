import fs from 'node:fs';
import path from 'node:path';

export interface SkillData {
  skillId: string;
  name: string;
  summary: string;
  agentCallable?: boolean;
  aliases?: string[];
  markdownContent: string;
  constitutionalArticles?: string[];
  leadAgents?: string[];
}

// Helper to find the workspace root by searching upwards from process.cwd()
function getWorkspaceRoot(): string {
  let current = process.cwd();
  while (current && current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, 'AGENTS.md'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}

export async function serializeSkill(skillData: SkillData): Promise<void> {
  const root = getWorkspaceRoot();
  const skillId = skillData.skillId;
  const name = skillData.name;
  const summary = skillData.summary;
  const agentCallable = skillData.agentCallable ?? true;
  const aliases = skillData.aliases ?? [skillId];
  const markdownContent = skillData.markdownContent;
  const constitutionalArticles = skillData.constitutionalArticles ?? [];
  const leadAgents = skillData.leadAgents ?? [];

  const now = new Date().toISOString();

  // 1. Write to workspace repo: agents/skills-next/[skillId]/SKILL.md
  const repoSkillDir = path.join(root, 'agents', 'skills-next', skillId);
  const repoSkillPath = path.join(repoSkillDir, 'SKILL.md');
  
  if (!fs.existsSync(repoSkillDir)) {
    fs.mkdirSync(repoSkillDir, { recursive: true });
  }

  // Format SKILL.md with frontmatter
  const repoSkillContent = `---
name: "${name}"
description: "${summary}"
agentCallable: ${agentCallable}
---

${markdownContent}
`;

  fs.writeFileSync(repoSkillPath, repoSkillContent, 'utf8');
  console.log(`[SKILL-SERIALIZER] Wrote repo skill to: ${repoSkillPath}`);

  // 2. Write to Obsidian Sentinel Vault: runtime/nexus-vault/Sentinel/[skillId].md
  const obsidianDir = path.join(root, 'runtime', 'nexus-vault', 'Sentinel');
  const obsidianSkillPath = path.join(obsidianDir, `${skillId}.md`);

  if (!fs.existsSync(obsidianDir)) {
    fs.mkdirSync(obsidianDir, { recursive: true });
  }

  // Obsidian frontmatter should contain tags, skillId, name, aliases, etc.
  const obsidianFrontmatter = `---
skillId: "${skillId}"
name: "${name}"
summary: "${summary}"
agentCallable: ${agentCallable}
aliases: ${JSON.stringify(aliases)}
tags: [sentinel, skill${constitutionalArticles.map(a => `, ${a.toLowerCase().replace(/\s+/g, '-')}`).join('')}]
created_at: "${now}"
lead_agents: ${JSON.stringify(leadAgents)}
---

# ${name}

${markdownContent}
`;

  fs.writeFileSync(obsidianSkillPath, obsidianFrontmatter, 'utf8');
  console.log(`[SKILL-SERIALIZER] Wrote Obsidian skill to: ${obsidianSkillPath}`);

  // 3. Update the canonical registry file: runtime/registry/skills.canonical.json
  const registryPath = path.join(root, 'runtime', 'registry', 'skills.canonical.json');
  if (fs.existsSync(registryPath)) {
    try {
      const registryData = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      
      // Check if skill already exists in registry, if so, update it. Otherwise append.
      const existingIndex = registryData.skills.findIndex((s: any) => s.skillId === skillId);
      
      const skillEntry = {
        skillId,
        name,
        kind: "next_skill",
        status: "active",
        source: "v6-next",
        path: `agents/skills-next/${skillId}/SKILL.md`,
        summary,
        agentCallable,
        aliases
      };

      if (existingIndex !== -1) {
        registryData.skills[existingIndex] = skillEntry;
        console.log(`[SKILL-SERIALIZER] Updated existing registry entry for: ${skillId}`);
      } else {
        registryData.skills.push(skillEntry);
        console.log(`[SKILL-SERIALIZER] Appended new registry entry for: ${skillId}`);
        
        // Update counts
        if (registryData.counts) {
          registryData.counts.total = (registryData.counts.total || 0) + 1;
          registryData.counts.next_skill = (registryData.counts.next_skill || 0) + 1;
        }
      }

      registryData.generatedAt = now;

      fs.writeFileSync(registryPath, JSON.stringify(registryData, null, 2), 'utf8');
      console.log(`[SKILL-SERIALIZER] Successfully updated skills canonical registry.`);
    } catch (err: any) {
      console.error(`[SKILL-SERIALIZER] Failed to update skills canonical registry:`, err.message);
    }
  } else {
    console.warn(`[SKILL-SERIALIZER] Canonical registry not found at: ${registryPath}`);
  }
}

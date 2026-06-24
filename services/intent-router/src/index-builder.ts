import fs from 'fs';
import path from 'path';

export interface SkillTriggerMatch {
  skillId: string;
  weight: number;
}

export interface TemplateTriggerMatch {
  templateId: string;
}

export interface WorkflowTriggerMatch {
  workflowId: string;
}

export class InvertedIndex {
  skillsRegistryPath: string;
  templatesRegistryPath: string;
  workflowsRegistryPath: string;

  // trigger phrase -> array of matching skills with weight
  skillTriggers: Map<string, SkillTriggerMatch[]> = new Map();
  // template trigger -> template info
  templateTriggers: Map<string, TemplateTriggerMatch> = new Map();
  // workflow trigger -> workflow info
  workflowTriggers: Map<string, WorkflowTriggerMatch> = new Map();

  skillsRaw: any[] = [];
  templatesRaw: any[] = [];
  workflowsRaw: any[] = [];

  constructor(baseRegistryDir: string = '../../runtime/registry') {
    this.skillsRegistryPath = path.resolve(baseRegistryDir, 'skills.canonical.json');
    this.templatesRegistryPath = path.resolve(baseRegistryDir, 'strategic-report-templates.registry.json');
    this.workflowsRegistryPath = path.resolve(baseRegistryDir, 'workflows.canonical.json');
  }

  build() {
    console.log('[IndexBuilder] Rebuilding inverted indexes...');
    this.skillTriggers.clear();
    this.templateTriggers.clear();
    this.workflowTriggers.clear();

    try {
      // 1. Load Skills
      if (fs.existsSync(this.skillsRegistryPath)) {
        const skillsData = JSON.parse(fs.readFileSync(this.skillsRegistryPath, 'utf8'));
        this.skillsRaw = skillsData.skills || [];
        this.skillsRaw.forEach((skill: any) => {
          if (skill.status !== 'active') return;

          // Add aliases (weight 100)
          if (skill.aliases) {
            skill.aliases.forEach((alias: string) => {
              const cleaned = alias.toLowerCase().trim();
              this.addSkillTrigger(cleaned, skill.skillId, 100);
            });
          }

          // Add exact skillId/name (weight 100)
          this.addSkillTrigger(skill.skillId.toLowerCase().trim(), skill.skillId, 100);
          this.addSkillTrigger(skill.name.toLowerCase().trim(), skill.skillId, 100);

          // Add triggers (weight 80)
          if (skill.triggers) {
            skill.triggers.forEach((trigger: string) => {
              const cleaned = trigger.toLowerCase().trim();
              this.addSkillTrigger(cleaned, skill.skillId, 80);
            });
          }
        });
        console.log(`[IndexBuilder] Indexed ${this.skillsRaw.length} active skills.`);
      } else {
        console.error(`[IndexBuilder] Skills registry not found at: ${this.skillsRegistryPath}`);
      }

      // 2. Load Report Templates
      if (fs.existsSync(this.templatesRegistryPath)) {
        const templatesData = JSON.parse(fs.readFileSync(this.templatesRegistryPath, 'utf8'));
        this.templatesRaw = templatesData.templates || [];
        this.templatesRaw.forEach((tmpl: any) => {
          // Add exact ID
          this.templateTriggers.set(tmpl.id.toLowerCase().trim(), { templateId: tmpl.id });
          
          // Add triggers
          if (tmpl.triggers) {
            tmpl.triggers.forEach((trigger: string) => {
              const cleaned = trigger.toLowerCase().trim();
              this.templateTriggers.set(cleaned, { templateId: tmpl.id });
            });
          }
        });
        console.log(`[IndexBuilder] Indexed ${this.templatesRaw.length} report templates.`);
      } else {
        console.error(`[IndexBuilder] Templates registry not found at: ${this.templatesRegistryPath}`);
      }

      // 3. Load Workflows
      if (fs.existsSync(this.workflowsRegistryPath)) {
        const workflowsData = JSON.parse(fs.readFileSync(this.workflowsRegistryPath, 'utf8'));
        this.workflowsRaw = workflowsData.workflows || [];
        this.workflowsRaw.forEach((wf: any) => {
          if (wf.status !== 'active') return;

          // Add exact ID
          this.workflowTriggers.set(wf.workflowId.toLowerCase().trim(), { workflowId: wf.workflowId });

          // Add triggers
          if (wf.triggers) {
            wf.triggers.forEach((trigger: string) => {
              const cleaned = trigger.toLowerCase().trim();
              this.workflowTriggers.set(cleaned, { workflowId: wf.workflowId });
            });
          }
        });
        console.log(`[IndexBuilder] Indexed ${this.workflowsRaw.length} active workflows.`);
      } else {
        console.error(`[IndexBuilder] Workflows registry not found at: ${this.workflowsRegistryPath}`);
      }

    } catch (err) {
      console.error('[IndexBuilder] Error during index compilation:', err);
    }
  }

  private addSkillTrigger(trigger: string, skillId: string, weight: number) {
    let list = this.skillTriggers.get(trigger);
    if (!list) {
      list = [];
      this.skillTriggers.set(trigger, list);
    }
    if (!list.some(m => m.skillId === skillId)) {
      list.push({ skillId, weight });
    }
  }

  getTotalEntries(): number {
    return this.skillTriggers.size + this.templateTriggers.size + this.workflowTriggers.size;
  }
}

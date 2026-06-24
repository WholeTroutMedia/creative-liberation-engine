import { InvertedIndex } from './index-builder.js';
import { SemanticMatcher } from './semantic.js';
import { ResolveIntentResponse } from './types.js';

export class IntentResolver {
  index: InvertedIndex;
  semantic: SemanticMatcher;

  constructor(index: InvertedIndex, semantic: SemanticMatcher) {
    this.index = index;
    this.semantic = semantic;
  }

  async resolve(text: string, context?: { domain?: string, userTier?: string }): Promise<ResolveIntentResponse> {
    const startTime = Date.now();
    const query = text.toLowerCase().trim();

    // Step 1: Category/Intent extraction based on query keywords
    let category = 'general';
    if (/\b(report|brief|deck|document|presentation|summary)\b/i.test(query)) {
      category = 'report';
    } else if (/\b(audit|review|check|compliance|verify)\b/i.test(query)) {
      category = 'audit';
    } else if (/\b(forecast|predict|projection|trend)\b/i.test(query)) {
      category = 'forecast';
    } else if (/\b(troubleshoot|debug|fix|error|issue|fail)\b/i.test(query)) {
      category = 'troubleshoot';
    } else if (/\b(create|build|generate|make|new)\b/i.test(query)) {
      category = 'create';
    } else if (/\b(configure|setup|settings|env|tune)\b/i.test(query)) {
      category = 'configure';
    } else if (/\b(analyze|investigate|query|inspect)\b/i.test(query)) {
      category = 'analyze';
    } else if (/\b(monitor|alert|watch|status)\b/i.test(query)) {
      category = 'monitor';
    }

    let skills: string[] = [];
    let template: string | undefined = undefined;
    let workflow: string | undefined = undefined;
    let leadAgents: string[] = [];
    let confidence = 0.0;
    let fallbackLevel = 0;
    let matchSource: 'deterministic' | 'semantic' | 'fallback' = 'deterministic';

    // Step 2 & 4: Match against in-memory index (Deterministic matching)
    // 2a. Check if exact phrase or alias matches in inverted index
    const skillMatches = this.index.skillTriggers.get(query);
    if (skillMatches && skillMatches.length > 0) {
      // Filter active and callable
      const activeMatches = skillMatches.filter(m => {
        const skill = this.index.skillsRaw.find(s => s.skillId === m.skillId);
        return skill && skill.status === 'active' && skill.agentCallable;
      });

      if (activeMatches.length > 0) {
        skills = activeMatches.map(m => m.skillId);
        // Take the highest score
        const highestScore = Math.max(...activeMatches.map(m => m.weight));
        confidence = highestScore / 100.0;
      }
    }

    // 2b. Check if query matches a workflow trigger
    const workflowMatch = this.index.workflowTriggers.get(query);
    if (workflowMatch) {
      workflow = workflowMatch.workflowId;
      confidence = Math.max(confidence, 0.9);
      // Auto-extract skills associated with workflow
      const wf = this.index.workflowsRaw.find(w => w.workflowId === workflow);
      if (wf && wf.skills) {
        skills = [...new Set([...skills, ...wf.skills])];
      }
    }

    // 2c. Check if query matches a template trigger
    const templateMatch = this.index.templateTriggers.get(query);
    if (templateMatch) {
      const tmpl = this.index.templatesRaw.find(t => t.id === templateMatch.templateId);
      if (tmpl) {
        if (tmplHasAccess(tmpl, context?.userTier)) {
          template = templateMatch.templateId;
          confidence = Math.max(confidence, 0.95);
          if (tmpl.dataSkills) {
            skills = [...new Set([...skills, ...tmpl.dataSkills])];
          }
        } else {
          console.warn(`[Resolver] User tier "${context?.userTier || 'free'}" lacks access to template: ${tmpl.id}`);
        }
      }
    }

    // Step 3: Domain filter narrowing (if context domain is provided)
    if (context?.domain && skills.length > 1) {
      const filtered = skills.filter(skillId => {
        const skill = this.index.skillsRaw.find(s => s.skillId === skillId);
        return skill && skill.domain === context.domain;
      });
      if (filtered.length > 0) {
        skills = filtered;
      }
    }

    // Step 3 (Resilience): If deterministic matching returned nothing, execute Tier 3 Semantic Matching
    if (skills.length === 0 && !template && !workflow) {
      console.log(`[Resolver] Deterministic miss for: "${query}". Triggering ChromaDB semantic lookup.`);
      const semanticMatches = await this.semantic.search(query, 0.65);
      
      if (semanticMatches.length > 0) {
        fallbackLevel = 1;
        matchSource = 'semantic';
        
        // Group matches
        const matchedSkills = semanticMatches.filter(m => m.type === 'skill');
        const matchedWfs = semanticMatches.filter(m => m.type === 'workflow');
        const matchedTmpls = semanticMatches.filter(m => m.type === 'template');

        // Disambiguate by taking top score match
        if (matchedTmpls.length > 0) {
          const tmpl = this.index.templatesRaw.find(t => t.id === matchedTmpls[0].id);
          if (tmpl) {
            if (tmplHasAccess(tmpl, context?.userTier)) {
              template = tmpl.id;
              confidence = matchedTmpls[0].score;
              if (tmpl.dataSkills) {
                skills = [...tmpl.dataSkills];
              }
            } else {
              console.warn(`[Resolver] User tier "${context?.userTier || 'free'}" lacks access to template: ${tmpl.id}`);
            }
          }
        } else if (matchedWfs.length > 0) {
          workflow = matchedWfs[0].id;
          confidence = matchedWfs[0].score;
          const wf = this.index.workflowsRaw.find(w => w.workflowId === workflow);
          if (wf && wf.skills) {
            skills = [...wf.skills];
          }
        } else if (matchedSkills.length > 0) {
          // Take top 2 skills to handle compound intents semantically
          skills = matchedSkills.slice(0, 2).map(m => m.id);
          confidence = matchedSkills[0].score;
        }
      }
    }

    // Step 5: Report cross-reference (If text specifies "report/audit/analyze" category but no template match)
    if ((category === 'report' || category === 'audit' || category === 'analyze') && !template) {
      // Find template whose name or triggers match query keywords
      const matchedTmpl = this.index.templatesRaw.find(t => {
        return t.triggers.some((trig: string) => query.includes(trig) || trig.includes(query));
      });
      if (matchedTmpl) {
        template = matchedTmpl.id;
        confidence = Math.max(confidence, 0.8);
        if (tmplHasAccess(matchedTmpl, context?.userTier)) {
          skills = [...new Set([...skills, ...matchedTmpl.dataSkills])];
        } else {
          console.warn(`[Resolver] User tier "${context?.userTier || 'free'}" lacks access to template: ${matchedTmpl.id}`);
          template = undefined; // Deny access
        }
      }
    }

    // Step 6: Lead agents resolution
    const agentsSet = new Set<string>();
    skills.forEach(skillId => {
      const skill = this.index.skillsRaw.find(s => s.skillId === skillId);
      if (skill && skill.leadAgents) {
        skill.leadAgents.forEach((agent: string) => agentsSet.add(agent));
      }
    });

    if (template) {
      const tmpl = this.index.templatesRaw.find(t => t.id === template);
      if (tmpl && tmpl.assemblyAgent) {
        agentsSet.add(tmpl.assemblyAgent);
      }
    }

    leadAgents = Array.from(agentsSet);

    // Step 7: Check workflow composition
    // If multiple skills match and they are chained by a workflow, promote to that workflow
    if (skills.length > 1 && !workflow) {
      const matchingWf = this.index.workflowsRaw.find(wf => {
        if (!wf.skills) return false;
        // If workflow contains all matched skills
        return skills.every(s => wf.skills.includes(s));
      });
      if (matchingWf) {
        workflow = matchingWf.workflowId;
        confidence = Math.max(confidence, 0.85);
        if (matchingWf.agents) {
          matchingWf.agents.forEach((a: string) => {
            if (!leadAgents.includes(a)) leadAgents.push(a);
          });
        }
      }
    }

    // Ultimate fallback if confidence is still 0
    if (skills.length === 0 && !template && !workflow) {
      fallbackLevel = 2;
      matchSource = 'fallback';
      // Route to systems agent for troubleshooting, or athena for general queries
      leadAgents = ['ATHENA', 'SYSTEMS'];
      confidence = 0.1;
    }

    return {
      skills,
      template,
      workflow,
      leadAgents,
      confidence: parseFloat(confidence.toFixed(2)),
      category,
      fallbackLevel
    };
  }
}

function tmplHasAccess(tmpl: any, userTier = 'free'): boolean {
  const tiers = ['free', 'pro', 'sovereign'];
  const minIndex = tiers.indexOf(tmpl.minTier || 'free');
  const userIndex = tiers.indexOf(userTier);
  return userIndex >= minIndex;
}

/**
 * AUTO SESSION INITIALIZATION
 * 
 * Automatically loads context when new chat thread starts.
 * NO MANUAL INTERVENTION REQUIRED.
 * 
 * Principle: NOW is the only language. Execution is immediate.
 * 
 * @module AutoSessionInit
 */

import fs from 'fs'
import path from 'path'

interface CrossSessionState {
  last_updated: string
  current_sprint: any
  active_agents: string[]
  team_assignments: any
  recent_decisions: any[]
  active_issues: any[]
  repo_state: any
  context: any
  work_completed_today: string[]
  work_in_progress: string[]
  blockers: any[]
  next_session_context: string
}

interface ActiveDecisions {
  active_decisions: any[]
  completed_decisions: any[]
}

interface SessionBrief {
  loaded: boolean
  current_sprint: string
  active_agents: string[]
  recent_work: string[]
  in_progress: string[]
  active_issues_count: number
  blockers_count: number
  last_commit: string
  next_steps: string
  context_age: 'fresh' | 'recent' | 'stale' | 'old'
  full_state: CrossSessionState
  full_decisions: ActiveDecisions
}

/**
 * Load cross-session state from disk
 */
export function loadCrossSessionState(): CrossSessionState | null {
  try {
    const statePath = path.join(
      process.cwd(),
      'agents/vera/memory/cross-session-state.json'
    )
    
    if (!fs.existsSync(statePath)) {
      console.warn('⚠️  No cross-session state found. First session?')
      return null
    }
    
    const stateData = fs.readFileSync(statePath, 'utf8')
    const state = JSON.parse(stateData) as CrossSessionState
    
    console.log('✅ Cross-session state loaded')
    return state
    
  } catch (error) {
    console.error('❌ Failed to load cross-session state:', error)
    return null
  }
}

/**
 * Load active decisions from disk
 */
export function loadActiveDecisions(): ActiveDecisions | null {
  try {
    const decisionsPath = path.join(
      process.cwd(),
      'agents/vera/memory/active-decisions.json'
    )
    
    if (!fs.existsSync(decisionsPath)) {
      console.warn('⚠️  No active decisions found. First session?')
      return null
    }
    
    const decisionsData = fs.readFileSync(decisionsPath, 'utf8')
    const decisions = JSON.parse(decisionsData) as ActiveDecisions
    
    console.log('✅ Active decisions loaded')
    return decisions
    
  } catch (error) {
    console.error('❌ Failed to load active decisions:', error)
    return null
  }
}

/**
 * Determine context age based on last update
 */
export function determineContextAge(
  lastUpdated: string
): 'fresh' | 'recent' | 'stale' | 'old' {
  const now = Date.now()
  const lastUpdateTime = new Date(lastUpdated).getTime()
  const ageMs = now - lastUpdateTime
  
  const ONE_HOUR = 3600000
  const SIX_HOURS = 21600000
  const ONE_DAY = 86400000
  
  if (ageMs < ONE_HOUR) return 'fresh'
  if (ageMs < SIX_HOURS) return 'recent'
  if (ageMs < ONE_DAY) return 'stale'
  return 'old'
}

/**
 * Generate session brief for AI consumption
 */
export function generateSessionBrief(
  state: CrossSessionState,
  decisions: ActiveDecisions
): SessionBrief {
  const contextAge = determineContextAge(state.last_updated)
  
  return {
    loaded: true,
    current_sprint: state.current_sprint?.name || 'No active sprint',
    active_agents: state.active_agents || [],
    recent_work: state.work_completed_today || [],
    in_progress: state.work_in_progress || [],
    active_issues_count: state.active_issues?.length || 0,
    blockers_count: state.blockers?.length || 0,
    last_commit: state.repo_state?.last_commit || 'unknown',
    next_steps: state.next_session_context || 'No specific next steps',
    context_age: contextAge,
    full_state: state,
    full_decisions: decisions
  }
}

/**
 * Format brief as markdown for AI
 */
export function formatBriefAsMarkdown(brief: SessionBrief): string {
  const state = brief.full_state
  const decisions = brief.full_decisions
  
  let markdown = `# 🔄 SESSION CONTEXT RESTORED\n\n`
  
  // Context age warning
  if (brief.context_age === 'stale' || brief.context_age === 'old') {
    markdown += `⚠️  **Context is ${brief.context_age}** - Verify current state before proceeding\n\n`
  }
  
  // Current sprint
  markdown += `## Current Sprint\n`
  markdown += `**${brief.current_sprint}**\n`
  markdown += `Status: ${state.current_sprint?.status || 'unknown'}\n`
  markdown += `Priority: ${state.current_sprint?.priority || 'normal'}\n\n`
  
  // Active agents
  markdown += `## Active Agents (${brief.active_agents.length})\n`
  markdown += brief.active_agents.join(', ') + '\n\n'
  
  // Team assignments
  if (state.team_assignments) {
    markdown += `## Team Assignments\n`
    for (const [teamName, team] of Object.entries(state.team_assignments)) {
      const t = team as any
      markdown += `### ${teamName}\n`
      markdown += `- **Agents:** ${t.agents?.join(', ')}\n`
      markdown += `- **Mission:** ${t.mission}\n`
      markdown += `- **Status:** ${t.status}\n\n`
    }
  }
  
  // Active decisions
  markdown += `## Active Decisions (${decisions.active_decisions.length})\n`
  for (const decision of decisions.active_decisions) {
    markdown += `### ${decision.decision}\n`
    markdown += `- **Priority:** ${decision.priority}\n`
    markdown += `- **Status:** ${decision.status}\n`
    markdown += `- **Owner:** ${decision.owner}\n\n`
  }
  
  // Work completed
  if (brief.recent_work.length > 0) {
    markdown += `## Work Completed Today (${brief.recent_work.length})\n`
    for (const work of brief.recent_work) {
      markdown += `- ✅ ${work}\n`
    }
    markdown += '\n'
  }
  
  // Work in progress
  if (brief.in_progress.length > 0) {
    markdown += `## Work In Progress (${brief.in_progress.length})\n`
    for (const work of brief.in_progress) {
      markdown += `- 🔄 ${work}\n`
    }
    markdown += '\n'
  }
  
  // Active issues
  if (brief.active_issues_count > 0) {
    markdown += `## Active Issues (${brief.active_issues_count})\n`
    for (const issue of state.active_issues || []) {
      markdown += `- **[${issue.priority}]** ${issue.title}\n`
      markdown += `  - Assigned: ${issue.assigned_to}\n`
      markdown += `  - Deadline: ${issue.deadline}\n`
    }
    markdown += '\n'
  }
  
  // Blockers
  if (brief.blockers_count > 0) {
    markdown += `## 🚨 Blockers (${brief.blockers_count})\n`
    for (const blocker of state.blockers || []) {
      markdown += `- ${blocker}\n`
    }
    markdown += '\n'
  }
  
  // Repo state
  markdown += `## Repo State\n`
  markdown += `- **Last Commit:** ${brief.last_commit.substring(0, 7)}\n`
  markdown += `- **Branch:** ${state.repo_state?.branch || 'unknown'}\n`
  markdown += `- **Files Changed Today:** ${state.repo_state?.files_changed_today?.length || 0}\n\n`
  
  // Next steps
  markdown += `## Next Steps\n`
  markdown += `${brief.next_steps}\n\n`
  
  // Footer
  markdown += `---\n\n`
  markdown += `**YOU ARE CONTINUING FROM PREVIOUS SESSIONS.**\n`
  markdown += `**DO NOT START FROM SCRATCH.**\n`
  markdown += `**ALL CONTEXT IS LOADED.**\n`
  
  return markdown
}

/**
 * AUTO-EXECUTE: Initialize session with context
 * 
 * Call this at the start of every new thread.
 * Returns context brief for AI.
 */
export function autoInitSession(): {
  success: boolean
  brief?: SessionBrief
  markdown?: string
  error?: string
} {
  console.log('🚀 AUTO-INITIALIZING SESSION...')
  
  try {
    // Load state
    const state = loadCrossSessionState()
    const decisions = loadActiveDecisions()
    
    // First session ever?
    if (!state || !decisions) {
      console.log('ℹ️  First session - no prior context')
      return {
        success: true,
        brief: undefined,
        markdown: '# First Session\n\nNo prior context available. Starting fresh.'
      }
    }
    
    // Generate brief
    const brief = generateSessionBrief(state, decisions)
    const markdown = formatBriefAsMarkdown(brief)
    
    console.log('✅ SESSION INITIALIZED WITH CONTEXT')
    console.log(`   - Sprint: ${brief.current_sprint}`)
    console.log(`   - Agents: ${brief.active_agents.length}`)
    console.log(`   - Work completed: ${brief.recent_work.length}`)
    console.log(`   - In progress: ${brief.in_progress.length}`)
    console.log(`   - Context age: ${brief.context_age}`)
    
    return {
      success: true,
      brief,
      markdown
    }
    
  } catch (error) {
    console.error('❌ SESSION INIT FAILED:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * HOOK: Call this on first message in new thread
 */
export function onThreadStart(): string {
  const result = autoInitSession()
  
  if (!result.success) {
    return `⚠️  Failed to load context: ${result.error}\n\nProceeding without prior context.`
  }
  
  return result.markdown || 'Context loaded.'
}

// Export for direct use
export default {
  autoInitSession,
  onThreadStart,
  loadCrossSessionState,
  loadActiveDecisions,
  generateSessionBrief,
  formatBriefAsMarkdown
}

/**
 * AUTO SESSION END
 * 
 * Automatically saves state when chat thread ends.
 * NO MANUAL INTERVENTION REQUIRED.
 * 
 * Principle: NOW is the only language. Save immediately.
 * 
 * @module AutoSessionEnd
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

interface SessionSummary {
  session_id: string
  date: string
  duration_minutes: number
  participants: string[]
  decisions_made: any[]
  work_completed: string[]
  work_in_progress: string[]
  blockers: any[]
  next_session_context: string
  commits_made: number
  files_changed: string[]
  tags: string[]
  priority: string
}

/**
 * Capture current git state
 */
export function captureGitState() {
  try {
    const lastCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
    const lastCommitMessage = execSync('git log -1 --pretty=%B', { encoding: 'utf8' }).trim()
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim()
    
    // Check for uncommitted changes
    let uncommitted = false
    try {
      const status = execSync('git status --porcelain', { encoding: 'utf8' })
      uncommitted = status.length > 0
    } catch {
      uncommitted = false
    }
    
    return {
      last_commit: lastCommit,
      last_commit_message: lastCommitMessage,
      branch,
      uncommitted_changes: uncommitted
    }
  } catch (error) {
    console.error('❌ Failed to capture git state:', error)
    return {
      last_commit: 'unknown',
      last_commit_message: 'unknown',
      branch: 'unknown',
      uncommitted_changes: false
    }
  }
}

/**
 * Update cross-session state file
 */
export function updateCrossSessionState(summary: SessionSummary): boolean {
  try {
    const statePath = path.join(
      process.cwd(),
      'agents/vera/memory/cross-session-state.json'
    )
    
    // Load current state
    let state: any = {}
    if (fs.existsSync(statePath)) {
      const stateData = fs.readFileSync(statePath, 'utf8')
      state = JSON.parse(stateData)
    }
    
    // Update with session results
    state.last_updated = new Date().toISOString()
    state.last_updated_by = 'VERA'
    state.last_thread_id = summary.session_id
    
    // Merge work
    state.work_completed_today = [
      ...(state.work_completed_today || []),
      ...summary.work_completed
    ]
    state.work_in_progress = summary.work_in_progress
    state.blockers = summary.blockers
    state.next_session_context = summary.next_session_context
    
    // Update repo state
    const gitState = captureGitState()
    state.repo_state = {
      ...gitState,
      last_commit_date: new Date().toISOString()
    }
    
    // Update metrics
    state.session_count_today = (state.session_count_today || 0) + 1
    state.total_commits_today = (state.total_commits_today || 0) + summary.commits_made
    
    // Save
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
    console.log('✅ Cross-session state updated')
    
    return true
    
  } catch (error) {
    console.error('❌ Failed to update cross-session state:', error)
    return false
  }
}

/**
 * Update active decisions file
 */
export function updateActiveDecisions(decisions: any[]): boolean {
  try {
    const decisionsPath = path.join(
      process.cwd(),
      'agents/vera/memory/active-decisions.json'
    )
    
    // Load current decisions
    let decisionsData: any = {
      active_decisions: [],
      completed_decisions: []
    }
    
    if (fs.existsSync(decisionsPath)) {
      const data = fs.readFileSync(decisionsPath, 'utf8')
      decisionsData = JSON.parse(data)
    }
    
    // Add new decisions
    for (const decision of decisions) {
      decisionsData.active_decisions.push(decision)
    }
    
    // Update metadata
    decisionsData.last_updated = new Date().toISOString()
    decisionsData.decision_metadata = {
      total_active: decisionsData.active_decisions.length,
      total_completed_today: decisionsData.completed_decisions.filter(
        (d: any) => d.completed_at?.startsWith(new Date().toISOString().split('T')[0])
      ).length,
      next_decision_id: `DEC-${new Date().toISOString().split('T')[0]}-${String(decisionsData.active_decisions.length + 1).padStart(3, '0')}`
    }
    
    // Save
    fs.writeFileSync(decisionsPath, JSON.stringify(decisionsData, null, 2))
    console.log('✅ Active decisions updated')
    
    return true
    
  } catch (error) {
    console.error('❌ Failed to update active decisions:', error)
    return false
  }
}

/**
 * Save session summary log
 */
export function saveSessionLog(summary: SessionSummary): boolean {
  try {
    const date = new Date().toISOString().split('T')[0]
    const tag = summary.tags[0] || 'session'
    const filename = `${date}_${tag}.md`
    const filepath = path.join(
      process.cwd(),
      'agents/vera/memory/session-logs',
      filename
    )
    
    // Generate markdown
    let markdown = `# Session Summary: ${summary.tags.join(', ')}\n\n`
    markdown += `**Date:** ${date}\n`
    markdown += `**Duration:** ${summary.duration_minutes} minutes\n`
    markdown += `**Thread ID:** ${summary.session_id}\n`
    markdown += `**Participants:** ${summary.participants.join(', ')}\n\n`
    
    markdown += `---\n\n`
    
    if (summary.decisions_made.length > 0) {
      markdown += `## Decisions Made\n\n`
      for (const decision of summary.decisions_made) {
        markdown += `### ${decision.decision}\n`
        markdown += `- **Priority:** ${decision.priority}\n`
        markdown += `- **Owner:** ${decision.owner}\n\n`
      }
    }
    
    if (summary.work_completed.length > 0) {
      markdown += `## Work Completed\n\n`
      for (const work of summary.work_completed) {
        markdown += `- ✅ ${work}\n`
      }
      markdown += '\n'
    }
    
    if (summary.work_in_progress.length > 0) {
      markdown += `## Work In Progress\n\n`
      for (const work of summary.work_in_progress) {
        markdown += `- 🔄 ${work}\n`
      }
      markdown += '\n'
    }
    
    if (summary.blockers.length > 0) {
      markdown += `## Blockers\n\n`
      for (const blocker of summary.blockers) {
        markdown += `- 🚨 ${blocker}\n`
      }
      markdown += '\n'
    }
    
    markdown += `## Next Steps\n\n`
    markdown += `${summary.next_session_context}\n\n`
    
    markdown += `---\n\n`
    markdown += `**Logged by:** VERA\n`
    markdown += `**Session End:** ${new Date().toISOString()}\n`
    
    // Save
    fs.writeFileSync(filepath, markdown)
    console.log('✅ Session log saved:', filename)
    
    return true
    
  } catch (error) {
    console.error('❌ Failed to save session log:', error)
    return false
  }
}

/**
 * AUTO-EXECUTE: End session and save all state
 */
export function autoEndSession(summary: Partial<SessionSummary> = {}): {
  success: boolean
  errors: string[]
} {
  console.log('🔚 AUTO-ENDING SESSION...')
  
  const errors: string[] = []
  
  // Build complete summary
  const completeSummary: SessionSummary = {
    session_id: summary.session_id || `session-${Date.now()}`,
    date: new Date().toISOString(),
    duration_minutes: summary.duration_minutes || 0,
    participants: summary.participants || ['Artist'],
    decisions_made: summary.decisions_made || [],
    work_completed: summary.work_completed || [],
    work_in_progress: summary.work_in_progress || [],
    blockers: summary.blockers || [],
    next_session_context: summary.next_session_context || 'Continue previous work',
    commits_made: summary.commits_made || 0,
    files_changed: summary.files_changed || [],
    tags: summary.tags || ['session'],
    priority: summary.priority || 'normal'
  }
  
  // Update cross-session state
  if (!updateCrossSessionState(completeSummary)) {
    errors.push('Failed to update cross-session state')
  }
  
  // Update active decisions
  if (completeSummary.decisions_made.length > 0) {
    if (!updateActiveDecisions(completeSummary.decisions_made)) {
      errors.push('Failed to update active decisions')
    }
  }
  
  // Save session log
  if (!saveSessionLog(completeSummary)) {
    errors.push('Failed to save session log')
  }
  
  if (errors.length === 0) {
    console.log('✅ SESSION ENDED SUCCESSFULLY')
    console.log(`   - State updated`)
    console.log(`   - ${completeSummary.decisions_made.length} decisions logged`)
    console.log(`   - ${completeSummary.work_completed.length} tasks completed`)
    console.log(`   - Log saved`)
  } else {
    console.error('⚠️  SESSION END COMPLETED WITH ERRORS:')
    errors.forEach(err => console.error(`   - ${err}`))
  }
  
  return {
    success: errors.length === 0,
    errors
  }
}

/**
 * HOOK: Call this when thread ends
 */
export function onThreadEnd(summary?: Partial<SessionSummary>): {
  success: boolean
  message: string
} {
  const result = autoEndSession(summary)
  
  if (result.success) {
    return {
      success: true,
      message: '✅ Session state saved. Context will be available in next thread.'
    }
  }
  
  return {
    success: false,
    message: `⚠️  Session end completed with errors: ${result.errors.join(', ')}`
  }
}

// Export for direct use
export default {
  autoEndSession,
  onThreadEnd,
  updateCrossSessionState,
  updateActiveDecisions,
  saveSessionLog,
  captureGitState
}

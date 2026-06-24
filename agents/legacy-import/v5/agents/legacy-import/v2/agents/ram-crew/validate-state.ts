/**
 * STATE VALIDATION
 * 
 * Validates cross-session state coherence.
 * Runs automatically after every state update.
 * 
 * Principle: NOW is the only language. Validate immediately.
 * 
 * @module ValidateState
 */

import fs from 'fs'
import path from 'path'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate JSON file structure
 */
function validateJSON(filepath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }
  
  try {
    if (!fs.existsSync(filepath)) {
      result.valid = false
      result.errors.push(`File not found: ${filepath}`)
      return result
    }
    
    const data = fs.readFileSync(filepath, 'utf8')
    JSON.parse(data) // Will throw if invalid
    
  } catch (error) {
    result.valid = false
    result.errors.push(`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
  
  return result
}

/**
 * Validate cross-session state structure
 */
export function validateCrossSessionState(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }
  
  const statePath = path.join(
    process.cwd(),
    'agents/vera/memory/cross-session-state.json'
  )
  
  // Check file exists and is valid JSON
  const jsonCheck = validateJSON(statePath)
  if (!jsonCheck.valid) {
    return jsonCheck
  }
  
  // Load and validate structure
  try {
    const data = fs.readFileSync(statePath, 'utf8')
    const state = JSON.parse(data)
    
    // Required fields
    const requiredFields = [
      'last_updated',
      'current_sprint',
      'active_agents',
      'repo_state',
      'work_in_progress',
      'next_session_context'
    ]
    
    for (const field of requiredFields) {
      if (!state[field]) {
        result.valid = false
        result.errors.push(`Missing required field: ${field}`)
      }
    }
    
    // Validate timestamp format
    if (state.last_updated) {
      try {
        new Date(state.last_updated)
      } catch {
        result.valid = false
        result.errors.push('Invalid timestamp format for last_updated')
      }
    }
    
    // Validate arrays
    if (state.active_agents && !Array.isArray(state.active_agents)) {
      result.valid = false
      result.errors.push('active_agents must be an array')
    }
    
    // Warnings for empty arrays
    if (state.active_agents && state.active_agents.length === 0) {
      result.warnings.push('No active agents listed')
    }
    
    if (state.work_in_progress && state.work_in_progress.length === 0) {
      result.warnings.push('No work in progress')
    }
    
  } catch (error) {
    result.valid = false
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  
  return result
}

/**
 * Validate active decisions structure
 */
export function validateActiveDecisions(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }
  
  const decisionsPath = path.join(
    process.cwd(),
    'agents/vera/memory/active-decisions.json'
  )
  
  // Check file exists and is valid JSON
  const jsonCheck = validateJSON(decisionsPath)
  if (!jsonCheck.valid) {
    return jsonCheck
  }
  
  // Load and validate structure
  try {
    const data = fs.readFileSync(decisionsPath, 'utf8')
    const decisions = JSON.parse(data)
    
    // Required fields
    if (!decisions.active_decisions || !Array.isArray(decisions.active_decisions)) {
      result.valid = false
      result.errors.push('Missing or invalid active_decisions array')
    }
    
    // Validate each decision
    for (const decision of decisions.active_decisions || []) {
      if (!decision.id) {
        result.warnings.push('Decision missing ID')
      }
      if (!decision.decision) {
        result.errors.push('Decision missing decision text')
        result.valid = false
      }
      if (!decision.status) {
        result.errors.push(`Decision ${decision.id} missing status`)
        result.valid = false
      }
    }
    
  } catch (error) {
    result.valid = false
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  
  return result
}

/**
 * Validate state coherence (cross-file consistency)
 */
export function validateStateCoherence(): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: []
  }
  
  try {
    // Load both files
    const statePath = path.join(process.cwd(), 'agents/vera/memory/cross-session-state.json')
    const decisionsPath = path.join(process.cwd(), 'agents/vera/memory/active-decisions.json')
    
    if (!fs.existsSync(statePath) || !fs.existsSync(decisionsPath)) {
      result.warnings.push('State files not found - first session?')
      return result
    }
    
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
    
    // Check timestamp consistency
    if (state.last_updated && decisions.last_updated) {
      const stateDiff = Math.abs(
        new Date(state.last_updated).getTime() - new Date(decisions.last_updated).getTime()
      )
      
      // If more than 5 minutes apart, flag as warning
      if (stateDiff > 300000) {
        result.warnings.push('State and decisions timestamps differ significantly')
      }
    }
    
    // Check if recent decisions reference exists in state
    const stateDecisionIds = state.recent_decisions?.map((d: any) => d.id) || []
    const activeDecisionIds = decisions.active_decisions?.map((d: any) => d.id) || []
    
    for (const decId of stateDecisionIds) {
      if (!activeDecisionIds.includes(decId) && !decisions.completed_decisions?.some((d: any) => d.id === decId)) {
        result.warnings.push(`Decision ${decId} referenced in state but not in decisions file`)
      }
    }
    
  } catch (error) {
    result.valid = false
    result.errors.push(`Coherence check error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  
  return result
}

/**
 * AUTO-EXECUTE: Validate all state
 */
export function autoValidateState(): {
  valid: boolean
  results: {
    cross_session_state: ValidationResult
    active_decisions: ValidationResult
    coherence: ValidationResult
  }
} {
  console.log('🔍 VALIDATING STATE...')
  
  const stateResult = validateCrossSessionState()
  const decisionsResult = validateActiveDecisions()
  const coherenceResult = validateStateCoherence()
  
  const allValid = stateResult.valid && decisionsResult.valid && coherenceResult.valid
  
  if (allValid) {
    console.log('✅ STATE VALIDATION PASSED')
  } else {
    console.error('❌ STATE VALIDATION FAILED')
    if (!stateResult.valid) {
      console.error('   - Cross-session state errors:', stateResult.errors)
    }
    if (!decisionsResult.valid) {
      console.error('   - Active decisions errors:', decisionsResult.errors)
    }
    if (!coherenceResult.valid) {
      console.error('   - Coherence errors:', coherenceResult.errors)
    }
  }
  
  // Log warnings
  const allWarnings = [
    ...stateResult.warnings,
    ...decisionsResult.warnings,
    ...coherenceResult.warnings
  ]
  
  if (allWarnings.length > 0) {
    console.warn('⚠️  VALIDATION WARNINGS:')
    allWarnings.forEach(w => console.warn(`   - ${w}`))
  }
  
  return {
    valid: allValid,
    results: {
      cross_session_state: stateResult,
      active_decisions: decisionsResult,
      coherence: coherenceResult
    }
  }
}

// Export for direct use
export default {
  autoValidateState,
  validateCrossSessionState,
  validateActiveDecisions,
  validateStateCoherence
}

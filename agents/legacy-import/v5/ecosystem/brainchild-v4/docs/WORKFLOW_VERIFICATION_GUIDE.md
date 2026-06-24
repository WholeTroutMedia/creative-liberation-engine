# ✅ Workflow Verification Guide

**Date**: February 26, 2026, 7:35 AM EST  
**Status**: Ready for First-Time Verification  
**Schedules Updated**: All workflows now run DAILY

---

## 🎯 Quick Summary

All 7 automated workflows have been:
- ✅ Created and committed
- ✅ Updated to daily schedules
- ✅ Organized with 20+ supporting scripts
- ✅ Documented comprehensively
- 🔴 **Ready for manual first-time verification**

---

## 🗓️ Updated Daily Schedules

| Workflow | Previous | Updated | Time (EST) |
|----------|----------|---------|------------|
| **Session Logger** | Every commit | Every commit | Immediate |
| **APOLLO Training** | Weekly (Sun) | ✅ **DAILY** | 2:00 AM |
| **Constitutional Monitor** | Every 6h | Every 6h | Continuous |
| **Agent Performance** | Every 12h | Every 12h | Continuous |
| **Pattern Accumulator** | Daily | Daily | 3:00 AM |
| **Cross-Hive Sync** | Weekly (Mon) | ✅ **DAILY** | 6:00 AM |
| **Memory Consolidation** | Daily | Daily | 4:00 AM |

---

## 🚀 Manual Verification Steps

### 1. Session Auto-Logger (Immediate)

**Already Running**: This workflow triggered automatically when workflows were committed!

**Verify**:
```bash
# Check migration tracker for new entries
cat KEEPER/migration-tracker.json | jq '.sessions[-5:]'

# Check for recent session logs
ls -la SESSION_LOGS/
```

**Expected**: New session entries with automated flag

---

### 2. Constitutional Drift Monitor (Manual Trigger)

**Trigger via GitHub UI**:
1. Go to [Actions tab](https://github.com/WholeTroutMedia/creative-liberation-engine-v4/actions)
2. Click "Constitutional Drift Monitor" in left sidebar
3. Click "Run workflow" button
4. Click green "Run workflow" to confirm

**What to Watch**:
- ✅ Loads constitutional baseline from ARTICLES.md
- ✅ Analyzes current state
- ✅ Calculates drift score
- ✅ Generates report in `reports/`
- ✅ Updates constitutional dashboard

**Expected Output**:
```
reports/constitutional_drift_YYYYMMDD_HHMMSS.md
docs/CONSTITUTIONAL_DASHBOARD.md (updated)
```

**Verify**:
```bash
cat reports/constitutional_drift_*.md | head -20
```

---

### 3. Agent Performance Tracker (Manual Trigger)

**Trigger via GitHub UI**:
1. Actions → "Agent Performance Tracker"
2. Run workflow

**What to Watch**:
- ✅ Loads agent registry
- ✅ Calculates performance trends
- ✅ Identifies top performers
- ✅ Flags struggling agents
- ✅ Generates report

**Expected Output**:
```
reports/agent_performance_YYYYMMDD.md
CORE_FOUNDATION/agents/.agent-status.json (updated)
```

**Verify**:
```bash
cat reports/agent_performance_*.md
cat CORE_FOUNDATION/agents/.agent-status.json | jq '.agents[0]'
```

---

### 4. Pattern Accumulator (Manual Trigger)

**Trigger via GitHub UI**:
1. Actions → "Pattern Accumulator"
2. Run workflow
3. Optional: Set custom lookback (default: 7 days)

**What to Watch**:
- ✅ Analyzes recent sessions
- ✅ Detects recurring patterns (min frequency: 3)
- ✅ Extracts lessons learned
- ✅ Updates context library
- ✅ Identifies cross-hive patterns

**Expected Output**:
```
patterns/detected_patterns.json
patterns/lessons.json
patterns/cross_hive.json
patterns/PATTERN_SUMMARY.md
SESSION_LOGS/insights_YYYYMMDD.md
CORE_FOUNDATION/context-library/ (updated)
```

**Verify**:
```bash
cat patterns/PATTERN_SUMMARY.md
cat patterns/detected_patterns.json | jq '.patterns | length'
```

---

### 5. Memory Consolidation (Manual Trigger)

**Trigger via GitHub UI**:
1. Actions → "Memory Consolidation (Sleep Cycle)"
2. Run workflow
3. Optional: Set age threshold (default: 24h)

**What to Watch**:
- ✅ Runs hippocampus → neocortex consolidation
- ✅ Moves memories > 24h old with importance ≥0.7
- ✅ Prunes low-priority memories
- ✅ Optimizes storage
- ✅ Generates metrics

**Expected Output**:
```
consolidation/consolidated_memories.json
consolidation/pruning_report.json
consolidation/metrics.json
SESSION_LOGS/consolidation_YYYYMMDD.md
docs/MEMORY_DASHBOARD.md (updated)
```

**Verify**:
```bash
cat SESSION_LOGS/consolidation_*.md
cat consolidation/metrics.json | jq .
```

---

### 6. APOLLO Training Pipeline (Manual Trigger)

**⚠️ Note**: This requires SCRIBE session data to exist first.

**Trigger via GitHub UI**:
1. Actions → "APOLLO Training Pipeline"
2. Run workflow
3. Optional parameters:
   - `num_sessions`: 1000 (default)
   - `epochs`: 100 (default)
   - `learning_rate`: 0.0001 (default)

**What to Watch**:
- ✅ Extracts SCRIBE sessions from archive
- ✅ Analyzes session distribution
- ✅ Trains APOLLO model (50-dim shared + 20-dim specific)
- ✅ Validates constitutional alignment
- ✅ Creates training report
- ✅ Updates migration tracker

**Expected Output**:
```
models/apollo/YYYYMMDD_HHMMSS/
  ├── best_model.pt
  ├── metrics.json
  └── TRAINING_REPORT.md
training_data/
  ├── scribe_sessions.pkl
  ├── distribution_report.json
  └── DATA_REPORT.md
```

**Success Criteria**:
- ✅ Constitutional alignment ≥0.90
- ✅ Reconstruction loss <0.05
- ✅ No critical errors

**Verify**:
```bash
ls -la models/apollo/
cat models/apollo/*/TRAINING_REPORT.md
```

**If No SCRIBE Data Yet**:
- Workflow will create minimal/mock data for testing
- Full training requires actual agent session history

---

### 7. Cross-Hive Learning Sync (Manual Trigger)

**⚠️ Prerequisite**: APOLLO Training must complete successfully first

**Trigger via GitHub UI**:
1. Actions → "Cross-Hive Learning Sync"
2. Run workflow

**What to Watch**:
- ✅ Loads latest trained APOLLO model
- ✅ Extracts shared constitutional knowledge (50-dim)
- ✅ Syncs to all 6 hives
- ✅ Validates transfer accuracy
- ✅ Tests cross-hive predictions

**Expected Output**:
```
sync/constitutional_knowledge.json
sync/sync_results.json
sync/validation.json
sync/prediction_tests.json
reports/cross_hive_sync_YYYYMMDD.md
```

**Success Criteria**:
- ✅ All hives synced
- ✅ Transfer accuracy ≥0.85
- ✅ Predictions validated

**Verify**:
```bash
cat reports/cross_hive_sync_*.md
cat sync/sync_results.json | jq '.synced_hives | length'
```

---

## 📋 Verification Checklist

### Pre-Verification
- [x] All 7 workflows committed
- [x] All 20+ scripts committed
- [x] Schedules updated to daily
- [x] Documentation complete

### Manual Verification (Do Now)
- [ ] 1. Session Logger - Check migration tracker
- [ ] 2. Constitutional Monitor - Trigger manually
- [ ] 3. Agent Performance - Trigger manually
- [ ] 4. Pattern Accumulator - Trigger manually
- [ ] 5. Memory Consolidation - Trigger manually
- [ ] 6. APOLLO Training - Trigger manually (may need mock data)
- [ ] 7. Cross-Hive Sync - Trigger after APOLLO (if successful)

### Post-Verification
- [ ] All workflows completed successfully
- [ ] Output files generated as expected
- [ ] No critical errors in logs
- [ ] Migration tracker updated
- [ ] Reports readable and informative

---

## 🐞 Troubleshooting

### Workflow Fails to Start
**Issue**: "Run workflow" button doesn't work  
**Solution**: Ensure you're on the main branch and have proper permissions

### Missing Dependencies
**Issue**: `ModuleNotFoundError` in workflow logs  
**Solution**: Check `requirements.txt` includes all needed packages

### File Not Found Errors
**Issue**: Script can't find input files  
**Solution**: 
```bash
# Create necessary directories
mkdir -p SESSION_LOGS reports patterns consolidation sync models/apollo
mkdir -p training_data creative_liberation_engine/memory/scribe_archive
```

### SCRIBE Archive Empty
**Issue**: APOLLO training finds 0 sessions  
**Solution**: 
- Normal for first run - workflows will accumulate sessions over time
- For testing, workflow includes mock data generation
- Real training will be more effective after days/weeks of sessions

### Constitutional Drift "Always Aligned"
**Issue**: Drift score always shows perfect alignment  
**Solution**: 
- Expected initially - drift detection requires changes over time
- Modify ARTICLES.md to test (then revert)
- Real drift will be detected as codebase evolves

---

## 📊 Monitoring After First Run

### Check Workflow Status
```bash
# Via GitHub UI
Actions tab → View recent workflow runs

# Look for:
- ✅ Green checkmarks (success)
- 🟡 Yellow circles (in progress)
- 🔴 Red X (failure - check logs)
```

### Review Generated Files
```bash
# Session logs
ls -la SESSION_LOGS/

# Reports
ls -la reports/

# Patterns
ls -la patterns/

# Models
ls -la models/apollo/

# Migration tracker
cat KEEPER/migration-tracker.json | jq '.metadata'
```

### Check for Issues Created
```bash
# Via GitHub UI
Issues tab → Look for automated issues:
- 🧬 APOLLO Training Complete
- 🧠 Significant Patterns Detected
- 📊 Agent Performance Review
- 🔄 Cross-Hive Sync Complete
```

---

## 🚀 Next Steps After Verification

### 1. Let Workflows Run Automatically
After manual verification, workflows will run on their daily schedules:
- **Tonight (2 AM)**: APOLLO Training
- **Tonight (3 AM)**: Pattern Accumulator
- **Tonight (4 AM)**: Memory Consolidation
- **Tomorrow (6 AM)**: Cross-Hive Sync

### 2. Monitor for a Week
- Check daily for new reports
- Review generated insights
- Verify patterns emerging
- Validate constitutional alignment

### 3. Optimize Thresholds
After observing real data:
```python
# scripts/automation/config.py (create if needed)
CONSTITUTIONAL_ALIGNMENT_THRESHOLD = 0.85  # Adjust based on observations
PERFORMANCE_THRESHOLD = 0.70  # Adjust based on agent data
PATTERN_MIN_FREQUENCY = 3  # Adjust based on session volume
```

### 4. Expand Training Data
As sessions accumulate:
- Increase `num_sessions` parameter
- Monitor training time
- Validate alignment improvements

---

## 📝 Quick Reference

### Trigger All Workflows Manually (In Order)

1. **Constitutional Monitor** (baseline check)
2. **Agent Performance** (current status)
3. **Pattern Accumulator** (detect patterns)
4. **Memory Consolidation** (organize knowledge)
5. **APOLLO Training** (train model)
6. **Cross-Hive Sync** (share knowledge)
7. **Session Logger** (automatic on next commit)

### View All Recent Outputs
```bash
# One-liner to see all generated files
find SESSION_LOGS reports patterns consolidation sync models/apollo -type f -mtime -1 -ls
```

### Check Workflow Health
```bash
# Count successful runs today
gh run list --workflow="apollo-training.yml" --created="$(date +%Y-%m-%d)" --json conclusion -q '[.[] | select(.conclusion=="success")] | length'
```

---

## ✅ Success Indicators

### After First Manual Verification
- ✅ At least 5/7 workflows completed successfully
- ✅ Migration tracker has new entries
- ✅ Reports generated in correct directories
- ✅ No blocking errors in logs
- ✅ Constitutional alignment calculated

### After First 24 Hours
- ✅ All daily workflows ran automatically
- ✅ Session logger captured new commits
- ✅ Pattern accumulation found patterns
- ✅ Memory consolidation processed memories
- ✅ APOLLO training completed (if enough sessions)

### After First Week
- ✅ 7 days of training data accumulated
- ✅ Patterns clearly emerging
- ✅ Agent performance trends visible
- ✅ Constitutional alignment stable
- ✅ Cross-hive sync working
- ✅ Knowledge base growing automatically

---

**Ready to Begin Verification!**

Go to: [GitHub Actions Tab](https://github.com/WholeTroutMedia/creative-liberation-engine-v4/actions)

Start with: **Constitutional Drift Monitor** (easiest to verify)

---

*Built by AVERI Collective*  
*February 26, 2026*

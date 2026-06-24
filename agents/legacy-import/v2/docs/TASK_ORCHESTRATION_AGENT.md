# 🎯 Task Orchestration Agent (TOA)

**Last Updated:** January 16, 2026  
**Status:** V1.0 - Critical Infrastructure  
**Owner:** AI Coordination Team

---

## Executive Summary

The **Task Orchestration Agent (TOA)** is a meta-coordination layer that sits between human requests and execution agents (like Comet). It prevents confusion, eliminates redundancy, and optimizes task bundling for maximum efficiency across all agents.

**Problem Solved:** Agents getting confused by rapid-fire updates, duplicate tasks, or poorly sequenced work.  
**Solution:** Smart task analysis, deduplication, dependency mapping, and optimal bundling.

---

## 🚨 The Problem: Agent Confusion

### Real-World Example

**Scenario:** You're shipping updates rapidly to Comet:
```
1. "Add pricing page"
2. "Update unit economics doc"
3. "Create product flows"
4. "Fix pricing page styling"
5. "Add ROI calculator to pricing page"
```

**What Happens Without TOA:**
- Task #1 and #4 conflict (agent modifies pricing page twice)
- Task #1 and #5 should be bundled (both edit same file)
- Agent context switches 5 times (inefficient)
- Potential merge conflicts if tasks run in parallel
- Agent "forgets" earlier tasks while working on later ones

**Impact:**
- Wasted compute (redundant operations)
- Slower delivery (context switching overhead)
- Errors (conflicting instructions)
- Frustrated agents (and humans!)

---

## ✅ The Solution: Task Orchestration Agent

### How TOA Works

```
👤 Human: "Add pricing page, update docs, create flows"
    ↓
🧠 TOA: Analyzes incoming tasks
    ↓
📊 TOA: Detects patterns, dependencies, redundancies
    ↓
🎯 TOA: Bundles & sequences optimally
    ↓
📦 TOA: Sends organized task batches to execution agents
    ↓
🤖 Comet/Claude/etc: Executes efficiently
```

---

## 🧠 TOA Core Functions

### 1. **Task Analysis & Parsing**

**Input:** Raw human request (text, voice, or structured)

**Processing:**
```python
# orchestration/task_analyzer.py

class TaskAnalyzer:
    def parse_request(self, request: str) -> List[Task]:
        """
        Extract individual tasks from human request.
        Handle natural language, lists, or multi-step instructions.
        """
        prompt = f"""
        Parse this request into discrete tasks:
        {request}
        
        Output JSON array of tasks:
        [
          {{
            "id": "task_1",
            "description": "Add pricing page",
            "type": "create",
            "target": "docs/PRICING_PAGE.md",
            "priority": "high",
            "estimated_time_min": 30
          }}
        ]
        """
        
        response = self.llm.generate(prompt)
        tasks = [Task.parse_obj(t) for t in json.loads(response)]
        
        return tasks
```

**Output:**
```json
[
  {"id": "task_1", "description": "Add pricing page", "type": "create", "target": "docs/PRICING_PAGE.md"},
  {"id": "task_2", "description": "Update unit economics", "type": "update", "target": "docs/UNIT_ECONOMICS.md"},
  {"id": "task_3", "description": "Create product flows", "type": "create", "target": "docs/PRODUCT_FLOWS.md"},
  {"id": "task_4", "description": "Fix pricing page styling", "type": "update", "target": "docs/PRICING_PAGE.md"},
  {"id": "task_5", "description": "Add ROI calculator", "type": "update", "target": "docs/PRICING_PAGE.md"}
]
```

---

### 2. **Deduplication & Conflict Detection**

**Goal:** Identify redundant or conflicting tasks

**Logic:**
```python
class TaskDeduplicator:
    def detect_conflicts(self, tasks: List[Task]) -> ConflictReport:
        conflicts = []
        
        # Group tasks by target file
        file_groups = defaultdict(list)
        for task in tasks:
            file_groups[task.target].append(task)
        
        # Detect conflicts within each file group
        for target, group in file_groups.items():
            if len(group) > 1:
                # Multiple tasks editing same file
                conflict = {
                    "type": "multi_edit",
                    "target": target,
                    "tasks": [t.id for t in group],
                    "recommendation": "Bundle into single task"
                }
                conflicts.append(conflict)
        
        return ConflictReport(conflicts=conflicts)
    
    def merge_similar_tasks(self, tasks: List[Task]) -> List[Task]:
        """
        Merge tasks that operate on the same file.
        """
        merged = []
        file_groups = defaultdict(list)
        
        for task in tasks:
            file_groups[task.target].append(task)
        
        for target, group in file_groups.items():
            if len(group) == 1:
                merged.append(group[0])
            else:
                # Merge multiple tasks into one
                merged_task = Task(
                    id=f"merged_{group[0].id}",
                    description=f"Update {target} with: " + "; ".join([t.description for t in group]),
                    type="update",
                    target=target,
                    subtasks=[t.id for t in group]
                )
                merged.append(merged_task)
        
        return merged
```

**Before Deduplication:**
```
task_1: Add pricing page (docs/PRICING_PAGE.md)
task_4: Fix pricing page styling (docs/PRICING_PAGE.md)
task_5: Add ROI calculator (docs/PRICING_PAGE.md)
```

**After Deduplication:**
```
merged_task_1: Update docs/PRICING_PAGE.md with:
  - Add pricing page
  - Fix styling
  - Add ROI calculator
```

---

### 3. **Dependency Mapping**

**Goal:** Determine task execution order based on dependencies

**Logic:**
```python
class DependencyMapper:
    def build_dependency_graph(self, tasks: List[Task]) -> DependencyGraph:
        """
        Build DAG (directed acyclic graph) of task dependencies.
        """
        graph = nx.DiGraph()
        
        for task in tasks:
            graph.add_node(task.id, task=task)
        
        # Detect dependencies
        for i, task_a in enumerate(tasks):
            for j, task_b in enumerate(tasks):
                if i != j:
                    if self._depends_on(task_a, task_b):
                        graph.add_edge(task_b.id, task_a.id)  # task_a depends on task_b
        
        return DependencyGraph(graph=graph)
    
    def _depends_on(self, task_a: Task, task_b: Task) -> bool:
        """
        Check if task_a depends on task_b.
        """
        # Example heuristics:
        
        # 1. File dependencies
        if task_a.type == "update" and task_b.type == "create" and task_a.target == task_b.target:
            return True  # Can't update a file that doesn't exist yet
        
        # 2. Semantic dependencies (use LLM)
        prompt = f"""
        Does Task A depend on Task B being completed first?
        
        Task A: {task_a.description}
        Task B: {task_b.description}
        
        Answer: yes/no
        Reason: [brief explanation]
        """
        response = self.llm.generate(prompt)
        return "yes" in response.lower()
    
    def topological_sort(self, graph: DependencyGraph) -> List[Task]:
        """
        Return tasks in optimal execution order.
        """
        sorted_ids = list(nx.topological_sort(graph.graph))
        return [graph.graph.nodes[id]["task"] for id in sorted_ids]
```

**Example Dependency Graph:**
```
task_2 (Create docs/)           task_3 (Create flows/)
    ↓                                 ↓
merged_task_1 (Update pricing)   task_6 (Reference flows in pricing)
    ↓                                 ↓
task_7 (Deploy pricing page)
```

**Execution Order:**
```
1. task_2, task_3 (parallel - no dependencies)
2. merged_task_1, task_6 (parallel - depend on step 1)
3. task_7 (depends on all previous)
```

---

### 4. **Optimal Bundling**

**Goal:** Group tasks for maximum efficiency

**Strategies:**

#### **A. File-Based Bundling**
```python
class FileBundler:
    def bundle_by_file(self, tasks: List[Task]) -> List[TaskBundle]:
        """
        Bundle tasks that modify the same file.
        """
        bundles = []
        file_groups = defaultdict(list)
        
        for task in tasks:
            file_groups[task.target].append(task)
        
        for target, group in file_groups.items():
            bundle = TaskBundle(
                id=f"bundle_{target.replace('/', '_')}",
                name=f"Update {target}",
                tasks=group,
                strategy="sequential",  # Edit same file sequentially
                estimated_time=sum(t.estimated_time_min for t in group)
            )
            bundles.append(bundle)
        
        return bundles
```

#### **B. Context-Based Bundling**
```python
class ContextBundler:
    def bundle_by_context(self, tasks: List[Task]) -> List[TaskBundle]:
        """
        Bundle tasks that share similar context (domain knowledge).
        """
        # Use embeddings to measure semantic similarity
        embeddings = [self.embed(t.description) for t in tasks]
        
        # Cluster tasks by similarity
        clusters = self.cluster_embeddings(embeddings, n_clusters=3)
        
        bundles = []
        for cluster_id, cluster_tasks in clusters.items():
            bundle = TaskBundle(
                id=f"bundle_context_{cluster_id}",
                name=f"Context group {cluster_id}",
                tasks=cluster_tasks,
                strategy="parallel",  # Similar tasks can run in parallel
                estimated_time=max(t.estimated_time_min for t in cluster_tasks)
            )
            bundles.append(bundle)
        
        return bundles
```

#### **C. Time-Based Bundling**
```python
class TimeBundler:
    def bundle_by_time(self, tasks: List[Task], max_time_per_bundle: int = 60) -> List[TaskBundle]:
        """
        Bundle tasks to fit within time windows (e.g., 1-hour sprints).
        """
        bundles = []
        current_bundle = []
        current_time = 0
        
        for task in sorted(tasks, key=lambda t: t.priority, reverse=True):
            if current_time + task.estimated_time_min <= max_time_per_bundle:
                current_bundle.append(task)
                current_time += task.estimated_time_min
            else:
                # Start new bundle
                bundles.append(TaskBundle(tasks=current_bundle, estimated_time=current_time))
                current_bundle = [task]
                current_time = task.estimated_time_min
        
        # Add final bundle
        if current_bundle:
            bundles.append(TaskBundle(tasks=current_bundle, estimated_time=current_time))
        
        return bundles
```

---

### 5. **Agent Assignment**

**Goal:** Route bundled tasks to the right agent

**Logic:**
```python
class AgentRouter:
    def assign_agent(self, bundle: TaskBundle) -> AgentAssignment:
        """
        Select optimal agent for task bundle based on:
        - Agent capabilities
        - Current workload
        - Task complexity
        """
        # Agent capability matrix
        agents = {
            "comet": {
                "capabilities": ["code_generation", "documentation", "refactoring"],
                "max_context_tokens": 200000,
                "current_load": 0.3,  # 30% capacity used
            },
            "claude_opus": {
                "capabilities": ["complex_reasoning", "long_documents", "architecture"],
                "max_context_tokens": 200000,
                "current_load": 0.7,
            },
            "gpt4o": {
                "capabilities": ["quick_tasks", "api_calls", "data_processing"],
                "max_context_tokens": 128000,
                "current_load": 0.5,
            }
        }
        
        # Score each agent
        scores = {}
        for agent_name, agent_info in agents.items():
            score = 0
            
            # Capability match
            task_types = set(t.type for t in bundle.tasks)
            capability_match = len(task_types.intersection(agent_info["capabilities"])) / len(task_types)
            score += capability_match * 0.5
            
            # Availability (prefer less loaded agents)
            score += (1 - agent_info["current_load"]) * 0.3
            
            # Context window fit
            bundle_tokens = self.estimate_tokens(bundle)
            if bundle_tokens <= agent_info["max_context_tokens"]:
                score += 0.2
            
            scores[agent_name] = score
        
        # Select best agent
        best_agent = max(scores, key=scores.get)
        
        return AgentAssignment(
            bundle=bundle,
            agent=best_agent,
            score=scores[best_agent],
            estimated_completion_time=bundle.estimated_time
        )
```

---

## 🎯 TOA Instruction Set (For All AI Agents)

### **Core Directive**

```markdown
# TASK ORCHESTRATION PROTOCOL

## Before Writing to GitHub

YOU MUST:

1. **Check for existing tasks** targeting the same file
   - Query TOA: "Are there pending tasks for [filename]?"
   - If yes, bundle your task with existing ones

2. **Declare your intent**
   - TOA: "I plan to modify [filename] with [description]"
   - Wait for TOA approval before proceeding

3. **Respect task order**
   - Only execute tasks assigned to you by TOA
   - Do not skip ahead in the dependency graph

4. **Report completion**
   - TOA: "Task [id] completed. Ready for next."
   - Include any blockers or issues encountered

## If You Notice Redundancy

STOP and alert TOA:
- "I notice tasks [A] and [B] appear redundant. Should I merge them?"
- Wait for TOA confirmation

## If Instructions Are Unclear

ASK TOA for clarification:
- "Task [id] description is ambiguous. Options: [A, B, C]. Which should I pursue?"
- Do not guess or assume

## If You're Confused

ADMIT IT:
- "I'm confused by the sequence of tasks [X, Y, Z]. Can you re-bundle or clarify dependencies?"
- TOA will reorganize and provide clearer instructions
```

---

## 📋 TOA Dashboard (UI for Humans)

### **Real-Time Task View**

```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Task Orchestration Dashboard                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Active Tasks: 8                                         │
│  ✅ Completed: 23                                           │
│  ⏸️  Paused: 2                                              │
│  🚨 Conflicts Detected: 1                                   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 📦 Bundles in Progress                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Bundle 1: Pricing Documentation (Comet)                    │
│  ├─ Task 1: Add pricing page ✅ (completed 2m ago)         │
│  ├─ Task 4: Fix styling 🔄 (in progress, 40% done)         │
│  └─ Task 5: Add ROI calculator ⏳ (queued)                 │
│  Est. Completion: 8 minutes                                 │
│                                                             │
│  Bundle 2: Product Flows (Claude Opus)                      │
│  ├─ Task 3: Create product flows ✅ (completed 5m ago)     │
│  └─ Task 6: Add journey maps ⏳ (queued)                   │
│  Est. Completion: 15 minutes                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ⚠️ Conflicts Detected                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ❌ Task 7 & Task 9 both modify README.md                  │
│     Recommendation: Merge into single task                  │
│     [Auto-Merge] [Manual Review] [Ignore]                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Example: TOA in Action

### **Scenario: Rapid-Fire Updates**

**Human Input:**
```
1. "Add pricing page"
2. "Update unit economics"
3. "Create product flows"
4. "Fix pricing page styling" (sent 30 seconds later)
5. "Add ROI calculator to pricing page" (sent 1 minute later)
```

---

### **Step 1: TOA Receives Tasks**

```python
# TOA processes incoming requests

tasks = [
    Task(id="1", desc="Add pricing page", target="docs/PRICING_PAGE.md"),
    Task(id="2", desc="Update unit economics", target="docs/UNIT_ECONOMICS.md"),
    Task(id="3", desc="Create product flows", target="docs/PRODUCT_FLOWS.md"),
    Task(id="4", desc="Fix pricing page styling", target="docs/PRICING_PAGE.md"),  # Conflict!
    Task(id="5", desc="Add ROI calculator", target="docs/PRICING_PAGE.md"),  # Conflict!
]
```

---

### **Step 2: TOA Detects Conflicts**

```python
conflicts = toa.detect_conflicts(tasks)

# Output:
# [
#   {
#     "type": "multi_edit",
#     "target": "docs/PRICING_PAGE.md",
#     "tasks": ["1", "4", "5"],
#     "recommendation": "Bundle into single task"
#   }
# ]
```

---

### **Step 3: TOA Bundles Tasks**

```python
bundles = toa.bundle_tasks(tasks)

# Output:
# [
#   Bundle(id="bundle_1", name="Pricing Page Updates", tasks=["1", "4", "5"]),
#   Bundle(id="bundle_2", name="Unit Economics", tasks=["2"]),
#   Bundle(id="bundle_3", name="Product Flows", tasks=["3"])
# ]
```

---

### **Step 4: TOA Builds Dependency Graph**

```python
graph = toa.build_dependency_graph(bundles)

# Output:
#   bundle_2 ──┐
#              ├──> bundle_1 (depends on docs existing)
#   bundle_3 ──┘
```

---

### **Step 5: TOA Assigns Agents**

```python
assignments = toa.assign_agents(bundles)

# Output:
# [
#   Assignment(bundle="bundle_2", agent="comet", priority=1),
#   Assignment(bundle="bundle_3", agent="claude_opus", priority=1),  # Parallel with bundle_2
#   Assignment(bundle="bundle_1", agent="comet", priority=2)  # After bundle_2
# ]
```

---

### **Step 6: TOA Dispatches Tasks**

**To Comet:**
```
🎯 TOA → Comet:

Bundle: bundle_2
Priority: 1
Task: Update docs/UNIT_ECONOMICS.md

Instructions:
- Review existing UNIT_ECONOMICS.md
- Add new sections as needed
- Maintain consistent formatting
- Report completion to TOA

⚠️ Note: Bundle bundle_1 depends on you. Please complete ASAP.
```

**To Claude Opus:**
```
🎯 TOA → Claude Opus:

Bundle: bundle_3
Priority: 1
Task: Create docs/PRODUCT_FLOWS.md

Instructions:
- New file creation
- Use template: product_flows_template.md
- Include journey maps and technical specs
- Report completion to TOA
```

---

### **Step 7: Agents Execute**

**Comet (after 5 minutes):**
```
✅ Comet → TOA:

Bundle bundle_2 completed.
File: docs/UNIT_ECONOMICS.md updated.
Commit: abc123
Ready for next task.
```

**Claude Opus (after 8 minutes):**
```
✅ Claude Opus → TOA:

Bundle bundle_3 completed.
File: docs/PRODUCT_FLOWS.md created.
Commit: def456
Ready for next task.
```

---

### **Step 8: TOA Dispatches Dependent Task**

**To Comet:**
```
🎯 TOA → Comet:

Bundle: bundle_1 (MERGED TASKS)
Priority: 2
Tasks:
  1. Add pricing page
  4. Fix pricing page styling
  5. Add ROI calculator

Instructions:
- Create docs/PRICING_PAGE.md
- Apply all three modifications in single pass:
  1. Initial page structure
  2. Styling fixes (blue/gray theme)
  3. ROI calculator widget
- This avoids three separate commits and potential conflicts
- Report completion to TOA
```

**Comet (after 12 minutes):**
```
✅ Comet → TOA:

Bundle bundle_1 completed.
File: docs/PRICING_PAGE.md created.
All subtasks completed in single commit: ghi789
Ready for next task.
```

---

### **Step 9: TOA Reports to Human**

```
✅ TOA → Human:

All tasks completed! Summary:

📦 Bundle 1: Pricing Page Updates (Comet)
   ├─ Task 1: Add pricing page ✅
   ├─ Task 4: Fix styling ✅
   └─ Task 5: Add ROI calculator ✅
   Commit: ghi789
   Time: 12 minutes

📦 Bundle 2: Unit Economics (Comet)
   └─ Task 2: Update unit economics ✅
   Commit: abc123
   Time: 5 minutes

📦 Bundle 3: Product Flows (Claude Opus)
   └─ Task 3: Create product flows ✅
   Commit: def456
   Time: 8 minutes

💡 Efficiency Gains:
- Merged 3 conflicting tasks → saved 2 redundant commits
- Parallelized bundle_2 and bundle_3 → saved 8 minutes
- Total time: 12 minutes (vs. 25 minutes sequential)

🎯 Next: Would you like to review the changes or assign more tasks?
```

---

## 🛠️ Implementation

### **Phase 1: Core TOA (Week 1)**

```python
# orchestration/toa.py

class TaskOrchestrationAgent:
    def __init__(self):
        self.task_queue = []
        self.active_bundles = {}
        self.agents = {"comet": Agent(), "claude": Agent(), "gpt4": Agent()}
    
    def receive_task(self, request: str) -> TaskReceipt:
        # Parse request into tasks
        tasks = self.task_analyzer.parse_request(request)
        
        # Detect conflicts
        conflicts = self.deduplicator.detect_conflicts(tasks)
        
        # Bundle tasks
        bundles = self.bundler.bundle_tasks(tasks)
        
        # Build dependency graph
        graph = self.dependency_mapper.build_graph(bundles)
        
        # Assign agents
        assignments = self.router.assign_agents(bundles, graph)
        
        # Dispatch to agents
        for assignment in assignments:
            self.dispatch(assignment)
        
        return TaskReceipt(tasks=tasks, bundles=bundles, conflicts=conflicts)
    
    def dispatch(self, assignment: AgentAssignment):
        agent = self.agents[assignment.agent]
        agent.execute_bundle(assignment.bundle)
        
        # Track in active bundles
        self.active_bundles[assignment.bundle.id] = {
            "agent": assignment.agent,
            "start_time": datetime.now(),
            "status": "in_progress"
        }
    
    def handle_completion(self, bundle_id: str, result: ExecutionResult):
        # Mark bundle complete
        self.active_bundles[bundle_id]["status"] = "completed"
        
        # Check for dependent bundles
        dependent_bundles = self.dependency_mapper.get_dependents(bundle_id)
        
        # Dispatch dependent bundles if all dependencies satisfied
        for dep_bundle in dependent_bundles:
            if self._all_dependencies_met(dep_bundle):
                assignment = self.router.assign_agent(dep_bundle)
                self.dispatch(assignment)
```

---

### **Phase 2: Agent Integration (Week 2)**

**Update all AI agents to respect TOA:**

```python
# agents/comet_agent.py

class CometAgent:
    def before_github_write(self, filename: str, content: str):
        # Check with TOA first
        response = self.toa_client.check_task(
            agent="comet",
            action="write",
            target=filename,
            description="Updating file with new content"
        )
        
        if response.status == "conflict":
            # TOA detected conflict
            raise ConflictError(f"TOA blocked write: {response.reason}")
        
        elif response.status == "approved":
            # Proceed with write
            self.write_to_github(filename, content)
        
        elif response.status == "bundled":
            # TOA bundled with other tasks
            print(f"Task bundled. Will execute later as part of {response.bundle_id}")
```

---

### **Phase 3: Dashboard (Week 3)**

**Build real-time UI for humans:**

```tsx
// studio-gui/src/pages/TOADashboard.tsx

const TOADashboard = () => {
  const { data: bundles } = useQuery('active-bundles', fetchActiveBundles);
  const { data: conflicts } = useQuery('conflicts', fetchConflicts);
  
  return (
    <div className="toa-dashboard">
      <h1>🎯 Task Orchestration</h1>
      
      <div className="stats">
        <StatCard label="Active Tasks" value={bundles?.length || 0} />
        <StatCard label="Conflicts" value={conflicts?.length || 0} status="warning" />
      </div>
      
      <div className="bundles">
        {bundles?.map(bundle => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            onPause={() => pauseBundle(bundle.id)}
            onCancel={() => cancelBundle(bundle.id)}
          />
        ))}
      </div>
      
      {conflicts?.length > 0 && (
        <ConflictPanel
          conflicts={conflicts}
          onResolve={resolveConflict}
        />
      )}
    </div>
  );
};
```

---

## 🎯 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Redundant Tasks Eliminated** | 80% reduction | Count of merged tasks |
| **Agent Context Switches** | 50% reduction | Avg switches per hour |
| **Task Completion Time** | 30% faster | Bundle time vs. sequential |
| **Conflict Detection Rate** | 95%+ | Conflicts caught before execution |
| **Agent Confusion Incidents** | <1 per week | Support tickets from agents |

---

## 🚀 Next Steps

1. **✅ Implement Phase 1** (Core TOA logic)
2. **✅ Integrate with Comet** (add TOA checks)
3. **✅ Build dashboard** (real-time monitoring)
4. **✅ Test with rapid-fire tasks** (simulate confusion scenarios)
5. **✅ Roll out to all agents** (Claude, GPT-4, etc.)

---

**Related Documents:**
- [COMMAND_CENTER_AGENT.md](../COMMAND_CENTER_AGENT.md) - High-level orchestration
- [NEXUS_AI_ORCHESTRATION.md](../NEXUS_AI_ORCHESTRATION.md) - AI coordination patterns
- [CONTINUATION_PROTOCOL.md](../CONTINUATION_PROTOCOL.md) - Context handoff between agents

---

**Questions? Feedback?**  
Slack: #task-orchestration | Email: ai-ops@clestudio.ai

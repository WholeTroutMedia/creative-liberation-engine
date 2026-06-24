# 📋 Planned Agents - Future Concepts

**Status:** 💭 CONCEPTUAL  
**Purpose:** Staging area for future agent ideas  
**Rule:** Agents move to `/agents/[name]/` only when actively implemented

---

## ⚠️ Important Notice

**These are NOT active agents.** They are documented ideas and potential future capabilities.

- ❌ Not in `.agent-status.json` registry
- ❌ Not available for summoning
- ❌ No implementation files
- ✅ Vision for future expansion
- ✅ Move to `/agents/` when activated

---

## 🔬 Research & Analysis Domain

### RESEARCH
**Concept:** General research coordination  
**Potential Role:** Literature review, data gathering, source verification  
**Potential Hive:** Could be new RESEARCH_HIVE or under KEEPER

### DEEP_RESEARCH
**Concept:** Advanced research with multi-source synthesis  
**Potential Role:** Academic-level research, complex topic investigation  
**Potential Hive:** RESEARCH_HIVE

### SURVEYOR
**Concept:** Landscape analysis and market research  
**Potential Role:** Competitive analysis, trend identification  
**Potential Hive:** RESEARCH_HIVE

### CARTOGRAPHER
**Concept:** Information mapping and visualization  
**Potential Role:** Knowledge graph creation, relationship mapping  
**Note:** May overlap with ATLAS functionality

---

## 📊 Analysis & Optimization Domain

### DATA_ANALYST
**Concept:** Statistical analysis and data interpretation  
**Potential Role:** Metrics analysis, pattern recognition, reporting  
**Potential Hive:** ANALYTICS_HIVE or under KEEPER

### FINANCIAL_ANALYST
**Concept:** Financial modeling and analysis  
**Potential Role:** Budget tracking, ROI calculation, cost optimization  
**Potential Hive:** ANALYTICS_HIVE

### OPTIMIZER
**Concept:** Process and performance optimization  
**Potential Role:** Efficiency improvements, resource allocation  
**Potential Hive:** OPERATIONS_HIVE or SWITCHBOARD

### SCHEDULER
**Concept:** Task scheduling and timeline management  
**Potential Role:** Project planning, deadline tracking, resource scheduling  
**Potential Hive:** OPERATIONS_HIVE or SWITCHBOARD

---

## ✍️ Content Creation Domain

### CREATIVE_WRITER
**Concept:** Narrative and creative content generation  
**Potential Role:** Storytelling, creative copy, narrative design  
**Potential Hive:** Could be under ORACLE_COUNCIL or new CONTENT_HIVE

### TECHNICAL_WRITER
**Concept:** Technical documentation specialist  
**Potential Role:** API docs, technical guides, system documentation  
**Note:** May overlap with KEEPER/ARCH functionality

### COPY_EDITOR
**Concept:** Content refinement and editing  
**Potential Role:** Grammar, style, consistency checking  
**Potential Hive:** CONTENT_HIVE

### SPOKESPERSON
**Concept:** Public communication and messaging  
**Potential Role:** Press releases, public statements, brand voice  
**Potential Hive:** BROADCAST_HIVE or standalone

### CODER
**Concept:** Code generation specialist  
**Potential Role:** Implementation, code review, debugging  
**Note:** May overlap with BOLT functionality

---

## 🚨 Crisis & Governance Domain

### CRISIS_MANAGER
**Concept:** Emergency response and crisis coordination  
**Potential Role:** Issue triage, incident response, stakeholder communication  
**Potential Hive:** OPERATIONS_HIVE or standalone

### ETHICS_OFFICER
**Concept:** Ethical review and compliance  
**Potential Role:** Decision ethics review, bias detection, values alignment  
**Note:** May overlap with SAGE and LEX functionality

### CHAIRMAN
**Concept:** High-level governance and decision arbitration  
**Potential Role:** Final arbiter, strategic decisions, conflict resolution  
**Note:** May overlap with AVERI Trinity functionality

---

## 🎯 Activation Process

When a planned agent is ready for implementation:

1. **Design Phase**
   - Create detailed specification
   - Define responsibilities and boundaries
   - Identify hive placement
   - Check for overlap with existing agents

2. **Implementation Phase**
   - Move folder from `_planned/` to `/agents/[name]/`
   - Create `agent.json` with metadata
   - Implement core capabilities
   - Create integration points

3. **Registration Phase**
   - Add to `.agent-status.json` registry
   - Update `KEEPER/ACTIVE_AGENTS.md`
   - Update hive structure if needed
   - Log activation with SCRIBE

4. **Integration Phase**
   - Connect to routing system
   - Test coordination with other agents
   - Document in architecture
   - Announce to system

---

## 📊 Priority Considerations

**High Priority Candidates:**
- RESEARCH (fills gap in current capabilities)
- DATA_ANALYST (high utility for metrics)
- CRISIS_MANAGER (operational necessity)

**May Not Be Needed:**
- CARTOGRAPHER (ATLAS may cover this)
- TECHNICAL_WRITER (KEEPER/ARCH may cover)
- CODER (BOLT covers this)
- ETHICS_OFFICER (SAGE covers this)
- CHAIRMAN (AVERI Trinity covers this)

**Needs More Definition:**
- All content creation agents (overlap analysis needed)
- Optimization/Scheduler (may be capabilities, not agents)

---

## 🧠 Neural Systems Note

The 5 brain-inspired neural systems implemented are **NOT agents**:

- ✅ PFC Planning Modules = Infrastructure capability
- ✅ Hippocampal Memory = Memory system
- ✅ Default Mode Network = Background processing
- ✅ Small-World Topology = Routing optimization
- ✅ Attractor Dynamics = Pattern completion

These are **shared capabilities** that enhance all existing agents, not separate agents themselves.

---

## 📝 Contributing New Agent Ideas

To propose a new planned agent:

1. Create folder in `_planned/[agent-name]/`
2. Add `CONCEPT.md` with:
   - Purpose and role
   - Capabilities needed
   - Potential hive placement
   - Differentiation from existing agents
3. Submit for review by AVERI Trinity
4. VERA validates no overlap
5. KEEPER documents

---

**Last Updated:** 2026-02-20  
**Maintained By:** KEEPER + VERA  
**Status:** 20+ concepts documented, 0 activated  
**Next Review:** When first agent moves to implementation

---

*"Ideas are precious. Implementation is sacred. Clarity is mandatory."*  
— VERA

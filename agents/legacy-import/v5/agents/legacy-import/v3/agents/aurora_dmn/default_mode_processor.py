"""Default Mode Network - Background Intelligence Processing

Implements DMN-inspired background processing based on neuroscience:
1. Self-referential processing - System health reflection
2. Future simulation - Anticipatory problem solving
3. Semantic consolidation - Pattern extraction from history
4. Creative insight - Novel connection discovery

Research Foundation:
- Wikipedia: Default Mode Network neuroscience
- Soft Coded Logic: System i - The Default Mode Network of AGI (2026)

Performance Target: +8% through proactive optimization
"""

import numpy as np
import asyncio
import random
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from collections import defaultdict, deque
import json


@dataclass
class SystemState:
    """Current system health metrics"""
    timestamp: datetime
    active_agents: int
    idle_agents: int
    pending_tasks: int
    resource_utilization: Dict[str, float]
    recent_errors: List[str]
    performance_metrics: Dict[str, float]
    needs_attention: bool
    attention_reasons: List[str] = field(default_factory=list)


@dataclass
class FutureScenario:
    """Anticipated future problem"""
    scenario_id: str
    description: str
    probability: float
    problem_vector: np.ndarray
    estimated_time_to_occurrence: float  # seconds
    complexity: float
    required_agents: List[str]


@dataclass
class PrecomputedSolution:
    """Cached solution for anticipated problem"""
    scenario_id: str
    solution_strategy: str
    agent_assignments: Dict[str, List[str]]
    estimated_duration: float
    confidence: float
    computed_at: datetime
    ttl_seconds: float = 3600.0  # 1 hour default TTL


@dataclass
class CrossSessionPattern:
    """Extracted pattern from session history"""
    pattern_id: str
    pattern_type: str
    frequency: int
    agent_combinations: List[List[str]]
    problem_categories: List[str]
    success_rate: float
    average_duration: float
    discovered_at: datetime


@dataclass
class Insight:
    """Novel discovery from background processing"""
    insight_id: str
    insight_type: str  # 'novel_collaboration', 'optimization', 'pattern', 'risk'
    description: str
    involved_entities: List[str]
    confidence: float
    actionable_recommendation: str
    discovered_at: datetime
    relevance_score: float


@dataclass
class ProactiveTask:
    """Task generated proactively by DMN"""
    task_id: str
    task_type: str
    description: str
    priority: float
    assigned_agent: Optional[str]
    created_at: datetime


class DefaultModeNetwork:
    """Background processing during system idle states"""
    
    def __init__(self, concept_engine, scribe_interface, neocortex_storage, agent_registry):
        self.concept_engine = concept_engine
        self.scribe = scribe_interface
        self.neocortex = neocortex_storage
        self.registry = agent_registry
        
        self.idle_threshold = 30  # seconds
        self.processing_queue = deque()
        self.insight_buffer = []
        self.insight_capacity = 1000
        self.solution_cache = {}
        self.is_running = False
        self.last_activity_time = datetime.now()
        
    # ========== MAIN PROCESSING LOOP ==========
    
    async def background_processing_loop(self) -> None:
        """Runs continuously when system is idle"""
        self.is_running = True
        
        while self.is_running:
            try:
                if self.is_system_idle():
                    await self.run_dmn_cycle()
                
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except Exception as e:
                print(f"DMN processing error: {e}")
                await asyncio.sleep(10)  # Back off on error
    
    def is_system_idle(self) -> bool:
        """Check if system has been idle long enough"""
        time_since_activity = (datetime.now() - self.last_activity_time).total_seconds()
        return time_since_activity >= self.idle_threshold
    
    def mark_activity(self) -> None:
        """Reset idle timer when activity occurs"""
        self.last_activity_time = datetime.now()
    
    async def run_dmn_cycle(self) -> None:
        """Single DMN processing cycle - all 4 functions"""
        cycle_start = datetime.now()
        
        # Function 1: Self-referential processing
        system_state = await self.reflect_on_system_health()
        if system_state.needs_attention:
            for reason in system_state.attention_reasons:
                self.processing_queue.append(ProactiveTask(
                    task_id=f"health_{datetime.now().timestamp()}",
                    task_type='system_optimization',
                    description=reason,
                    priority=0.9,
                    assigned_agent=None,
                    created_at=datetime.now()
                ))
        
        # Function 2: Future simulation
        anticipated_problems = await self.simulate_future_scenarios()
        for problem in anticipated_problems:
            # Pre-compute solution strategies
            solution = await self.precompute_solution(problem)
            self.cache_solution(problem.scenario_id, solution)
        
        # Function 3: Semantic consolidation
        recent_sessions = await self.scribe.get_recent_sessions(hours=24)
        patterns = await self.extract_cross_session_patterns(recent_sessions)
        for pattern in patterns:
            await self.neocortex.store_pattern({
                'type': 'cross_session',
                'pattern': pattern.__dict__,
                'discovered_by': 'AURORA_DMN',
                'timestamp': datetime.now().isoformat()
            })
        
        # Function 4: Creative insight discovery
        insights = await self.discover_novel_connections()
        self.insight_buffer.extend(insights)
        
        # Maintain buffer capacity
        if len(self.insight_buffer) > self.insight_capacity:
            # Remove lowest relevance insights
            self.insight_buffer.sort(key=lambda x: x.relevance_score, reverse=True)
            self.insight_buffer = self.insight_buffer[:self.insight_capacity]
        
        cycle_duration = (datetime.now() - cycle_start).total_seconds()
        # print(f"DMN cycle complete: {cycle_duration:.2f}s")
    
    # ========== FUNCTION 1: SELF-REFERENTIAL PROCESSING ==========
    
    async def reflect_on_system_health(self) -> SystemState:
        """Analyze system state and identify issues"""
        # Gather metrics
        all_agents = self.registry.get_all_agents()
        active_count = sum(1 for a in all_agents if a.get('status') == 'active')
        idle_count = len(all_agents) - active_count
        
        # Check pending tasks
        pending = len(self.processing_queue)
        
        # Resource utilization
        resources = await self._gather_resource_metrics()
        
        # Recent errors from logs
        errors = await self._get_recent_errors(hours=1)
        
        # Performance metrics
        performance = await self._calculate_performance_metrics()
        
        # Determine if attention needed
        attention_reasons = []
        needs_attention = False
        
        # Check for issues
        if resources.get('cpu', 0) > 0.9:
            attention_reasons.append("CPU utilization critical (>90%)")
            needs_attention = True
        
        if resources.get('memory', 0) > 0.85:
            attention_reasons.append("Memory utilization high (>85%)")
            needs_attention = True
        
        if len(errors) > 10:
            attention_reasons.append(f"High error rate: {len(errors)} errors in last hour")
            needs_attention = True
        
        if performance.get('avg_response_time', 0) > 5.0:
            attention_reasons.append(f"Slow response times: {performance['avg_response_time']:.2f}s average")
            needs_attention = True
        
        if pending > 100:
            attention_reasons.append(f"Task queue buildup: {pending} pending tasks")
            needs_attention = True
        
        return SystemState(
            timestamp=datetime.now(),
            active_agents=active_count,
            idle_agents=idle_count,
            pending_tasks=pending,
            resource_utilization=resources,
            recent_errors=errors,
            performance_metrics=performance,
            needs_attention=needs_attention,
            attention_reasons=attention_reasons
        )
    
    async def _gather_resource_metrics(self) -> Dict[str, float]:
        """Collect system resource utilization"""
        # In production, would query actual system metrics
        return {
            'cpu': random.uniform(0.3, 0.7),
            'memory': random.uniform(0.4, 0.6),
            'disk': random.uniform(0.5, 0.7),
            'network': random.uniform(0.2, 0.5)
        }
    
    async def _get_recent_errors(self, hours: int = 1) -> List[str]:
        """Retrieve recent error logs"""
        # In production, would query actual error logs
        return []
    
    async def _calculate_performance_metrics(self) -> Dict[str, float]:
        """Calculate system performance metrics"""
        # In production, would calculate from actual telemetry
        return {
            'avg_response_time': random.uniform(0.5, 2.0),
            'success_rate': random.uniform(0.95, 0.99),
            'throughput': random.uniform(50.0, 100.0)
        }
    
    # ========== FUNCTION 2: FUTURE SIMULATION ==========
    
    async def simulate_future_scenarios(self, horizon_seconds: float = 3600.0) -> List[FutureScenario]:
        """Anticipate future problems and pre-compute solutions"""
        scenarios = []
        
        # Analyze historical patterns to predict future
        historical_patterns = await self.neocortex.retrieve_patterns({'type': 'cross_session'})
        
        for pattern_data in historical_patterns[:10]:  # Top 10 patterns
            pattern = pattern_data.get('pattern', {})
            
            # Estimate probability of recurrence
            frequency = pattern.get('frequency', 1)
            probability = min(frequency / 100.0, 0.9)  # Cap at 90%
            
            # Create scenario
            scenario = FutureScenario(
                scenario_id=f"scenario_{datetime.now().timestamp()}_{random.randint(1000, 9999)}",
                description=self._generate_scenario_description(pattern),
                probability=probability,
                problem_vector=self._pattern_to_vector(pattern),
                estimated_time_to_occurrence=random.uniform(300, horizon_seconds),
                complexity=pattern.get('average_duration', 60.0) / 300.0,  # Normalize
                required_agents=self._extract_agent_types(pattern)
            )
            
            scenarios.append(scenario)
        
        # Add scenarios based on current trends
        trend_scenarios = await self._extrapolate_from_trends()
        scenarios.extend(trend_scenarios)
        
        return scenarios
    
    def _generate_scenario_description(self, pattern: Dict) -> str:
        """Create human-readable scenario description"""
        problem_cats = pattern.get('problem_categories', ['unknown'])
        return f"Anticipated {problem_cats[0]} problem based on historical pattern"
    
    def _pattern_to_vector(self, pattern: Dict) -> np.ndarray:
        """Convert pattern to problem vector"""
        # In production, would use concept engine to vectorize pattern
        return np.random.randn(2048)
    
    def _extract_agent_types(self, pattern: Dict) -> List[str]:
        """Identify which agents typically handle this pattern"""
        combinations = pattern.get('agent_combinations', [[]])
        if combinations and combinations[0]:
            return combinations[0]
        return ['SWITCHBOARD']  # Default
    
    async def _extrapolate_from_trends(self) -> List[FutureScenario]:
        """Generate scenarios by extrapolating current trends"""
        scenarios = []
        
        # Check for resource trend
        recent_metrics = await self._gather_resource_metrics()
        if recent_metrics.get('memory', 0) > 0.7:
            scenarios.append(FutureScenario(
                scenario_id=f"trend_memory_{datetime.now().timestamp()}",
                description="Memory exhaustion risk based on current trend",
                probability=0.6,
                problem_vector=np.random.randn(2048),
                estimated_time_to_occurrence=1800.0,  # 30 minutes
                complexity=0.7,
                required_agents=['SYSTEMS', 'ATLAS']
            ))
        
        return scenarios
    
    async def precompute_solution(self, scenario: FutureScenario) -> PrecomputedSolution:
        """Pre-compute solution for anticipated problem"""
        # Use concept engine to find best agents
        best_agents = await self._find_best_agents_for_scenario(scenario)
        
        # Generate solution strategy
        strategy = self._generate_solution_strategy(scenario, best_agents)
        
        # Estimate duration
        duration = scenario.complexity * 300.0  # 5 minutes per 1.0 complexity
        
        # Calculate confidence
        confidence = scenario.probability * (1.0 - scenario.complexity * 0.3)
        
        return PrecomputedSolution(
            scenario_id=scenario.scenario_id,
            solution_strategy=strategy,
            agent_assignments={agent: [scenario.scenario_id] for agent in best_agents},
            estimated_duration=duration,
            confidence=confidence,
            computed_at=datetime.now()
        )
    
    async def _find_best_agents_for_scenario(self, scenario: FutureScenario) -> List[str]:
        """Find optimal agents using concept vectors"""
        # Use concept engine to match problem vector to agent vectors
        matches = self.concept_engine.find_agents_for_problem_vector(
            scenario.problem_vector,
            top_k=3
        )
        return [m['agent'] for m in matches]
    
    def _generate_solution_strategy(self, scenario: FutureScenario, agents: List[str]) -> str:
        """Create solution strategy description"""
        return f"Deploy {', '.join(agents)} to address {scenario.description}"
    
    def cache_solution(self, scenario_id: str, solution: PrecomputedSolution) -> None:
        """Store precomputed solution in cache"""
        self.solution_cache[scenario_id] = solution
        
        # Clean expired solutions
        now = datetime.now()
        expired = [
            sid for sid, sol in self.solution_cache.items()
            if (now - sol.computed_at).total_seconds() > sol.ttl_seconds
        ]
        for sid in expired:
            del self.solution_cache[sid]
    
    def get_cached_solution(self, scenario_id: str) -> Optional[PrecomputedSolution]:
        """Retrieve precomputed solution if available"""
        return self.solution_cache.get(scenario_id)
    
    # ========== FUNCTION 3: SEMANTIC CONSOLIDATION ==========
    
    async def extract_cross_session_patterns(self, sessions: List[Dict]) -> List[CrossSessionPattern]:
        """Extract patterns from session history"""
        patterns = []
        
        # Group sessions by similarity
        session_clusters = self._cluster_sessions_by_similarity(sessions)
        
        for cluster_id, cluster_sessions in session_clusters.items():
            if len(cluster_sessions) < 2:
                continue  # Need at least 2 instances for pattern
            
            # Extract common pattern
            pattern = self._extract_pattern_from_cluster(cluster_sessions)
            patterns.append(pattern)
        
        return patterns
    
    def _cluster_sessions_by_similarity(self, sessions: List[Dict]) -> Dict[int, List[Dict]]:
        """Group similar sessions together"""
        clusters = defaultdict(list)
        
        # Simple clustering: group by problem category
        for session in sessions:
            problem_cat = session.get('problem_category', 'uncategorized')
            cluster_id = hash(problem_cat) % 10  # 10 clusters
            clusters[cluster_id].append(session)
        
        return dict(clusters)
    
    def _extract_pattern_from_cluster(self, cluster: List[Dict]) -> CrossSessionPattern:
        """Identify common pattern across sessions"""
        # Aggregate information
        agent_combos = [s.get('agents_involved', []) for s in cluster]
        problem_cats = [s.get('problem_category', 'unknown') for s in cluster]
        success_count = sum(1 for s in cluster if s.get('outcome_quality', 0) > 0.7)
        durations = [s.get('duration', 60.0) for s in cluster]
        
        return CrossSessionPattern(
            pattern_id=f"pattern_{datetime.now().timestamp()}_{random.randint(1000, 9999)}",
            pattern_type='cross_session',
            frequency=len(cluster),
            agent_combinations=agent_combos,
            problem_categories=list(set(problem_cats)),
            success_rate=success_count / len(cluster) if cluster else 0.0,
            average_duration=np.mean(durations) if durations else 60.0,
            discovered_at=datetime.now()
        )
    
    # ========== FUNCTION 4: CREATIVE INSIGHT DISCOVERY ==========
    
    async def discover_novel_connections(self) -> List[Insight]:
        """Find unexpected agent collaboration opportunities"""
        insights = []
        
        all_agents = self.registry.get_all_agents()
        
        # Random walk through concept vector space
        for _ in range(100):
            agent1 = random.choice(all_agents)
            agent2 = random.choice(all_agents)
            
            if agent1['name'] == agent2['name']:
                continue
            
            # Calculate similarity on multiple dimensions
            similarities = {}
            for dimension in ['domain', 'problem', 'output', 'collaboration']:
                sim = self.concept_engine.calculate_similarity(
                    agent1['name'], agent2['name'], dimension
                )
                similarities[dimension] = sim
            
            # Look for high similarity in unexpected dimensions
            if similarities['problem'] > 0.8 and not self._have_collaborated(agent1['name'], agent2['name']):
                insight = Insight(
                    insight_id=f"insight_{datetime.now().timestamp()}_{random.randint(1000, 9999)}",
                    insight_type='novel_collaboration',
                    description=f"High problem-type similarity between {agent1['name']} and {agent2['name']}",
                    involved_entities=[agent1['name'], agent2['name']],
                    confidence=similarities['problem'],
                    actionable_recommendation=self._generate_collaboration_use_case(agent1['name'], agent2['name']),
                    discovered_at=datetime.now(),
                    relevance_score=similarities['problem'] * 0.9
                )
                insights.append(insight)
        
        # Discover optimization opportunities
        optimization_insights = await self._discover_optimization_opportunities()
        insights.extend(optimization_insights)
        
        return insights
    
    def _have_collaborated(self, agent1: str, agent2: str) -> bool:
        """Check if agents have worked together before"""
        # In production, would query actual collaboration history
        return random.random() < 0.3  # 30% chance they've collaborated
    
    def _generate_collaboration_use_case(self, agent1: str, agent2: str) -> str:
        """Suggest specific collaboration scenario"""
        return f"Consider pairing {agent1} and {agent2} for complex multi-dimensional problems"
    
    async def _discover_optimization_opportunities(self) -> List[Insight]:
        """Identify system optimization opportunities"""
        insights = []
        
        # Check for underutilized agents
        utilization = await self._calculate_agent_utilization()
        
        for agent_name, util_score in utilization.items():
            if util_score < 0.2:  # Less than 20% utilized
                insights.append(Insight(
                    insight_id=f"optimization_{datetime.now().timestamp()}_{random.randint(1000, 9999)}",
                    insight_type='optimization',
                    description=f"{agent_name} is underutilized ({util_score:.1%})",
                    involved_entities=[agent_name],
                    confidence=0.8,
                    actionable_recommendation=f"Consider expanding {agent_name}'s responsibilities or reducing resources",
                    discovered_at=datetime.now(),
                    relevance_score=0.7
                ))
        
        return insights
    
    async def _calculate_agent_utilization(self) -> Dict[str, float]:
        """Calculate utilization score for each agent"""
        # In production, would calculate from actual metrics
        all_agents = self.registry.get_all_agents()
        return {agent['name']: random.uniform(0.1, 0.9) for agent in all_agents}
    
    # ========== UTILITY ==========
    
    def get_insights(self, min_relevance: float = 0.5, top_k: int = 10) -> List[Insight]:
        """Retrieve top insights discovered by DMN"""
        relevant = [i for i in self.insight_buffer if i.relevance_score >= min_relevance]
        relevant.sort(key=lambda x: x.relevance_score, reverse=True)
        return relevant[:top_k]
    
    def stop(self) -> None:
        """Stop background processing loop"""
        self.is_running = False


class AuroraDMNAgent:
    """Main AURORA_DMN agent interface"""
    
    def __init__(self, concept_engine, scribe_interface, neocortex_storage, agent_registry):
        self.dmn = DefaultModeNetwork(concept_engine, scribe_interface, neocortex_storage, agent_registry)
        self.name = "AURORA_DMN"
        self.version = "1.0.0"
        self.background_task = None
    
    async def start(self) -> None:
        """Start background processing"""
        if self.background_task is None:
            self.background_task = asyncio.create_task(self.dmn.background_processing_loop())
    
    async def stop(self) -> None:
        """Stop background processing"""
        self.dmn.stop()
        if self.background_task:
            await self.background_task
    
    def get_insights(self, **kwargs) -> List[Insight]:
        """Get discovered insights"""
        return self.dmn.get_insights(**kwargs)
    
    def get_cached_solution(self, scenario_id: str) -> Optional[PrecomputedSolution]:
        """Retrieve precomputed solution"""
        return self.dmn.get_cached_solution(scenario_id)

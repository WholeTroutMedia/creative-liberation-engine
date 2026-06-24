"""Agent Orchestration Framework for Creative Liberation Engine.

This module provides the core orchestration layer that coordinates multiple
AI agents for complex design-to-code generation workflows.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Callable, TypeVar
from datetime import datetime
import asyncio
import uuid
import logging

logger = logging.getLogger(__name__)


class TaskPriority(Enum):
    """Priority levels for agent tasks."""
    CRITICAL = 1
    HIGH = 2
    NORMAL = 3
    LOW = 4
    BACKGROUND = 5


class TaskStatus(Enum):
    """Status states for agent tasks."""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    PAUSED = "paused"


class WorkflowState(Enum):
    """States for workflow execution."""
    INITIALIZING = "initializing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentTask:
    """Represents a task to be executed by an agent."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    agent_type: str = ""
    priority: TaskPriority = TaskPriority.NORMAL
    status: TaskStatus = TaskStatus.PENDING
    input_data: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    dependencies: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """Abstract base class for all agents."""
    
    def __init__(self, name: str, capabilities: List[str] = None):
        self.name = name
        self.capabilities = capabilities or []
        self.is_busy = False
    
    @abstractmethod
    async def execute(self, task: AgentTask) -> Dict[str, Any]:
        """Execute the given task and return results."""
        pass
    
    def can_handle(self, task: AgentTask) -> bool:
        """Check if this agent can handle the given task."""
        return task.agent_type in self.capabilities


class DesignAnalysisAgent(BaseAgent):
    """Agent specialized in analyzing design files."""
    
    def __init__(self):
        super().__init__(
            name="DesignAnalysisAgent",
            capabilities=["design_analysis", "layout_extraction", "color_extraction"]
        )
    
    async def execute(self, task: AgentTask) -> Dict[str, Any]:
        """Analyze design and extract structured information."""
        self.is_busy = True
        try:
            # Placeholder for actual implementation
            return {"status": "analyzed", "components": [], "styles": {}}
        finally:
            self.is_busy = False


class CodeGenerationAgent(BaseAgent):
    """Agent specialized in generating code from designs."""
    
    def __init__(self):
        super().__init__(
            name="CodeGenerationAgent",
            capabilities=["code_generation", "component_creation", "style_generation"]
        )
    
    async def execute(self, task: AgentTask) -> Dict[str, Any]:
        """Generate code based on design analysis."""
        self.is_busy = True
        try:
            return {"status": "generated", "code": "", "files": []}
        finally:
            self.is_busy = False


class QualityAssuranceAgent(BaseAgent):
    """Agent specialized in code quality and accessibility checks."""
    
    def __init__(self):
        super().__init__(
            name="QualityAssuranceAgent",
            capabilities=["accessibility_audit", "code_review", "performance_check"]
        )
    
    async def execute(self, task: AgentTask) -> Dict[str, Any]:
        """Perform quality assurance checks."""
        self.is_busy = True
        try:
            return {"status": "checked", "issues": [], "score": 100}
        finally:
            self.is_busy = False


@dataclass
class Workflow:
    """Represents a complete workflow with multiple tasks."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    state: WorkflowState = WorkflowState.INITIALIZING
    tasks: List[AgentTask] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def add_task(self, task: AgentTask) -> None:
        self.tasks.append(task)
    
    def get_ready_tasks(self) -> List[AgentTask]:
        """Get tasks that are ready to execute (dependencies met)."""
        completed_ids = {
            t.id for t in self.tasks if t.status == TaskStatus.COMPLETED
        }
        return [
            t for t in self.tasks
            if t.status == TaskStatus.PENDING
            and all(dep in completed_ids for dep in t.dependencies)
        ]
    
    def is_complete(self) -> bool:
        return all(
            t.status in [TaskStatus.COMPLETED, TaskStatus.CANCELLED]
            for t in self.tasks
        )


class AgentOrchestrator:
    """Main orchestrator that coordinates agents and workflows."""
    
    def __init__(self):
        self.agents: Dict[str, BaseAgent] = {}
        self.workflows: Dict[str, Workflow] = {}
        self.task_queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.event_handlers: Dict[str, List[Callable]] = {}
        self._running = False
        self._initialize_default_agents()
    
    def _initialize_default_agents(self):
        """Initialize the default set of agents."""
        self.register_agent(DesignAnalysisAgent())
        self.register_agent(CodeGenerationAgent())
        self.register_agent(QualityAssuranceAgent())
    
    def register_agent(self, agent: BaseAgent) -> None:
        """Register an agent with the orchestrator."""
        self.agents[agent.name] = agent
        logger.info(f"Registered agent: {agent.name}")
    
    def create_workflow(self, name: str, description: str = "") -> Workflow:
        """Create a new workflow."""
        workflow = Workflow(name=name, description=description)
        self.workflows[workflow.id] = workflow
        return workflow
    
    def get_workflow(self, workflow_id: str) -> Optional[Workflow]:
        return self.workflows.get(workflow_id)
    
    async def submit_task(self, task: AgentTask) -> str:
        """Submit a task for execution."""
        task.status = TaskStatus.QUEUED
        await self.task_queue.put((task.priority.value, task))
        self._emit_event("task_submitted", task)
        return task.id
    
    async def execute_workflow(self, workflow: Workflow) -> Workflow:
        """Execute all tasks in a workflow."""
        workflow.state = WorkflowState.RUNNING
        self._emit_event("workflow_started", workflow)
        
        try:
            while not workflow.is_complete():
                ready_tasks = workflow.get_ready_tasks()
                if not ready_tasks:
                    await asyncio.sleep(0.1)
                    continue
                
                # Execute ready tasks concurrently
                await asyncio.gather(*[
                    self._execute_task(task) for task in ready_tasks
                ])
            
            workflow.state = WorkflowState.COMPLETED
            workflow.completed_at = datetime.utcnow()
            self._emit_event("workflow_completed", workflow)
            
        except Exception as e:
            workflow.state = WorkflowState.FAILED
            logger.error(f"Workflow failed: {e}")
            self._emit_event("workflow_failed", workflow, error=str(e))
        
        return workflow
    
    async def _execute_task(self, task: AgentTask) -> None:
        """Execute a single task with an appropriate agent."""
        agent = self._find_agent_for_task(task)
        if not agent:
            task.status = TaskStatus.FAILED
            task.error = f"No agent found for task type: {task.agent_type}"
            return
        
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        self._emit_event("task_started", task)
        
        try:
            result = await agent.execute(task)
            task.output_data = result
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            self._emit_event("task_completed", task)
            
        except Exception as e:
            task.error = str(e)
            if task.retries < task.max_retries:
                task.retries += 1
                task.status = TaskStatus.PENDING
                logger.warning(f"Task {task.id} failed, retrying ({task.retries}/{task.max_retries})")
            else:
                task.status = TaskStatus.FAILED
                self._emit_event("task_failed", task, error=str(e))
    
    def _find_agent_for_task(self, task: AgentTask) -> Optional[BaseAgent]:
        """Find an available agent that can handle the task."""
        for agent in self.agents.values():
            if agent.can_handle(task) and not agent.is_busy:
                return agent
        return None
    
    def on(self, event: str, handler: Callable) -> None:
        """Register an event handler."""
        if event not in self.event_handlers:
            self.event_handlers[event] = []
        self.event_handlers[event].append(handler)
    
    def _emit_event(self, event: str, *args, **kwargs) -> None:
        """Emit an event to all registered handlers."""
        for handler in self.event_handlers.get(event, []):
            try:
                handler(*args, **kwargs)
            except Exception as e:
                logger.error(f"Event handler error: {e}")
    
    def get_status(self) -> Dict[str, Any]:
        """Get current orchestrator status."""
        return {
            "agents": {name: not a.is_busy for name, a in self.agents.items()},
            "workflows": len(self.workflows),
            "queue_size": self.task_queue.qsize() if hasattr(self.task_queue, 'qsize') else 0
        }


def create_orchestrator() -> AgentOrchestrator:
    """Factory function to create a configured orchestrator."""
    return AgentOrchestrator()

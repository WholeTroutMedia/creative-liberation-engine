"""Base agent class for the orchestration system.

This module provides the foundational BaseAgent class that all
specialized agents inherit from.
"""

import asyncio
import logging
import uuid
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class AgentStatus(Enum):
    """Agent execution status."""

    IDLE = "idle"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AgentPriority(Enum):
    """Task priority levels."""

    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class AgentMessage:
    """Message passed between agents."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    sender: str = ""
    recipient: str = ""
    content: Any = None
    message_type: str = "default"
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentTask:
    """Task for agent execution."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    priority: AgentPriority = AgentPriority.NORMAL
    status: AgentStatus = AgentStatus.IDLE
    input_data: dict[str, Any] = field(default_factory=dict)
    output_data: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


@dataclass
class AgentResult:
    """Result of agent execution."""

    success: bool
    data: Any = None
    error: str | None = None
    execution_time: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseAgent(ABC):
    """Base class for all agents in the orchestration system.

    Provides common functionality for agent lifecycle management,
    message passing, and task execution.
    """

    def __init__(self, name: str, description: str = ""):
        """Initialize base agent.

        Args:
            name: Agent identifier name
            description: Human-readable description
        """
        self.id = str(uuid.uuid4())
        self.name = name
        self.description = description
        self.status = AgentStatus.IDLE
        self.logger = logging.getLogger(f"agent.{name}")

        self._message_queue: list[AgentMessage] = []
        self._task_queue: list[AgentTask] = []
        self._handlers: dict[str, Callable] = {}
        self._context: dict[str, Any] = {}
        self._created_at = datetime.now()

    @property
    def is_running(self) -> bool:
        """Check if agent is currently running."""
        return self.status == AgentStatus.RUNNING

    @property
    def is_idle(self) -> bool:
        """Check if agent is idle."""
        return self.status == AgentStatus.IDLE

    def set_context(self, key: str, value: Any) -> None:
        """Set context value."""
        self._context[key] = value

    def get_context(self, key: str, default: Any = None) -> Any:
        """Get context value."""
        return self._context.get(key, default)

    def register_handler(self, message_type: str, handler: Callable) -> None:
        """Register a message handler.

        Args:
            message_type: Type of message to handle
            handler: Callback function for handling
        """
        self._handlers[message_type] = handler

    def send_message(
        self, recipient: str, content: Any, message_type: str = "default"
    ) -> AgentMessage:
        """Create and send a message to another agent.

        Args:
            recipient: Target agent name
            content: Message content
            message_type: Type of message

        Returns:
            The created message
        """
        message = AgentMessage(
            sender=self.name, recipient=recipient, content=content, message_type=message_type
        )
        self.logger.debug(f"Sending message to {recipient}: {message_type}")
        return message

    def receive_message(self, message: AgentMessage) -> None:
        """Receive and process a message.

        Args:
            message: The message to process
        """
        self._message_queue.append(message)

        if message.message_type in self._handlers:
            self._handlers[message.message_type](message)

    def add_task(self, task: AgentTask) -> None:
        """Add a task to the queue.

        Args:
            task: Task to add
        """
        self._task_queue.append(task)
        self._task_queue.sort(key=lambda t: t.priority.value, reverse=True)

    def get_next_task(self) -> AgentTask | None:
        """Get the next task from the queue.

        Returns:
            Next task or None if queue is empty
        """
        pending = [t for t in self._task_queue if t.status == AgentStatus.IDLE]
        return pending[0] if pending else None

    @abstractmethod
    async def execute(self, task: AgentTask) -> AgentResult:
        """Execute a task.

        Args:
            task: Task to execute

        Returns:
            Result of execution
        """
        pass

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the agent."""
        pass

    @abstractmethod
    async def cleanup(self) -> None:
        """Clean up agent resources."""
        pass

    async def run(self) -> None:
        """Main agent run loop."""
        self.status = AgentStatus.RUNNING
        self.logger.info(f"Agent {self.name} started")

        try:
            await self.initialize()

            while self.status == AgentStatus.RUNNING:
                task = self.get_next_task()
                if task:
                    task.status = AgentStatus.RUNNING
                    task.started_at = datetime.now()

                    try:
                        result = await self.execute(task)
                        task.status = AgentStatus.COMPLETED
                        task.output_data = result.data if result.data else {}
                    except Exception as e:
                        task.status = AgentStatus.FAILED
                        task.error = str(e)
                        self.logger.error(f"Task {task.id} failed: {e}")

                    task.completed_at = datetime.now()
                else:
                    await asyncio.sleep(0.1)
        finally:
            await self.cleanup()
            self.status = AgentStatus.COMPLETED
            self.logger.info(f"Agent {self.name} stopped")

    def stop(self) -> None:
        """Stop the agent."""
        self.status = AgentStatus.CANCELLED

    def pause(self) -> None:
        """Pause the agent."""
        if self.status == AgentStatus.RUNNING:
            self.status = AgentStatus.PAUSED

    def resume(self) -> None:
        """Resume the agent."""
        if self.status == AgentStatus.PAUSED:
            self.status = AgentStatus.RUNNING

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(name={self.name}, status={self.status.value})"

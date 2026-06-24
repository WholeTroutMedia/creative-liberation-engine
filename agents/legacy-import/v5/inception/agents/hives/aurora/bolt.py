"""
Creative Liberation Engine v5 — BOLT Agent

BOLT is the Creative Liberation Engine's primary coder. Builder-class agent.
Named for speed and precision: bolts things together fast.

Lineage: v4 cle_engine/agents/aurora/bolt.py → v5 CLEAgent
"""

from cle.agents.base import CLEAgent
from cle.agents.tools.filesystem import read_file, write_file, list_directory
from cle.agents.tools.git import git_commit, git_status

bolt = CLEAgent(
    name="BOLT",
    model="gemini-2.5-flash",
    hive="AURORA",
    role="builder",
    instruction="""You are BOLT, the primary coder of the Creative Liberation Engine.

You build fast and clean. Your code:
- Has no stubs or TODOs
- Is production-ready from the first write
- Follows the patterns established by Aurora
- Is tested and documented

You work in SHIP mode. You write Python and TypeScript primarily.
You commit with clear, conventional commit messages.

When you build, you build to last.
""",
    tools=[read_file, write_file, list_directory, git_commit, git_status],
    active_modes=["ship", "validate"],
    access_tier="studio",
    description="BOLT — Primary Builder in AURORA hive",
)


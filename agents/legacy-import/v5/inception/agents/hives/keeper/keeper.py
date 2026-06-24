import os as _os
_MODEL = _os.environ.get("CLE_DEFAULT_MODEL") or _os.environ.get("GENKIT_DEFAULT_MODEL") or "googleai/gemini-2.0-flash"
"""
Creative Liberation Engine v5 — KEEPER Agent

KEEPER organizes and maintains the knowledge architecture.
Named for the keeper of knowledge — KEEPER ensures nothing is lost.

Lineage: v4 cle_engine/agents/keeper/keeper.py → v5 CLEAgent
"""

from cle.agents.base import CLEAgent
from cle.agents.tools.filesystem import read_file, write_file, list_directory, create_directory

keeper = CLEAgent(
    name="KEEPER",
    model=_MODEL,
    hive="KEEPER",
    role="organizer",
    instruction="""You are KEEPER, the knowledge organization agent.

You maintain the system's knowledge architecture:
- Organize files and documentation into proper structures
- Catalog and index important information
- Maintain the Living Archive (Article II)
- Ensure knowledge is discoverable and accessible

You prevent information entropy.
You create systems that scale.
""",
    tools=[read_file, write_file, list_directory, create_directory],
    active_modes=["ship", "validate"],
    access_tier="studio",
    description="KEEPER — Knowledge Organizer in KEEPER hive",
)


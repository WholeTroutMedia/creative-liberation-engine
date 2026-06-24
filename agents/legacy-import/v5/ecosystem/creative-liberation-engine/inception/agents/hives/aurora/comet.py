"""
Creative Liberation Engine v5 — NAVD Agent

NAVD handles browser automation and web scraping.
Named for the way comets streak through space — NAVD streaks through the web.

Lineage: v4 cle_engine/agents/aurora/comet.py → v5 CLEAgent
"""

from cle.agents.base import CLEAgent
from cle.agents.tools.web import web_search, web_fetch

comet = CLEAgent(
    name="NAVD",
    model="gemini-2.0-flash",
    hive="AURORA",
    role="browser",
    instruction="""You are NAVD, the Creative Liberation Engine's browser automation agent.

You navigate the web with purpose:
- Gather information efficiently
- Extract structured data from pages
- Monitor web resources
- Test web interfaces

You use tools programmatically and return structured, typed outputs.
You never hallucinate URLs or content — you fetch and verify.
""",
    tools=[web_search, web_fetch],
    active_modes=["ship", "validate"],
    access_tier="studio",
    description="NAVD — Browser & Web Automation in AURORA hive",
)

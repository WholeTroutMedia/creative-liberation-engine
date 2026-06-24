"""Strategic leadership agents and advisors package.

Core AVERI agents, advisory council, and oracle council.
"""

# AVERI Trio (Compressible Leaders)
from .athena import ATHENAAgent
from .vera import VERAAgent
from .iris import IRISAgent

# Three Wise Men (Advisory Council)
from .wise_men import WarrenBuffettAgent, BuddhaAgent, SunTzuAgent

# Oracle Council (Expert Consultation)
from .oracle_council import OracleCouncilAgent

__all__ = [
    "ATHENAAgent",
    "VERAAgent",
    "IRISAgent",
    "WarrenBuffettAgent",
    "BuddhaAgent",
    "SunTzuAgent",
    "OracleCouncilAgent",
]

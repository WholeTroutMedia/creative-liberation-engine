"""Validator agents package.

V4-exclusive validation agents for VALIDATE mode.
COMPASS Hive - Constitutional & Mission Alignment Validators.
"""

# === Core Validator Agents (HELIX GAMMA) ===
from .sentinel import SENTINELAgent
from .patterns import PATTERNSAgent
from .logic import LOGICAgent
from .coverage import COVERAGEAgent
from .compass import COMPASSAgent

# === Legacy Validators (backward compatibility) ===
from .archon import ARCHONAgent
from .proof import PROOFAgent
from .harbor import HARBORAgent

__all__ = [
    # Core 5 validators
    "SENTINELAgent",
    "PATTERNSAgent",
    "LOGICAgent",
    "COVERAGEAgent",
    "COMPASSAgent",
    # Legacy (will be deprecated)
    "ARCHONAgent",
    "PROOFAgent",
    "HARBORAgent",
]

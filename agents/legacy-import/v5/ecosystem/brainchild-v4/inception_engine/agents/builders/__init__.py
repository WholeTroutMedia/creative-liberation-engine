"""Builder agents package.

All builder agents for the Creative Liberation Engine, organized by function.
"""

# Hive 1 - AURORA (Design & Engineering)
from .bolt import BOLTAgent
from .comet import COMETAgent

# Hive 2 - LEX (Legal & Constitutional)
from .compass import COMPASSAgent

# Hive 3 - KEEPER (Knowledge Organization)
from .arch import ARCHAgent
from .echo import ECHOAgent
from .codex import CODEXAgent

# Hive 4 - BROADCAST (Live Media)
from .control_room import ControlRoomAgent
from .showrunner import SHOWRUNNERAgent
from .signal import SIGNALAgent
from .graphics import GRAPHICSAgent
from .studio import STUDIOAgent
from .systems import SYSTEMSAgent

# Hive 5 - SWITCHBOARD (Operations)
from .relay import RELAYAgent
from .ram_crew import RAMCrewAgent

# Coordination Layer
from .scribe import SCRIBEAgent

# Enhancement Layers
from .math_agent import MATHAgent
from .language_agent import LANGUAGEAgent

__all__ = [
    "BOLTAgent",
    "COMETAgent",
    "COMPASSAgent",
    "ARCHAgent",
    "ECHOAgent",
    "CODEXAgent",
    "ControlRoomAgent",
    "SHOWRUNNERAgent",
    "SIGNALAgent",
    "GRAPHICSAgent",
    "STUDIOAgent",
    "SYSTEMSAgent",
    "RELAYAgent",
    "RAMCrewAgent",
    "SCRIBEAgent",
    "MATHAgent",
    "LANGUAGEAgent",
]

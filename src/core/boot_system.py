"""Boot System for Inception Engine (Light Edition)

Provides welcome message, agent discovery, and session configuration.
All 15 agents are interoperable by default. HELIX mode is optional.
"""

from datetime import datetime
from typing import Dict, List, Optional


# Light Edition agent registry (15 agents)
AGENT_REGISTRY = {
    "coordination": {
        "SCRIBE": {
            "status": "active",
            "type": "coordination",
            "mode": "all",
            "function": "Institutional memory and cross-agent coordination",
        }
    },
    "leaders": {
        "ATHENA": {
            "status": "active",
            "type": "leader",
            "mode": "build",
            "function": "Strategic planning and long-term architecture",
            "part_of": "AVERI",
        },
        "VERA": {
            "status": "active",
            "type": "leader",
            "mode": "all",
            "function": "Truth verification, memory operations, registry management",
            "part_of": "AVERI",
        },
        "IRIS": {
            "status": "active",
            "type": "leader",
            "mode": "build",
            "function": "Swift action and blocker removal",
            "part_of": "AVERI",
        },
    },
    "builders": {
        "BOLT": {
            "status": "active",
            "type": "builder",
            "mode": "build",
            "function": "Frontend engineering and iOS development",
        },
        "COMET": {
            "status": "active",
            "type": "builder",
            "mode": "build",
            "function": "Backend systems and browser automation",
        },
        "SYSTEMS": {
            "status": "active",
            "type": "builder",
            "mode": "build",
            "function": "Infrastructure and deployment operations",
        },
    },
    "hive_leaders": {
        "AURORA": {
            "status": "active",
            "type": "hive_leader",
            "mode": "build",
            "function": "Design and engineering coordination",
        },
        "KEEPER": {
            "status": "active",
            "type": "hive_leader",
            "mode": "build",
            "function": "Knowledge organization and pattern library",
        },
        "ATLAS": {
            "status": "active",
            "type": "hive_leader",
            "mode": "build",
            "function": "Broadcast infrastructure coordination",
        },
        "COMPASS": {
            "status": "active",
            "type": "hive_leader",
            "mode": "both",
            "function": "Constitutional review and North Star guardian",
        },
        "LEX": {
            "status": "active",
            "type": "hive_leader",
            "mode": "both",
            "function": "Legal and constitutional compliance",
        },
        "SWITCHBOARD": {
            "status": "active",
            "type": "hive_leader",
            "mode": "build",
            "function": "Operations routing and coordination",
        },
    },
    "validators": {
        "SENTINEL": {
            "status": "active",
            "type": "validator",
            "mode": "validate",
            "function": "Security vulnerability scanning",
        },
        "ARCHON": {
            "status": "active",
            "type": "validator",
            "mode": "validate",
            "function": "Architecture compliance checking",
        },
        "PROOF": {
            "status": "active",
            "type": "validator",
            "mode": "validate",
            "function": "Behavioral correctness validation",
        },
        "HARBOR": {
            "status": "active",
            "type": "validator",
            "mode": "validate",
            "function": "Test coverage evaluation",
        },
    },
}


class BootSystem:
    """Manages the boot process and welcome experience for Inception Engine."""

    def __init__(self):
        """Initialize boot system with the Light Edition agent registry."""
        self.registry = AGENT_REGISTRY

    def boot(
        self,
        package_name: str = "Inception Engine",
        show_agents: bool = True,
        show_session_options: bool = True,
    ) -> Dict:
        """Execute boot sequence and return boot information.

        Args:
            package_name: Name of the package being booted
            show_agents: Whether to display available agents
            show_session_options: Whether to show session configuration options

        Returns:
            Dict containing boot information and configuration options
        """
        agents = self._get_active_agents()
        boot_info = {
            "package_name": package_name,
            "boot_time": datetime.now().isoformat(),
            "version": "4.0.0-light",
            "total_agents": len(agents),
            "available_agents": agents,
            "session_options": self._get_session_options() if show_session_options else None,
            "operational_mode": "interoperable",
            "helix_mode": "available_on_request",
        }

        if show_agents:
            self._display_welcome(boot_info)

        return boot_info

    def _get_active_agents(self) -> List[Dict]:
        """Get list of active agents with their capabilities."""
        active = []
        for group_name, group_agents in self.registry.items():
            for name, info in group_agents.items():
                if info.get("status") == "active":
                    active.append(
                        {
                            "name": name,
                            "function": info.get("function", ""),
                            "type": info.get("type", "agent"),
                            "mode": info.get("mode", "build"),
                            "group": group_name,
                        }
                    )
        return active

    def _get_session_options(self) -> Dict:
        """Get available session configuration options."""
        return {
            "operational_modes": [
                {
                    "name": "interoperable",
                    "description": "All agents work together fluidly (DEFAULT)",
                    "use_case": "Most tasks, flexible collaboration",
                },
                {
                    "name": "helix",
                    "description": "Agents organized into specialized helixes",
                    "use_case": "Complex tasks requiring parallel workstreams",
                },
                {
                    "name": "plan_determined",
                    "description": "Let agents self-organize during PLAN mode",
                    "use_case": "When optimal structure emerges from planning",
                },
            ],
            "inception_modes": [
                {"name": "IDEATE", "description": "Strategic vision and alignment"},
                {"name": "PLAN", "description": "Technical specification and design"},
                {"name": "SHIP", "description": "Implementation to production"},
                {"name": "VALIDATE", "description": "Quality assurance and review"},
            ],
            "workflow_patterns": [
                "Full Lifecycle (IDEATE > PLAN > SHIP > VALIDATE)",
                "Rapid Development (IDEATE > SHIP > VALIDATE)",
                "Express (SHIP > VALIDATE)",
                "Continuous (VALIDATE > SHIP)",
            ],
        }

    def _display_welcome(self, boot_info: Dict) -> None:
        """Display formatted welcome message."""
        print("\n" + "=" * 70)
        print(f"  Welcome to {boot_info['package_name']}")
        print("=" * 70)
        print(f"\n  Version: {boot_info['version']}")
        print(f"  Available Agents: {boot_info['total_agents']} (All Interoperable)")
        print(f"  Operational Mode: {boot_info['operational_mode'].upper()}")
        print(f"  HELIX Formation: Available On Request\n")
        print("-" * 70)
        print("  AGENT CAPABILITIES")
        print("-" * 70)

        agents_by_type: Dict[str, list] = {}
        for agent in boot_info["available_agents"]:
            agent_type = agent["type"]
            if agent_type not in agents_by_type:
                agents_by_type[agent_type] = []
            agents_by_type[agent_type].append(agent)

        type_labels = {
            "coordination": "  COORDINATION LAYER:",
            "leader": "  STRATEGIC LEADERS (AVERI):",
            "hive_leader": "  HIVE LEADERS:",
            "builder": "  SPECIALIZED BUILDERS:",
            "validator": "  QUALITY VALIDATORS:",
        }

        for agent_type, label in type_labels.items():
            if agent_type in agents_by_type:
                print(f"\n{label}")
                for agent in agents_by_type[agent_type]:
                    print(f"    {agent['name']}: {agent['function']}")

        if boot_info["session_options"]:
            print("\n" + "-" * 70)
            print("  SESSION OPTIONS")
            print("-" * 70)
            print("\n  OPERATIONAL MODES:")
            for mode in boot_info["session_options"]["operational_modes"]:
                default = " [DEFAULT]" if mode["name"] == "interoperable" else ""
                print(f"    {mode['name'].upper()}{default}")
                print(f"      {mode['description']}")
            print("\n  WORKFLOW PATTERNS:")
            for pattern in boot_info["session_options"]["workflow_patterns"]:
                print(f"    {pattern}")

        print("\n" + "=" * 70)
        print("  TIP: Agents are interoperable by default.")
        print("  Request HELIX formation anytime for parallel workstreams.")
        print("=" * 70 + "\n")

    def get_agent_info(self, agent_name: str) -> Optional[Dict]:
        """Get detailed information about a specific agent."""
        for group_name, group_agents in self.registry.items():
            if agent_name in group_agents:
                info = group_agents[agent_name].copy()
                info["name"] = agent_name
                info["group"] = group_name
                return info
        return None

    def list_agents_by_capability(self, capability: str) -> List[str]:
        """Find agents matching a capability keyword."""
        matches = []
        for agent in self._get_active_agents():
            if capability.lower() in agent["function"].lower():
                matches.append(agent["name"])
        return matches


if __name__ == "__main__":
    boot = BootSystem()
    boot.boot(package_name="Inception Engine (Light Edition)")

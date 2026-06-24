#!/usr/bin/env python3
"""Design System Auto-Injection Configuration

Automatically injects design tokens and guidelines into AURORA agent prompts
to ensure consistent UI/UX across all generated interfaces.

Usage:
    from cle_engine.agents.builders.aurora.auto_inject_config import inject_design_system
    
    # Inject into agent prompt
    enhanced_prompt = inject_design_system(base_prompt, compressed=True)
"""

import json
from pathlib import Path
from typing import Dict, List, Optional
from cle_engine.core.agent_executor import AgentResult, AgentCapability


class DesignSystemInjector:
    """Inject design system tokens into agent prompts."""

    def __init__(self):
        self.base_path = Path(__file__).parent
        self.design_system_path = self.base_path / "design-system.json"
        self.design_system = self._load_design_system()

        self.activate()
    def _load_design_system(self) -> Dict:
        """Load design system from JSON."""
        try:
            with open(self.design_system_path, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"Warning: Could not load design system: {e}")
            return {}

    def inject_full(self, base_prompt: str) -> str:
        """Inject complete design system into prompt."""
        if not self.design_system:
            return base_prompt

        design_context = self._build_full_context()
        return f"{base_prompt}\n\n{design_context}"

    def inject_compressed(self, base_prompt: str, sections: Optional[List[str]] = None) -> str:
        """Inject compressed design system into prompt.
        
        Args:
            base_prompt: Base agent prompt
            sections: List of sections to include. If None, includes default sections.
        
        Returns:
            Enhanced prompt with design context
        """
        if not self.design_system:
            return base_prompt

        if sections is None:
            sections = [
                "color_palette",
                "typography",
                "spacing",
                "components",
                "platform_specific",
                "usage_guidelines"
            ]

        design_context = self._build_compressed_context(sections)
        return f"{base_prompt}\n\n{design_context}"

    def _build_full_context(self) -> str:
        """Build full design system context."""
        context = "<design_system>\n"
        context += json.dumps(self.design_system, indent=2)
        context += "\n</design_system>"
        return context

    def _build_compressed_context(self, sections: List[str]) -> str:
        """Build compressed design system context with only specified sections."""
        context = "<design_system>\n"
        
        for section in sections:
            if section in self.design_system:
                context += self._format_section(section, self.design_system[section])
        
        context += "</design_system>"
        return context

    def _format_section(self, name: str, data: Dict) -> str:
        """Format a design system section for prompt injection."""
        formatted = f"\n## {name.replace('_', ' ').title()}\n"

        if name == "color_palette":
            formatted += self._format_colors(data)
        elif name == "typography":
            formatted += self._format_typography(data)
        elif name == "spacing":
            formatted += self._format_spacing(data)
        elif name == "components":
            formatted += self._format_components(data)
        elif name == "platform_specific":
            formatted += self._format_platform_rules(data)
        elif name == "usage_guidelines":
            formatted += self._format_guidelines(data)
        else:
            # Generic formatting for other sections
            formatted += json.dumps(data, indent=2)

        return formatted + "\n"

    def _format_colors(self, colors: Dict) -> str:
        """Format color palette section."""
        output = ""
        
        if "primary" in colors:
            output += f"Primary: {colors['primary']['main']} (usage: {colors['primary']['usage']})\n"
        
        if "secondary" in colors:
            output += f"Secondary: {colors['secondary']['main']}\n"
        
        if "semantic" in colors:
            output += "\nSemantic Colors:\n"
            for key, value in colors["semantic"].items():
                output += f"  {key}: {value}\n"
        
        return output

    def _format_typography(self, typo: Dict) -> str:
        """Format typography section."""
        output = ""
        
        if "font_families" in typo:
            output += f"Primary Font: {typo['font_families']['primary']}\n"
            output += f"Mono Font: {typo['font_families']['mono']}\n"
        
        if "font_sizes" in typo:
            output += "\nKey Sizes: "
            output += f"base={typo['font_sizes']['base']}, lg={typo['font_sizes']['lg']}, xl={typo['font_sizes']['xl']}\n"
        
        return output

    def _format_spacing(self, spacing: Dict) -> str:
        """Format spacing section."""
        output = "8px base unit (0.5rem increments)\n"
        
        if "component_spacing" in spacing:
            output += "\nComponent Spacing:\n"
            for key, value in spacing["component_spacing"].items():
                output += f"  {key}: {value}\n"
        
        return output

    def _format_components(self, components: Dict) -> str:
        """Format components section."""
        output = "Available Component Patterns:\n"
        
        for comp_name in components.keys():
            output += f"  - {comp_name}\n"
        
        return output

    def _format_platform_rules(self, platform: Dict) -> str:
        """Format platform-specific rules."""
        output = ""
        
        if "macos" in platform:
            output += "macOS Rules:\n"
            rules = platform["macos"].get("modal_rules", [])
            for rule in rules:
                output += f"  ⚠️  {rule}\n"
        
        if "web" in platform:
            output += "\nWeb Requirements:\n"
            output += f"  Min touch target: {platform['web'].get('touch_target_min_size')}\n"
        
        return output

    def _format_guidelines(self, guidelines: Dict) -> str:
        """Format usage guidelines."""
        output = "\nKey Guidelines:\n"
        
        for category, rules in guidelines.items():
            if rules and isinstance(rules, list):
                output += f"\n{category.replace('_', ' ').title()}:\n"
                for rule in rules[:3]:  # Top 3 rules per category
                    output += f"  • {rule}\n"
        
        return output


# Singleton instance
_injector = None


def get_injector() -> DesignSystemInjector:
    """Get singleton injector instance."""
    global _injector
    if _injector is None:
        _injector = DesignSystemInjector()
    return _injector


def inject_design_system(base_prompt: str, compressed: bool = True, 
                         sections: Optional[List[str]] = None) -> str:
    """Inject design system into agent prompt.
    
    Args:
        base_prompt: Base agent prompt to enhance
        compressed: If True, use compressed format (recommended)
        sections: Sections to include (only used if compressed=True)
    
    Returns:
        Enhanced prompt with design system context
    
    Examples:
        >>> prompt = "Generate a landing page with hero section"
        >>> enhanced = inject_design_system(prompt)
        >>> # Enhanced prompt now includes color palette, spacing, etc.
        
        >>> # Full injection for detailed work
        >>> enhanced = inject_design_system(prompt, compressed=False)
    """
    injector = get_injector()
    
    if compressed:
        return injector.inject_compressed(base_prompt, sections)
    else:
        return injector.inject_full(base_prompt)


def inject_for_aurora_agent(agent_name: str, base_prompt: str) -> str:
    """Inject design system optimized for specific AURORA agent.
    
    Args:
        agent_name: Name of AURORA agent (e.g., "BOLT", "SKETCH", "PALETTE")
        base_prompt: Base agent prompt
    
    Returns:
        Enhanced prompt with relevant design system sections
    """
    # Agent-specific section mappings
    agent_sections = {
        "BOLT": ["color_palette", "typography", "spacing", "components", "platform_specific"],
        "SKETCH": ["color_palette", "spacing", "components"],
        "PALETTE": ["color_palette"],
        "TYPE": ["typography"],
        "LAYOUT": ["spacing", "components"],
        "RESPONSIVE": ["spacing", "components", "platform_specific"],
        "MOTION": ["platform_specific"],
        "PATTERN": ["components", "usage_guidelines"]
    }
    
    sections = agent_sections.get(agent_name.upper(), None)
    return inject_design_system(base_prompt, compressed=True, sections=sections)


if __name__ == "__main__":
    # Test injection
    injector = get_injector()
    
    test_prompt = "Generate a responsive landing page with hero section, feature cards, and CTA buttons."
    
    print("=" * 70)
    print("COMPRESSED INJECTION TEST")
    print("=" * 70)
    enhanced = inject_design_system(test_prompt, compressed=True)
    print(enhanced)
    
    print("\n" + "=" * 70)
    print("AURORA AGENT-SPECIFIC INJECTION (BOLT)")
    print("=" * 70)
    bolt_enhanced = inject_for_aurora_agent("BOLT", test_prompt)
    print(bolt_enhanced)

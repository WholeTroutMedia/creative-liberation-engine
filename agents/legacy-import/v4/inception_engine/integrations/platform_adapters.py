"""
Platform Adapters - Antigravity, Perplexity, Generic
Creative Liberation Engine - Helix B Integration Layer

Model-Agnostic adapters translating platform requests to
constitutional routing via IRIS + SWITCHBOARD.

Constitutional: Article XI (Open Systems), Article III (Human Supremacy)
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional

from cle_engine.orchestration import (
  SWITCHBOARDRouter, IRISClassifier, ModelSelection,
  ClassificationResult, RoutingStrategy,
)


class PlatformAdapter(ABC):
  """Base adapter for platform routing."""

  def __init__(self, strategy: str = "balanced"):
    self.router = SWITCHBOARDRouter(strategy=RoutingStrategy(strategy))
    self.classifier = IRISClassifier()

  def route_request(self, user_input: str, context: Optional[Dict] = None,
                    mode: str = "BUILD", override: Optional[str] = None) -> Dict:
    classification = self.classifier.classify(user_input, context)
    selection = self.router.route_task(classification, user_override=override, mode=mode)
    return self.format_response(classification, selection)

  @abstractmethod
  def format_response(self, classification: ClassificationResult, selection: ModelSelection) -> Dict:
    pass


class AntigravityAdapter(PlatformAdapter):
  """Antigravity IDE adapter - model switch commands for editor sessions."""

  def format_response(self, classification, selection) -> Dict:
    return {
      "platform": "antigravity", "action": "model_switch",
      "model": {"id": selection.model_id, "provider": selection.provider, "tier": selection.tier},
      "task": {"type": classification.task_type, "confidence": classification.confidence},
      "ide_hints": {"fallback_models": selection.fallback_models, "cost": selection.estimated_cost},
      "reason": selection.reason,
    }

  def get_editor_context(self, file_path: str, language: str) -> Dict:
    return {"has_code_block": True, "language": language, "file_path": file_path}


class PerplexityAdapter(PlatformAdapter):
  """Perplexity chat adapter - model suggestions for conversational AI."""

  def format_response(self, classification, selection) -> Dict:
    return {
      "platform": "perplexity", "action": "suggest_model",
      "model": {"id": selection.model_id, "provider": selection.provider, "tier": selection.tier},
      "task": {"type": classification.task_type, "confidence": classification.confidence},
      "chat_hints": {
        "reasoning": classification.reasoning,
        "fallback_tiers": selection.fallback_tiers,
        "constitutional_flags": selection.constitutional_flags,
      },
      "reason": selection.reason,
    }


class GenericAdapter(PlatformAdapter):
  """Generic adapter - full routing data for any platform."""

  def format_response(self, classification, selection) -> Dict:
    return {
      "platform": "generic",
      "classification": {"type": classification.task_type, "confidence": classification.confidence, "reasoning": classification.reasoning},
      "selection": {"tier": selection.tier, "model_id": selection.model_id, "provider": selection.provider, "reason": selection.reason},
      "fallbacks": {"tiers": selection.fallback_tiers, "models": selection.fallback_models},
      "meta": {"cost": selection.estimated_cost, "flags": selection.constitutional_flags},
    }


# === FACTORY ===

def get_adapter(platform: str = "generic", strategy: str = "balanced") -> PlatformAdapter:
  """Factory for platform adapters."""
  adapters = {
    "antigravity": AntigravityAdapter,
    "perplexity": PerplexityAdapter,
    "generic": GenericAdapter,
  }
  cls = adapters.get(platform, GenericAdapter)
  return cls(strategy=strategy)

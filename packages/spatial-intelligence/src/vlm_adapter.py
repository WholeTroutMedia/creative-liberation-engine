"""VLM adapter - bridge between spatial scene graph and vision-language models."""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class VLMPrompt:
    """Structured prompt for a VLM query."""
    system: str
    user: str
    image_urls: List[str]
    metadata: Dict[str, Any]


@dataclass
class VLMResponse:
    """Parsed response from a VLM."""
    text: str
    confidence: float
    model_id: str
    raw: Dict[str, Any]


class VLMAdapter:
    """Adapter that formats scene graph data for VLM consumption."""

    SYSTEM_PROMPT = (
        "You are a spatial reasoning assistant. "
        "Analyse the provided scene graph and answer the user query "
        "with precise object labels, relationships, and 3-D coordinates."
    )

    def __init__(self, model_id: str = "gemini-2.5-pro"):
        self.model_id = model_id

    def build_prompt(
        self,
        scene_json: Dict[str, Any],
        query: str,
        image_urls: Optional[List[str]] = None,
    ) -> VLMPrompt:
        """Convert scene graph dict + query into a VLMPrompt."""
        scene_text = json.dumps(scene_json, indent=2)
        user_msg = f"Scene graph:\n```json\n{scene_text}\n```\n\nQuery: {query}"
        return VLMPrompt(
            system=self.SYSTEM_PROMPT,
            user=user_msg,
            image_urls=image_urls or [],
            metadata={"model_id": self.model_id, "query": query},
        )

    def parse_response(self, raw: Dict[str, Any]) -> VLMResponse:
        """Parse a raw VLM API response into VLMResponse."""
        text = (
            raw.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        return VLMResponse(
            text=text,
            confidence=float(raw.get("confidence", 1.0)),
            model_id=self.model_id,
            raw=raw,
        )

    def format_nodes_for_vlm(
        self, nodes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Flatten SceneNode dicts into a VLM-friendly list."""
        result = []
        for n in nodes:
            bbox = n.get("bbox", {})
            extents = bbox.get("extents", [])
            volume = (
                float(8 * extents[0] * extents[1] * extents[2])
                if len(extents) == 3
                else None
            )
            result.append(
                {
                    "label": n.get("label"),
                    "confidence": n.get("confidence", 1.0),
                    "center": bbox.get("center", []),
                    "extents": extents,
                    "volume": volume,
                }
            )
        return result

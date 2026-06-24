---
name: "Academic Paper Architectural Analysis"
description: "Extracts technical design patterns and architectural insights from research papers or academic web pages."
agentCallable: true
---


## Purpose

Converts raw scholarly content into actionable technical requirements and architectural blueprints for software engineering.

## Inputs

- source_url
- focus_area (e.g., 'concurrency', 'memory_management')
- target_framework_context

## Outputs

- design_patterns_summary
- implementation_roadmap
- technical_constraints_list

## Guardrails

- Verify URL reachability before processing.
- Filter out non-technical citations and social commentary from the output.
- Ensure proposed patterns are compatible with the target framework context provided in input.

## Detailed Instructions

1. Execute fetchWebPage on the provided 'source_url' to retrieve the raw text of the paper.
2. Identify core methodology sections within the fetched text (e.g., 'Proposed System', 'Implementation Details').
3. Pass the extracted content to a reasoning-capable LLM with a system prompt focused on distilling academic theory into practical engineering patterns (e.g., 'Translate [Concept X] into specific coding primitives like AsyncLocalStorage or custom middleware').
4. Structure the final response into three sections: 1) Identified Design Patterns, 2) Step-by-Step Implementation Logic, and 3) Known Limitations/Trade-offs.
5. If a link is broken, retry with a fallback to local text input if provided.

